# Protocol 边界

## 理念

chat-tui 负责“怎么展示、怎么收集输入”，harness 负责“agent 在做什么”。协议交换展示 read model 与用户 intent，不把 session、turn、provider 或上游事件模型带入组件层；因此本地 agent loop 与远端转发可以共用同一套 UI。

## 契约

- 新接入方通过 `createChatSurfaceStore` 提供 `surfaces`，分别发布 `timeline`、`composer`、`activity`、`footer`、`sidecar` 五个 Surface 的稳定快照；一个 Surface 未变化时保持引用不变，也不通知其订阅者。
- `commit(patch)` 是原子提交：多路新快照先全部可见，再通知变化的订阅者。它仍是 snapshot 协议，不要求 harness 维护 UI delta。
- `getView()` + `subscribe()` 保留为兼容入口；`ChatShell` 通过 `protocol/view.ts` 把完整 `ChatViewState` 适配成五路快照。新接入方应直接提供 `surfaces`，避免一个辅助视图的变化使其他 Surface 重渲染。
- harness 先归约上游增量事件，再发布新快照。chat-tui 不维护第二套 delta 协议，也不尝试重放 provider 事件。
- `TranscriptItem` 是展示形状，不是事件：普通消息与 activity block 分开；block 只接收 status、tone、kind、title 和已格式化 content。diff 或 provider ContentBlock 等结构语义由接入方完成投影。
- `interactions` 是带稳定 ID 的有序人机交互投影：`InteractionDock` 展示首项；approval / question / suggested input 保留各自 typed payload，只共享排序、requester 与响应入口。suggested input 仅在用户显式采用后进入 composer，提交或放弃都通过 `resolveInteraction` 回传，持久状态仍归接入方。
- `sidecar` 是可选辅助视图快照：接入方先把 Board、上下文或诊断投影成通用 section/item；chat-tui 不识别这些领域概念。无有效条目时自动隐藏，窄屏 overlay 的 Esc 只通过 `dismissSidecar` 上报关闭 intent。
- `picker.search.mode` 区分本地过滤和远端搜索：本地模式由 chat-tui 对当前 options 做过滤；远端模式只通过 `searchPicker(id, query)` 上报查询 intent，防抖、请求执行、取消和过期结果丢弃归 harness。
- slash 命令表、`@` 引用源和 theme 都由接入方注入；chat-tui 不内置具体产品或 provider 语义。

## 关键设计

选择按 Surface 分区的快照而不是增量事件，是为了让接入方保有业务真相源，组件只消费当下应展示的结果。Surface 是一个独立订阅的 React 子树：按语义命名和组合，不需要共同基类或注册器。分区只描述渲染依赖，不把业务事件泄漏进 UI；因此既能隔离重渲染，又无需跟随各家事件协议版本演进。

五个 Surface 的归属固定为：

| Surface | State channel | 内容 |
|---|---|---|
| `TimelineSurface` | `timeline` | Transcript 与 pinned Plan |
| `ComposerSurface` | `composer` | queued input、ComposerEditor、补全、Picker 与 InteractionDock |
| `ActivitySurface` | `activity` | 当前输入目标、运行相位与其他活跃 agent |
| `FooterSurface` | `footer` | 短寿命 toast 与常驻 footer text |
| `SidecarSurface` | `sidecar` | Board 等与主时间线并列的辅助读模型 |
