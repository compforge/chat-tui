# Protocol 边界

## 理念

chat-tui 负责“怎么展示、怎么收集输入”，harness 负责“agent 在做什么”。协议只交换完整视图与用户 intent，不把 session、turn、provider 或上游事件模型带入组件层；因此本地 agent loop 与远端转发可以共用同一套 UI。

## 契约

- `getView()` 返回完整 `ChatViewState`；状态未变化时必须保持同一对象引用，以满足 `ChatShell` 的 `useSyncExternalStore` 订阅模型。
- harness 先归约上游增量事件，再发布新快照。chat-tui 不维护第二套 delta 协议，也不尝试重放 provider 事件。
- `TranscriptItem` 是展示形状，不是事件：普通消息与 activity block 分开；block 只接收 status、tone、kind、title 和已格式化 content。diff 或 provider ContentBlock 等结构语义由接入方完成投影。
- `interactions` 是带稳定 ID 的有序人机交互投影：`InteractionDock` 展示首项；approval / question / suggested input 保留各自 typed payload，只共享排序、requester 与响应入口。suggested input 仅在用户显式采用后进入 composer，提交或放弃都通过 `resolveInteraction` 回传，持久状态仍归接入方。
- `sidecar` 是可选辅助视图快照：接入方先把 Board、上下文或诊断投影成通用 section/item；chat-tui 不识别这些领域概念。无有效条目时自动隐藏，窄屏 overlay 的 Esc 只通过 `dismissSidecar` 上报关闭 intent。
- slash 命令表、`@` 引用源和 theme 都由接入方注入；chat-tui 不内置具体产品或 provider 语义。

## 关键设计

选择快照而不是增量事件，是为了让接入方保有业务真相源，组件只消费当下应展示的结果。这样 UI 无需跟随各家事件协议版本演进，也不会因本地与远端 transport 不同而分裂实现。
