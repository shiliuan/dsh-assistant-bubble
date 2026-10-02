/**
 * dsh-assistant-bubble — browser half.
 *
 * DSH renders the user's message inside a bubble component
 * (`UserStyleBubble` in @deepseek-ai/dsh-client-ui-chat) while assistant text
 * is a plain full-width block. This plugin gives the assistant body the same
 * bubble treatment — same background token, same radius, same padding — and
 * changes nothing else: it stays on the left, keeps its width, and only the
 * prose body is wrapped. The per-turn action row (copy/regenerate) and the
 * "stopped" marker stay outside the bubble because they are siblings of the
 * body, not children of it.
 *
 * FORMAT NOTE — this file must stay a pre-built CommonJS bundle.
 *
 * The client bundle is NOT loaded with `import`. It is executed as a classic
 * script whose body registers a factory on the module loader:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * Two details are load-bearing, and getting either wrong breaks the whole web
 * boot (not just this plugin):
 *
 *  1. CommonJS, not ESM. A top-level `export` is a syntax error at parse time:
 *       Uncaught SyntaxError: Unexpected token 'export'
 *
 *  2. `window.__ModuleLoader__`, not a bare `_ModuleLoader__`. The bare global
 *     does not exist in the scope this script runs in:
 *       Uncaught ReferenceError: _ModuleLoader__ is not defined
 *
 * Both of those were observed as real startup failures. The shipped packages
 * happen to use the bare identifier because their build injects it; out-of-tree
 * bundles must go through `window`, which is what the working third-party
 * bundles (dsh-plugin-wallpaper-engine, dshmarket) do.
 *
 * The file must end with `exports.apply = apply; return module.exports`.
 * Run `npm run verify` after any edit — see scripts/verify-client-bundle.mjs.
 */

window.__ModuleLoader__.load({
  id: 'dsh-assistant-bubble',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var PLUGIN_ID = 'dsh-assistant-bubble'

    var STYLES = [
      {
        name: 'assistant-bubble',
        css: [
          '/*',
          ' * Selector notes.',
          ' *',
          ' * `.v5IAXa_*` is the CSS-module prefix of the assistant message component in',
          ' * @deepseek-ai/dsh-client-ui-chat. Four classes live under it:',
          ' *   _root    the whole assistant message row',
          ' *   _body    the prose content  <-- this is what we wrap',
          ' *   _stopped the "interrupted" marker',
          ' *   _actions the copy / regenerate row',
          ' *',
          ' * The prefix is a build-time hash scoped to that one component, so it cannot',
          ' * collide with unrelated UI. We target the body as a DIRECT child of the root',
          ' * to keep nested structures (tool cards, the pending-process placeholder) out',
          ' * of the bubble.',
          ' *',
          ' * Values mirror `.cJsG2q_bubble` from the same package exactly, so the two',
          ' * sides read as one family. They are the theme own tokens, never literals,',
          ' * so light/dark and every future theme keep working.',
          ' */',
          ':where(.v5IAXa_root > .v5IAXa_body) {',
          '  box-sizing: border-box;',
          '  max-width: 100%;',
          '  padding: 10px 16px;',
          '  border-radius: var(--dsw-radius-xl);',
          '  background: var(--dsw-specific-bubble);',
          '  color: var(--dsw-alias-label-primary);',
          '  overflow-wrap: break-word;',
          '  transition: background-color 0.15s ease;',
          '}',
          '',
          '/* Keep the row from becoming one full-bleed slab on wide windows. User bubbles',
          '   cap at ~70% of the chat column; the assistant body usually carries wider',
          '   content (tables, code), so it gets a looser cap than 0.702. */',
          ':where(.v5IAXa_root) {',
          '  max-width: min(calc(var(--dsh-chat-content-width, 748px) * 0.92), 94%);',
          '}',
          '',
          '/* The last block own bottom margin would double up with the bubble padding. */',
          ':where(.v5IAXa_root > .v5IAXa_body) > :last-child {',
          '  margin-bottom: 0;',
          '}',
          '',
          '@media (prefers-reduced-motion: reduce) {',
          '  :where(.v5IAXa_root > .v5IAXa_body) {',
          '    transition: none;',
          '  }',
          '}',
          '',
        ].join('\n'),
      },
    ]

    /**
     * Client plugin body.
     * @param ctx - the browser-side cordis context.
     */
    function apply(ctx) {
      if (typeof document === 'undefined') return
      for (var i = 0; i < STYLES.length; i++) {
        var name = STYLES[i].name
        var css = STYLES[i].css
        ctx.effect(
          function () {
            var tag = document.createElement('style')
            tag.dataset.plugin = PLUGIN_ID
            tag.dataset.pluginCss = PLUGIN_ID + '/' + name
            tag.textContent = css
            document.head.appendChild(tag)
            return function () {
              tag.remove()
            }
          },
          'assistant-bubble: ' + name + ' stylesheet',
        )
      }
    }

    exports.apply = apply
    return module.exports
  },
})
