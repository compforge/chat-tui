# 分层输入路由

## 理念与概念

原始问题不是“某个组件漏处理 Esc”，而是多个同时存在的 UI context 会争用同一按键。输入模型
因此区分四个概念：

- **Binding** 把物理按键映射到行为，例如 `escape → interaction.cancel`。
- **Command** 表示用户行为，例如取消编辑、关闭 Picker、解决 Interaction 或中断 turn。
- **Layer** 表示行为当前所属的 UI context；越贴近用户当前操作的层优先级越高。
- **Intent** 是需要越过 UI 边界的 command 结果，通过 `ChatProtocol` 交给 harness。

组件只声明自己允许用户产生哪些行为。仅改变焦点、选中项、查询或展开态的 command 在组件内
闭环；会改变 Interaction、Picker、turn 或应用生命周期的 command 才调用注入的 protocol
intent。原始 `KeyEvent` 不跨越 chat-tui 与 harness 的边界。

## 流程

```text
physical key
    │
    ▼
OpenTUI keymap
    │ active layers（priority 高 → 低）
    ▼
semantic command
    ├─ local UI state ───────────────▶ render
    └─ ChatProtocol intent ──────────▶ harness / data layer
```

一个 command 正常完成后，binding 同时阻止默认行为和后续传播，因此一次按键只产生一个行为。
command 返回 `false` 表示当前 context 不接受该行为，路由器才继续尝试外层；所有层都不接受时，
按键交给当前聚焦的 OpenTUI renderable，例如 textarea 光标移动或 select 切换选项。

所有 `useInputBindings` 调用都会按 renderer 复用同一个 keymap，因此单独组合公开组件也可用；
`ChatShell` 默认挂载 `InputProvider`，应用若还包含 ChatShell 外的页面，也可以在更高层显式
包裹它来标出统一输入边界。

## 关键设计

### 行为归组件，优先级归层级

InteractionDock、Picker、Suggestions、Question editor 等组件声明自己的 command 和 binding，
父组件只提供数据与 callback。新增组件不应去应用根部追加按键特判。

默认层级从外到内为：

1. `application`：应用兜底行为；
2. `surface`：Composer、Transcript 等常驻区域；
3. `popup`：补全和 Picker；
4. `modal`：阻塞 Interaction 与 QueuePane；
5. `editing`：Modal 内部的临时编辑模式；
6. `overlay`：视觉上覆盖整页的 Sidecar 等应用浮层。

能够同时活跃且争用同一按键的 context 必须使用不同层级；不能依赖 React effect 或 handler
注册顺序决定胜负。只有确实希望多个行为连续执行时才显式使用 keymap 的 fallthrough。
内联 Sidecar 的链接导航属于 `surface`，因此不会压过 Picker、Interaction 等更高层；Sidecar
作为 overlay 时沿用 `overlay` 层，保证同一组选择和打开键位仍作用于最上层可见内容。

### 键位的单一事实来源

所有默认键位收敛在 `src/input/keybinds.ts` 的 `defaultKeybinds` 定义表：action → 默认键 +
desc/group 元数据。组件不再硬编码键位字符串，而是经 `layerBindings()`（keymap 层语义
command）或 `editorKeyBindings()`（textarea 编辑动作，如 submit/newline）从表取默认绑定；
分层路由语义（哪层消费、Esc 冒泡）仍归组件，表里只有键与元数据。

接入方可构造 `KeybindOverrides`（action → 替换键，null 解绑）传给 `InputProvider`（或
`ChatShell` 的 `keybinds` prop）做用户级覆盖；override 按 action 粒度替换全部默认键。
chat-tui 不读取配置文件。定义表类型与默认值从根 `index.ts` 导出，接入方可用来生成帮助。

### Cancel 是语义，不是按键

Esc 默认映射为当前 context 的 cancel command，但协议只表达取消结果，不表达键盘设备。
Interaction view 通过 `cancelResponse` 声明取消应映射到某个 reject option、dismissed 或
`cancelled`；鼠标 Cancel 或未来可配置键位可复用同一语义。

典型传播是：

```text
Question Other 编辑 ─cancel→ 返回选项
Picker 查询         ─cancel→ 清空查询
Picker              ─cancel→ resolvePicker(id, null)
QueuePane           ─cancel→ resolveQueue({ kind: "close" })
Interaction         ─cancel→ resolveInteraction(id, cancelResponse)
running turn        ─cancel→ ChatProtocol.cancel()
```

Interaction 的接收方仍必须处理 `cancelled` 终态，因为取消还可能来自 turn、requester、timeout
或恢复清理，而不只来自用户按 Esc。

### 约束验证

通用契约测试验证最高层唯一消费、`false` 向外传播以及未匹配按键进入聚焦控件；真实渲染测试
覆盖 Question 内层编辑、Picker 两阶段取消、Sidecar/Interaction 叠加和 Interaction/turn
叠加，避免后续新增组件重新引入按键泄漏。
