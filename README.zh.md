# dsh-assistant-bubble

[English](README.md) | [中文](README.zh.md)

把 DSH 里**助手回复的正文**套上气泡外观 —— 和用户消息气泡同底色、同圆角、同内边距，但**保持在左侧**。

<!-- 有截图后补在这里，例如：
![前后对比](docs/images/preview.png) -->

> DSH 只给用户消息用了气泡组件（`@deepseek-ai/dsh-client-ui-chat` 里的 `UserStyleBubble`），
> 助手正文是普通全宽块。本插件把这段视觉落差补齐。

## 影响范围

| 会变 | 不变 |
|---|---|
| 助手正文加上气泡：底色、圆角、内边距 | **位置** —— 仍在左侧，不右对齐 |
| 加了 92% 的宽松宽度上限，避免在宽窗口下拉满整列 | 复制 / 重新生成按钮行 —— 留在气泡**外面** |
| | 工具调用卡片 —— 从不套气泡 |
| | 代码块与表格 —— 自身样式不受影响 |

零运行时开销、不向模型暴露任何工具、不联网、不碰凭据。本质只是一次样式注入。

## 安装

> **尚未发布到 npm** —— 暂时从克隆的仓库安装。

```sh
git clone https://github.com/shiliuan/dsh-assistant-bubble.git
dsh plugin --profile <profile> add link:/绝对路径/dsh-assistant-bubble
```

然后**重启 DSH**。客户端 bundle 只在启动时加载，开着的窗口不会自动生效。

- 命令行 / 浏览器形态：`--profile web`
- 桌面端：`--profile desktop`，且**必须先完全退出应用**

## 工作原理

助手消息组件带一个 CSS Module 前缀（DSH 0.2.0-rc.2 上是 `v5IAXa`），下面有四个类：
`_root`（整行）、`_body`（正文）、`_stopped`（中断标记）、`_actions`（按钮行）。
插件只包 **`_root > _body`** 这个直接子元素 —— 这正是按钮行和中断标记被排除在外的原因：
它们是 `_body` 的**兄弟节点**，不是子节点。

配色全部取自主题自身的 token（`--dsw-specific-bubble`、`--dsw-radius-xl`），没有写死任何色值，
所以浅色 / 深色以及以后换主题都不会失配。样式经 `ctx.effect` 挂载，**插件卸载时自动移除**。

数值刻意与同包的 `.cJsG2q_bubble` 对齐，让两侧读起来是同一套设计。

## 关掉它

1. 在插件页禁用 `dsh-assistant-bubble` 这一条，或
2. `dsh plugin --profile <profile> remove dsh-assistant-bubble`，或
3. 在 profile 的 `cordis.patch.yml` 里加：

   ```yaml
   - id: dsh-assistant-bubble
     disabled: true
   ```

## 唯一的脆弱点

`v5IAXa` 是 CSS Module 的**构建期哈希**，作用域限于那一个组件，不会误伤其它 UI，
但 **DSH 升级后可能改名**。届时气泡会**静默失效** —— 不报错，只是恢复原样。

找新前缀的办法：

```sh
grep -o '\.\w*_body{flex-direction:column;gap:16px' \
  node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js
```

然后改 `lib/client.js` 顶部那两处选择器。欢迎提 PR 更新这个前缀。

## 贡献：改 `lib/client.js` 之前必读

客户端 bundle **不是 ES module**。它被当作**传统脚本**执行，脚本体是预构建的 CommonJS：

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

**两个细节都是致命的**。弄错任何一个都不是"样式不生效"，而是 DSH 把加载失败当作**致命错误**，
整个界面起不来，必须手工修复 profile 才能恢复：

| 错误写法 | 启动时的后果 |
|---|---|
| 顶层 `export`（ESM） | `Uncaught SyntaxError: Unexpected token 'export'` |
| 裸 `_ModuleLoader__` | `Uncaught ReferenceError: _ModuleLoader__ is not defined` |
| 以上任一 | `Error: web boot: 1 entry did not activate` |

**这两种都是开发这个插件时真实踩过的。** 官方 `@deepseek-ai/*` 包写裸标识符，是因为它们的构建会注入；
**第三方包必须走 `window`** —— 其它能正常工作的第三方插件（`dsh-plugin-wallpaper-engine`、`dshmarket`）都是这么写的。

### 重启前务必先跑校验

```sh
npm run verify
```

它会复现浏览器的完整加载路径：传统脚本解析、经 `window.__ModuleLoader__` 注册、执行 factory、
对假 DOM 调用 `apply()`，并断言 **确实注入了 `<style>`、含预期声明、且 dispose 时能被移除**。

**校验工具本身也会错** —— 早先的版本把 `_ModuleLoader__` 放进了沙箱作用域，
于是"验证通过"了一个会崩的 bundle，放行了致命 bug。所以它自带反向测试：

```sh
node scripts/verify-client-bundle.mjs --self-test
```

它会把一个已知正确的 bundle 分别改造成各种错误形态，断言校验器能拒绝它们，
并保留一个"仍然接受正确版本"的对照项。**改完校验器后请跑它。**
一个抓不到错误的校验器，比没有校验器更危险。

## 许可证

MIT
