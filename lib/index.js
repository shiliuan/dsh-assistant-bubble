/**
 * dsh-assistant-bubble — host half.
 *
 * This plugin is purely a browser-side presentation change, so the host half has
 * nothing to provide. It stays an empty plugin entry because a profile bundle
 * needs a loadable module on the Node side; the visible work happens in
 * `lib/client.js`, which DSH loads into the browser through the `dsh.client`
 * manifest in package.json.
 */
export default {
  name: 'dsh-assistant-bubble',
  apply() {},
}
