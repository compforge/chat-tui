# AGENTS.md

## 项目定位与边界

chat-tui 是终端 chat/agent 界面的**组件层**（基于 opentui + react）：把 Claude Code / Codex 式 CLI 的交互面——多行输入、slash/@ 补全、流式 transcript、tool 卡片、审批浮层、分层 Ctrl+C——做成可复用组件，接入方实现一个小 protocol 即得到完整 chat TUI。

边界（比"提供什么"更重要）：**不含任何 session / turn / provider / 事件流语义**。那些归接入方的 harness 层。判断新代码该不该进本仓：它是否需要理解"agent 在干什么"？需要 → harness；只关心"怎么画、怎么收输入" → 本仓。

## 代码地图与核心模块

目录直接兑现 State / Store / Surface 边界：公开数据形状、发布机制和渲染单元分别演进；
每个 Surface 的纯逻辑与组件按界面领域就近放置。

```
chat-tui/
├── src/
│   ├── index.ts             # 唯一对外入口（package exports 直指 TS 源码，无构建步骤）
│   ├── state/               # 五个 State 的公开数据形状；纯 TypeScript，不依赖 React/OpenTUI
│   ├── store/               # Store 契约、ChatStore 实现与 React 订阅桥
│   ├── protocol/            # ChatProtocol 与 TUI → harness 的 intent 契约
│   ├── shell/               # ChatShell 组合与全局文本选择；不订阅具体 State
│   ├── surfaces/            # Timeline / Composer / Activity / Footer / Sidecar
│   │   └── <surface>/       # Surface、组件和纯逻辑按同一界面领域内聚
│   ├── terminal/            # 显示宽度、换行与时间格式等终端原语
│   └── theme.ts             # Theme 契约与默认主题
├── examples/echo.tsx        # 假 harness 全交互演示：bun examples/echo.tsx
└── tests/                   # 镜像 store / shell / surfaces 的契约与渲染回归测试
```

运行时 Bun。验证命令：`bun run check`（typecheck + test）。

## 关键约定

- **边界以是否理解 agent 语义为准**：chat-tui 只接收展示 State、产出用户 intent，不拥有 session / turn / provider / 事件流语义；具体命令、引用源和 theme 均由接入方注入。核心模型与协议边界见 `docs/kernel.md`。
- **展示必须诚实且保持语义正交**：展示数据不冒充上游事件，结果、提示、来源和正文格式各自表达；未知值显式暴露，不静默伪装成已知状态。具体展示与裁剪规则见 `docs/surfaces.md`。
- **State / Store / Surface 各司其职**：State 是数据组织单元，Store 负责发布和订阅，Surface 是独立渲染单元；三者相关但不要求一一对应。无关 State 更新不能让 Composer 丢焦点、重建 buffer 或清空 draft。具体边界见 `docs/kernel.md`。
- **实现以纯逻辑和领域内聚为先**：交互/展示规则优先写成可测试的纯函数，组件只做粘合；逻辑归所属 Surface，只有跨 Surface 的终端原语进入 `terminal/`。内部路径不是兼容边界，公开 API 只由根 `index.ts` 定义。代码边界见 `docs/kernel.md`。
- **争用键走分层行为路由**：组件声明语义 command 与 binding，最高活跃层处理后即停止；返回 `false` 才向外层或聚焦控件传播。原始 KeyEvent 不进入 ChatProtocol，完整契约见 `docs/input-routing.md`。

## References

- `README.md` — 对外文档：protocol 表、快速上手、能力清单
- `docs/kernel.md` — State / Store / Surface 核心模型、双向流程与代码边界
- `docs/surfaces.md` — Surface 区块、时态分层、展示语义与视觉行预算
- `docs/input-routing.md` — 键盘行为、输入层级、传播终止与 protocol 边界
