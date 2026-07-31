# Surface 层级与交互语义

## 理念

主对话自上而下按信息的时态与寿命分层：过去的信息进入可滚动时间线，当前状态靠近输入区，
短寿命回执固定在底部。可选 Sidecar 与主对话并列，承载跨时间线的辅助信息。

展示可以压缩信息，但不能改写事实；不同维度保持正交，未知输入显式暴露，裁剪只影响当前
视图。State、Store 与 Surface 的关系由 [`kernel.md`](kernel.md) 统一定义。带方括号的区块
是条件渲染，无内容时不占空间：

```text
┌ Main chat ─────────────────────────┬ [Sidecar] ─────────┐
│ TimelineSurface                    │ SidecarSurface      │
│   Transcript      可滚动历史（过去时）│   辅助信息           │
│   [Plan]          进行中的计划       │   section / item    │
│ ComposerSurface                    │                     │
│   [Queued]        待执行输入（将来时）│                     │
│   ActivitySurface 当前运行状态       │                     │
│   ComposerEditor  持续可编辑输入区    │                     │
│   [Interaction Dock] 补全/选择/审批  │                     │
│ FooterSurface                      │                     │
│   [Toast]         短寿命操作回执     │                     │
│   Footer text     常驻状态           │                     │
└────────────────────────────────────┴─────────────────────┘
```

## TimelineSurface

Timeline 是可滚动的过去时区域，接收 message 与 activity block 两类展示数据。接入方负责把
自身事件整理成可展示内容，chat-tui 不解释 provider 语义。

- activity block 的 `status` 表示结果，决定 icon；`tone` 表示注意或留痕，影响颜色但不改变
  结果。例如 completed + warning 仍显示完成图标。
- 未知状态不得静默伪装成某个已知结果，必须显式保留异常值。
- 消息来源与正文格式分离：role / author 只表达谁在说话，format 独立表达 plain / markdown。
- 长内容按视觉行预算折叠，diff 默认完整展示；裁剪不修改接入方传入的数据。

### Plan

当前计划固定在 Timeline 尾部、Composer 之前；空计划不占空间。是否展示及何时撤下由
harness 决定，窗口始终优先保持当前进度可见。

## ComposerSurface

Composer 位于历史区下方，是供用户持续组织和修改输入的创作面，不是只在 agent 空闲时开放的
一次性提交框。其设计优先保护尚未提交的内容，遵守三个不变量：

1. **输出与输入可以同时发生**：时间线流式更新或 agent 正在运行时，用户仍能继续编辑下一条
   输入；外部更新不得抢焦点、覆盖或清空 draft。
2. **多行是输入语义的一部分**：换行、光标位置和未提交内容必须完整保留，补全、历史和队列
   召回不能意外归一化它们。
3. **无关 State 更新不影响输入**：Sidecar、Activity 或 Footer 刷新不得让 Composer 重建
   输入 buffer；只有 Composer 真正依赖的布局或输入状态变化才参与更新。

### Queued input

Queued 展示等待执行的输入，是将来时区域；队列本体、顺序和召回语义归 harness。召回后的内容
回到 Composer 继续编辑，空队列不占空间。

### ActivitySurface

Activity 在视觉上贴近输入框，描述当前输入目标和运行相位，但保持独立渲染边界。它只展示
接入方提供的标签和时间信息，不推断 agent 生命周期。

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
渲染，具体打开手势由终端决定。第二行 detail 只在实际溢出时横向滚动，未溢出的文本保持
静态。chat-tui 只展示通用 section/item，不理解其业务语义。

- 没有有效条目时完全隐藏，不保留空框或宽度。
- 空间充足时以内联侧栏展示；空间不足时默认隐藏，避免挤压 Timeline 和 Composer。
- 接入方显式打开时，空间不足可改为 overlay；Esc 只上报关闭 intent。
- 显隐状态始终归接入方，chat-tui 不持有第二份领域状态。
