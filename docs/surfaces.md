# Surface 层级与交互语义

## 理念

主对话自上而下按信息的时态与寿命分层：过去的信息进入可滚动时间线，主线当前状态靠近输入区，
短寿命回执进入 Footer，可选的并行工作区位于最下方。Sidecar 与主对话并列，承载跨时间线的辅助信息。

展示可以压缩信息，但不能改写事实；不同维度保持正交，未知输入显式暴露，裁剪只影响当前
视图。State、Store 与 Surface 的关系由 [`kernel.md`](kernel.md) 统一定义。带方括号的区块
是条件渲染，无内容时不占空间：

```text
┌ Main chat ─────────────────────────┬ [Sidecar] ─────────┐
│ TimelineSurface                    │ SidecarSurface      │
│   Transcript      可滚动历史（过去时）│   辅助信息           │
│   [Plan]          进行中的计划       │   section / item    │
│ [QueueSurface]    待执行输入（将来时）│                     │
│ ActivitySurface   主执行线当前状态    │                     │
│ ComposerSurface                    │                     │
│   ComposerEditor  持续可编辑输入区    │                     │
│   [Interaction Dock] 补全/选择/审批  │                     │
│ FooterSurface                      │                     │
│   [Toast]         短寿命操作回执     │                     │
│   Footer text     常驻状态           │                     │
│ [ParallelSurface] 可选并行工作区      │                     │
└────────────────────────────────────┴─────────────────────┘
```

## TimelineSurface

Timeline 是可滚动的过去时区域，接收 message、activity block 与 render group 三类展示数据。接入方负责把
自身事件整理成可展示内容，chat-tui 不解释 provider 语义。

- activity block 的 `status` 表示结果，决定 icon；`tone` 表示注意或留痕，影响颜色但不改变
  结果。例如 completed + warning 仍显示完成图标。
- 未知状态不得静默伪装成某个已知结果，必须显式保留异常值。
- 消息来源与正文格式分离：role / author 只表达谁在说话，format 独立表达 plain / markdown。
- 长内容按视觉行预算折叠，diff 默认完整展示；裁剪不修改接入方传入的数据。
- 展开有两个正交维度：Ctrl+O 全局展开/收起（收起时清掉按块状态），点击裁剪提示行
  （`… +N lines`）只展开该 block；按块展开后内容尾部出现 `… expanded (click to collapse)`
  提示行，点击它收起该块（全局展开不挂收起提示，收起走 Ctrl+O）。提示行的点击按 down/up
  同点判定，拖拽选择不会误触发。Ctrl+Shift+Y 复制最近一条 agent 消息（整条消息只有一个
  code fence 时复制纯代码），复制走接入方提供的 OpenTUI `ClipboardService`
  （host/terminal fallback 由 OpenTUI 决定），结果经 Footer toast 回执。
- 接入方可用带稳定 ID 的 `TranscriptGroupItem` 收纳完整 `TranscriptBlockItem`，并声明默认收起；
  chat-tui 只负责一行摘要与 Ctrl+O 展开，不判断哪些相邻事实应该合并。首成员出现时就创建 group，
  后续只追加 member 并更新摘要，避免流式过程中改变顶层节点类型。group 的成员仅允许 block，不能
  继续嵌套 group；不提供摘要的 group 是透明容器，不额外占用展示行。

### Plan

当前计划固定在 Timeline 尾部、Composer 之前；空计划不占空间。是否展示及何时撤下由
harness 决定，窗口始终优先保持当前进度可见。

## ParallelSurface

Parallel 是 Footer 下方可选的“现在时”区域，承载仍在推进的并行工作。每个 item 由通用的 icon、
name、description、progress、tokens 与起始时间组成；chat-tui 不判断它来自 agent、某条 Lane 的
Harness 还是异步 task。没有 State 或 item 为空时不占空间，完成后的可回看结果由接入方移入
Timeline，避免当前区域无限增长。

## ActivitySurface

Activity 是 Composer 上方唯一的主执行线状态区，描述当前输入目标与运行相位；Composer 自身不再
拥有另一份 run status。Activity 保持独立 State 与渲染边界，避免高频状态刷新重建输入 buffer。
chat-tui 只展示接入方提供的标签和时间信息，不推断 agent 生命周期。

