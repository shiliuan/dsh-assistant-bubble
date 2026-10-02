# dsh-assistant-bubble

[English](README.md) | [中文](README.zh.md)

Give the DSH assistant reply the same **bubble** treatment the user messages already have — same
background, same radius, same padding — while staying left-aligned.

<!-- Add a screenshot when you have one, e.g.:
![before / after](docs/images/preview.png) -->

> DSH renders user messages inside a bubble (`UserStyleBubble` in
> `@deepseek-ai/dsh-client-ui-chat`) but leaves assistant text as a plain full-width block.
> This plugin closes that visual gap.

## What it does and does not touch

| Changes | Unchanged |
|---|---|
| Assistant prose gets a bubble: background, radius, padding | **Position** — still left-aligned, not mirrored to the right |
| A loose 92% width cap so it does not become a full-bleed slab | The copy / regenerate action row — it stays **outside** the bubble |
| | Tool-call cards — never wrapped |
| | Code blocks and tables — their own styling is untouched |

Zero runtime cost, no tools exposed to the model, no network access, no credentials.
It is one stylesheet injection.

## Install

> Not published to npm yet — install from a clone for now.

```sh
git clone https://github.com/shiliuan/dsh-assistant-bubble.git
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-assistant-bubble
```

Then **restart DSH**. Client bundles are loaded at boot; a running window will not pick it up.

- CLI / browser form: `--profile web`
- Desktop app: `--profile desktop`, and **fully quit the app first**

## How it works

The assistant message component carries a CSS-module prefix (`v5IAXa` on DSH 0.2.0-rc.2) with four
classes under it: `_root` (the whole row), `_body` (the prose), `_stopped`, and `_actions`.
The plugin wraps **`_root > _body`** as a direct child — which is exactly why the action row and the
stopped marker stay outside: they are siblings of the body, not children of it.

Styling reuses the theme's own tokens (`--dsw-specific-bubble`, `--dsw-radius-xl`), never literal
colors, so light/dark and any future theme keep working. The stylesheet is mounted through
`ctx.effect`, so it is removed automatically when the plugin unloads.

The values mirror `.cJsG2q_bubble` from the same package, so both sides read as one family.

## Turning it off

1. Disable the `dsh-assistant-bubble` row in the plugins page, or
2. `dsh plugin --profile <profile> remove dsh-assistant-bubble`, or
3. Add to your profile's `cordis.patch.yml`:

   ```yaml
   - id: dsh-assistant-bubble
     disabled: true
   ```

## The one fragile spot

`v5IAXa` is a **build-time hash** of a CSS module, scoped to that single component. It cannot collide
with unrelated UI, but a DSH upgrade may rename it. When that happens the bubble **silently stops
appearing** — no error, just the old look.

To find the new prefix, search the chat client bundle:

```sh
# look for the assistant body rule
grep -o '\.\w*_body{flex-direction:column;gap:16px' \
  node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js
```

Then update the two selectors at the top of `lib/client.js`. PRs that refresh this prefix are welcome.

## Contributing: read this before editing `lib/client.js`

The client bundle is **not** an ES module. It is served as a **classic script** that registers a
factory on the module loader, and its body is pre-built CommonJS:

```js
window.__ModuleLoader__.load({
  id: 'dsh-assistant-bubble',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    // ...
    exports.apply = apply
    return module.exports
  },
})
```

Two details are load-bearing. Getting **either** wrong is not a cosmetic bug — DSH treats a client
bundle that fails to load as **fatal**, and the whole GUI refuses to start until the profile is
repaired by hand:

| Mistake | Result on boot |
|---|---|
| Top-level `export` (ESM) | `Uncaught SyntaxError: Unexpected token 'export'` |
| Bare `_ModuleLoader__` | `Uncaught ReferenceError: _ModuleLoader__ is not defined` |
| Either of the above | `Error: web boot: 1 entry did not activate` |

Both were hit for real while building this plugin. The shipped `@deepseek-ai/*` packages use the bare
identifier because their build injects it; **out-of-tree bundles must go through `window`**, which is
what the other working third-party bundles do (`dsh-plugin-wallpaper-engine`, `dshmarket`).

### Always run the checker before restarting

```sh
npm run verify
```

It reproduces the browser's loading path: classic-script parse, `window.__ModuleLoader__` registration,
factory execution, `apply()` against a fake DOM, and assertions that a `<style>` was really injected,
contains the expected declarations, and is removed again on dispose.

The harness itself can be wrong — an earlier version of it put `_ModuleLoader__` in the sandbox scope,
validated the broken bundle, and let a fatal bug through. So it ships with a self-test:

```sh
node scripts/verify-client-bundle.mjs --self-test
```

That mutates a known-good bundle into each failure mode and asserts the checker rejects it, plus a
control that it still accepts the good one. **Run it after editing the checker.** A checker that
cannot fail is worse than no checker.

## License

MIT
