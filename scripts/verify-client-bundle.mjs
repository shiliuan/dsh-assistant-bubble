/**
 * Pre-flight check for a DSH client bundle.
 *
 * Why this exists: DSH treats a client bundle that fails to load as a FATAL
 * error — the whole web GUI refuses to start. A typo here does not degrade
 * gracefully, it bricks the app until the profile is repaired by hand. So this
 * harness reproduces the browser's loading path locally and refuses to let a
 * broken bundle through.
 *
 * What it reproduces, exactly:
 *   1. The bundle is parsed as a CLASSIC SCRIPT — no ESM syntax allowed.
 *   2. The module loader is reachable ONLY as `window.__ModuleLoader__`.
 *      A bare `_ModuleLoader__` does not exist in that scope.
 *   3. `apply(ctx)` is invoked against a fake DOM, and the resulting <style>
 *      must actually be injected, contain the expected declarations, and be
 *      removed again on dispose.
 *
 * Usage:
 *   node scripts/verify-client-bundle.mjs [path/to/client.js]
 *   node scripts/verify-client-bundle.mjs --self-test
 *
 * `--self-test` mutates a known-good bundle into the two shapes that have
 * actually broken real boots, and asserts this harness rejects them. Run it
 * after editing this file: a checker that cannot fail is worse than none.
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const DEFAULT_ENTRY = 'lib/client.js'

/** Declarations the injected stylesheet must contain. */
const REQUIRED_CSS = [
  '.v5IAXa_root > .v5IAXa_body',
  'background: var(--dsw-specific-bubble)',
  'border-radius: var(--dsw-radius-xl)',
  'padding: 10px 16px',
]

/**
 * Load one bundle the way the browser does, and exercise it.
 * @param code - bundle source.
 * @param filename - name used in parse errors.
 * @returns a result record instead of throwing, so callers can aggregate.
 */
function check(code, filename) {
  const steps = []
  const fail = (step, message) => ({ ok: false, steps, failedAt: step, message })

  let script
  try {
    script = new vm.Script(code, { filename })
  } catch (e) {
    return fail('parse', `classic-script parse failed: ${e.message}`)
  }
  steps.push('parse: parsed as a classic script (no ESM syntax)')

  const injected = []
  const registrations = []
  const sandbox = {
    document: {
      head: { appendChild: (tag) => injected.push(tag) },
      createElement: (kind) => ({ kind, dataset: {}, textContent: '' }),
      querySelectorAll: () => [],
    },
    // The loader hangs off `window` ONLY. Deliberately no global
    // `_ModuleLoader__`, so a bundle that relies on one fails right here.
    window: { __ModuleLoader__: { load: (d) => registrations.push(d) } },
    Symbol,
    Object,
    console,
  }

  try {
    script.runInNewContext(sandbox)
  } catch (e) {
    const hint = /is not defined/.test(e.message)
      ? ' (the loader is reachable only as window.__ModuleLoader__)'
      : ''
    return fail('run', `threw while registering: ${e.message}${hint}`)
  }
  steps.push('run: registered a module on window.__ModuleLoader__')

  const reg = registrations[0]
  if (!reg) return fail('register', 'never called window.__ModuleLoader__.load(...)')
  if (typeof reg.id !== 'string' || reg.id === '') return fail('register', `invalid module id: ${reg.id}`)
  if (typeof reg.factory !== 'function') return fail('register', 'factory is not a function')
  steps.push(`descriptor: id = ${reg.id}`)

  let mod
  try {
    mod = reg.factory(() => {
      throw new Error('unexpected require')
    })
  } catch (e) {
    return fail('factory', `factory threw: ${e.message}`)
  }
  if (!mod || typeof mod.apply !== 'function') {
    return fail('exports', `module.exports.apply is not a function (got: ${Object.keys(mod ?? {}).join(', ') || 'nothing'})`)
  }
  steps.push('exports: module.exports.apply is callable')

  const effects = []
  try {
    mod.apply({
      effect(fn, label) {
        effects.push({ label, dispose: fn() })
      },
    })
  } catch (e) {
    return fail('apply', `apply(ctx) threw: ${e.message}`)
  }
  steps.push(`apply: injected ${injected.length} <style>, registered ${effects.length} effect(s)`)

  const style = injected[0]
  if (!style || style.kind !== 'style') return fail('apply', 'no <style> element was injected')
  steps.push(`dataset: ${JSON.stringify(style.dataset)}`)

  const css = style.textContent
  for (const needle of REQUIRED_CSS) {
    if (!css.includes(needle)) return fail('css', `injected CSS is missing: ${needle}`)
  }
  steps.push(`css: ${css.length} chars, all ${REQUIRED_CSS.length} required declarations present`)

  let removed = false
  style.remove = () => {
    removed = true
  }
  const first = effects[0]
  if (!first || typeof first.dispose !== 'function') return fail('dispose', 'effect did not return a disposer')
  first.dispose()
  if (!removed) return fail('dispose', 'dispose did not remove the <style> tag')
  steps.push('dispose: removing the effect removes the <style> tag')

  return { ok: true, steps }
}

/**
 * Prove the harness rejects the two failure modes that really happened.
 * @param goodSource - a bundle known to be correct.
 * @returns true when every mutation was caught.
 */
function selfTest(goodSource) {
  const cases = [
    {
      name: 'ESM export (SyntaxError on boot)',
      code: 'export function apply(ctx) {}\n',
    },
    {
      name: 'bare _ModuleLoader__ (ReferenceError on boot)',
      code: goodSource.replaceAll('window.__ModuleLoader__', '_ModuleLoader__'),
    },
    {
      name: 'no registration at all',
      code: '/* does nothing */\n',
    },
  ]
  let allCaught = true
  for (const c of cases) {
    const result = check(c.code, `self-test:${c.name}`)
    const caught = result.ok === false
    if (!caught) allCaught = false
    console.log(`  ${caught ? 'caught  ' : 'MISSED  '} ${c.name}`)
    if (caught) console.log(`           -> ${result.failedAt}: ${result.message}`)
  }
  // And the good source must still pass, otherwise the harness over-rejects.
  const control = check(goodSource, 'self-test:good')
  console.log(`  ${control.ok ? 'passes  ' : 'REJECTED'} known-good bundle (control)`)
  if (!control.ok) allCaught = false
  return allCaught
}

const args = process.argv.slice(2)
const entry = path.resolve(args.find((a) => !a.startsWith('--')) ?? DEFAULT_ENTRY)
const source = fs.readFileSync(entry, 'utf8')

if (args.includes('--self-test')) {
  console.log('Self-test: the harness must reject these known-bad bundles\n')
  const ok = selfTest(source)
  console.log('')
  if (!ok) {
    console.error('Self-test FAILED — this checker cannot be trusted.')
    process.exit(1)
  }
  console.log('Self-test passed: the checker catches every known failure mode.')
  process.exit(0)
}

console.log(`Checking ${entry}\n`)
const result = check(source, entry)
for (const s of result.steps) console.log('  OK  ' + s)
console.log('')
if (!result.ok) {
  console.error(`FAIL at ${result.failedAt}: ${result.message}`)
  console.error('')
  console.error('Do NOT restart DSH with this bundle installed — the web boot is fatal.')
  process.exit(1)
}
console.log('All checks passed — this bundle is safe to load.')