接入方可在 Activity State 注入可选 `tips` 语料：有运行项时每 10s 轮换一条，以 dim 色
`· Tip: ...` 缀在最后一行状态尾部，宽度不足按显示宽度截断留省略号，连最短正文都放不下则
整段不渲染；idle 或无语料时不渲染也不挂定时器。语料内容完全归接入方。

## ComposerSurface

Composer 位于历史区下方，是供用户持续组织和修改输入的创作面，不是只在 agent 空闲时开放的
一次性提交框。其设计优先保护尚未提交的内容，遵守三个不变量：

1. **输出与输入可以同时发生**：时间线流式更新或 agent 正在运行时，用户仍能继续编辑下一条
   输入；外部更新不得抢焦点、覆盖或清空 draft。
2. **多行是输入语义的一部分**：换行、光标位置和未提交内容必须完整保留，补全、历史和队列
   召回不能意外归一化它们。
3. **无关 State 更新不影响输入**：Sidecar、Parallel、Activity 或 Footer 刷新不得让 Composer 重建
   输入 buffer；只有 Composer 真正依赖的布局或输入状态变化才参与更新。

大段文本粘贴（bracketed paste，≥3 行或 >200 字符）在 buffer 中折叠为原子占位 token
（`[Pasted #N ~12 lines]`），原文存于组件内旁表：光标不可进入 token 内部，backspace/delete
落在 token 上时整体删除；提交时 token 展开回完整原文，harness 收到的永远是展开后的文本。
图片等非文本粘贴不经过该机制，由接入方自行拦截。

## QueueSurface

Queue 展示等待执行的输入，是 Activity 之前的可选将来时区域；队列本体、顺序和召回语义归
harness。Queue 使用独立 State 和渲染边界；紧凑 QueueSurface 负责预览，QueuePane 负责按条选择并
根据接入方声明的 capability 产出召回、删除、重排或立即派发 intent。召回结果由 ComposerSurface
直接写入自身 draft，空队列不占空间，也不通过全局焦点或编辑器查找桥注入内容。

### Interaction Dock

Interaction Dock 锚定输入区，承载 Suggestions、Picker、ApprovalCard 与 QuestionCard。
请求排序和生命周期归 harness，chat-tui 只呈现当前请求并回传用户 intent。

Picker 的本地搜索过滤当前选项，远端搜索展示 harness 返回的新 State。Esc 优先清空查询，
再次 Esc 才关闭 Picker，避免把编辑查询和退出选择混成同一个动作。

Dock 子组件分别声明允许的用户行为：方向键和确认通常只改变本地选中态或提交当前值；cancel
先退出 Question 的 Other 编辑、清空 Picker 查询等内层状态，再向外成为关闭 Picker、解决
Interaction 或中断 turn。一次行为只由一个输入层消费，具体传播契约见
[`input-routing.md`](input-routing.md)。

## FooterSurface

Footer 同时承载两种寿命的信息：Toast 是短寿命操作回执或错误，footer text 是用户随时可查的
常驻状态。Toast 不得替换或隐藏 footer text。需要长期回看的信息进入 Timeline，跨时间线的
当前信息进入 Sidecar。

## SidecarSurface

Sidecar 是通用、可选的辅助展示面，与主对话并列而不是放在 Footer 下方。接入方把 Board、
上下文或诊断等领域状态整理成 `SidecarState`；item 的可选 `url` 使用终端原生 hyperlink
渲染，具体鼠标打开手势由终端决定。接入方提供 `openUrl` intent 时，Sidecar 同时用
`Alt+↑/↓` 选择链接、用 `Ctrl+Enter` 打开；选中项随仍存在的 item 保持，并自动滚入视口。
第二行 detail 只在实际溢出时横向滚动，未溢出的文本保持静态。chat-tui 只展示通用
section/item，不理解其业务语义，也不直接调用宿主桌面能力。

- 没有有效条目时完全隐藏，不保留空框或宽度。
- 空间充足时以内联侧栏展示；空间不足时默认隐藏，避免挤压 Timeline 和 Composer。
- 接入方显式打开时，空间不足可改为 overlay；Esc 只上报关闭 intent。
- 显隐状态始终归接入方，chat-tui 不持有第二份领域状态。
