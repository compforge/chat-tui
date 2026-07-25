# AGENTS.md

## 项目定位与边界

chat-tui 是终端 chat/agent 界面的**组件层**（基于 opentui + react）：把 Claude Code / Codex 式 CLI 的交互面——多行输入、slash/@ 补全、流式 transcript、tool 卡片、审批浮层、分层 Ctrl+C——做成可复用组件，接入方实现一个小 protocol 即得到完整 chat TUI。

边界（比"提供什么"更重要）：**不含任何 session / turn / provider / 事件流语义**。那些归接入方的 harness 层。判断新代码该不该进本仓：它是否需要理解"agent 在干什么"？需要 → harness；只关心"怎么画、怎么收输入" → 本仓。

## 代码地图与核心模块

目录布局：`utils/` 只放**真通用原语**；每个概念的**纯逻辑与它的渲染同放在 `components/`**（读一个概念不用跨目录拼）。

```
chat-tui/
├── src/
│   ├── index.ts             # 唯一对外入口（package exports 直指 TS 源码，无构建步骤）
│   ├── protocol/index.ts    # ChatProtocol：视图快照进（getView/subscribe）、intents 出
│   ├── types/index.ts       # 视图模型（TranscriptItem 等）+ Theme
│   ├── utils/               # 只放真通用原语：无 chat-tui 业务语义，换个终端 App 也能用
│   │   ├── text.ts          # 终端文本：显示宽度度量、行清洗、按显示宽度 wrap（clip 与 selection 共用）
│   │   └── time.ts          # 时长格式化（mm:ss / h:mm:ss）
│   └── components/          # 每个概念 = 渲染 + 它自己的纯逻辑（就近同放，纯逻辑照样单测）
│       ├── chat-shell.tsx   # 一站式壳：protocol → 全套组件 + 键盘/焦点/draft 编排
│       ├── keys.ts          # Ctrl+C / Esc 分层语义状态机
│       ├── transcript.tsx   # 时间线：消息 + activity block；内容按预算折叠，Ctrl+O 展开
│       ├── block.ts         # block 展示态双轴（outcome × tone）→ icon/color 合成
│       ├── clip.ts          # 高度预算：ClipPolicy（可注入）+ 按视觉行裁剪
│       ├── diff.ts          # diff 行数与增删统计
│       ├── selection.ts     # 选择几何：token 列范围 / 视觉行定位
│       ├── token-selection.ts # 双击选词的鼠标 hook（只在壳根容器挂一次，靠事件冒泡覆盖全部文本）
│       ├── composer.tsx     # 多行输入框 + ComposerHandle（setText/clear/focus）
│       ├── commands.ts      # slash 命令识别（唯一前缀匹配）
│       ├── completion.ts    # / 与 @ 触发识别、候选构建（命令表/引用源注入）、补全应用
│       ├── overlays.tsx     # Suggestions / Picker / ApprovalCard / QuestionCard（底部锚定浮层）
│       ├── overlay-card.ts  # 浮层卡片统一布局预算：操作/选项行优先保底、详情分剩余、截断留痕
│       ├── approval.ts      # 审批卡布局（overlay-card 实例化）：先留操作行，剩余给详情
│       ├── question.ts      # 问题卡布局（overlay-card 实例化）：选项行优先，焦点详情限行留痕
│       ├── plan-pinned.tsx  # composer 上方的 plan pin + planWindow（对准第一个未完成项）
│       ├── queued.tsx       # steer 队列展示 + queuedPreview
│       ├── run-status.tsx   # 固定运行状态区（elapsed 跳秒自持）+ runStatusParts 文案拼装
│       ├── sidecar.tsx      # 可选右侧辅助视图；宽屏内联、窄屏按需 overlay、空数据隐藏
│       └── status-line.tsx  # 底部状态行（瞬时 status 优先，回落 footer）
├── examples/echo.tsx        # 假 harness 全交互演示：bun examples/echo.tsx
└── tests/                   # bun test；只测纯逻辑，组件靠 typecheck + example 人工验证
```

运行时 Bun。验证命令：`bun run check`（typecheck + test）。

## 关键约定

- **边界以是否理解 agent 语义为准**：chat-tui 只接收展示快照、产出用户 intent，不拥有 session / turn / provider / 事件流语义；具体命令、引用源和 theme 均由接入方注入。协议边界与快照契约见 `docs/protocol.md`。
- **展示必须诚实且保持语义正交**：展示模型不冒充上游事件，结果、提示、来源和正文格式各自表达；未知值显式暴露，不静默伪装成已知状态。具体投影与裁剪规则见 `docs/presentation.md`。
- **主对话按信息时态分层，Sidecar 是可选正交读模型**：主区自上而下是 Transcript → [Plan] → [Queued] → Composer（含 Provider Status / 浮层）→ [Feedback] → Footer；Sidecar 与主区并列且空数据完全隐藏。流式输出不能妨碍用户继续组织多行 draft。区块职责与输入体验原则统一见 `docs/presentation.md`。
- **实现以纯逻辑和概念内聚为先**：交互/展示规则优先写成可测试的纯函数，组件只做粘合；概念逻辑与渲染同放，`utils/` 只容纳可跨终端应用复用的原语。实现细则见 `docs/implementation.md`。

## References

- `README.md` — 对外文档：protocol 表、快速上手、能力清单
- `docs/protocol.md` — chat-tui 与 harness 的协议边界、快照契约和注入点
- `docs/presentation.md` — 界面区块、时态分层、展示语义与视觉行预算
- `docs/implementation.md` — 纯逻辑组织、通用原语边界和全局交互实现约束
