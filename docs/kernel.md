# Kernel：核心模型与代码边界

## 理念

chat-tui 负责“怎么展示、怎么收集输入”，harness 负责“agent 在做什么”。两者只交换展示
State 与用户 intent，不把 session、turn、provider 或上游事件模型带入组件层；因此本地 agent
loop 与远端转发可以共用同一套 UI。

Kernel 由三个彼此独立的概念组成：

- **State** 是数据组织单元，描述某类界面信息的完整快照。
- **Store** 负责发布和订阅 State，只把变化通知给对应消费者。
- **Surface** 是独立渲染单元，直接声明自己消费哪些 State。

三者自然相关，但不要求一一对应：一个 Surface 可以组合多个 State，一个 State 也可以被多个
Surface 以不同 selector 消费。`ChatProtocol` 则承接反方向的用户 intent。

## 流程

```text
provider / product events
          │
          ▼
       harness ── commit(State patch) ──▶ Store ──▶ Surface
          ▲                                      │
          └────────── ChatProtocol intent ◀──────┘
```

harness 先把自身事件整理成当前应展示的 State，再通过 Store 原子发布；chat-tui 不维护第二套
增量事件协议，也不尝试重放 provider 事件。用户按键先经输入层路由到当前组件声明的语义行为；
纯 UI 行为就地完成，需要改变 harness 状态的行为再经 `ChatProtocol` 交还接入方执行。完整路由
契约见 [`input-routing.md`](input-routing.md)。

## 关键设计

### State 与 Store

- `stateStore` 发布 `timeline`、`composer`、`activity`、`footer`、`sidecar` 五个稳定
  State。未变化的 State 保持引用不变，也不通知订阅者。
- `commit(patch)` 是原子提交：多路新快照先全部可见，再通知发生变化的 State。
- State 是展示数据，不是上游事件。接入方保有业务真相源和 durable lifecycle，chat-tui
  只消费当下应展示的结果。

### Surface

默认组合关系如下；这是数据边界与渲染边界的对应关系，不是注册表：

| Surface | 消费的 State | 职责 |
|---|---|---|
| `TimelineSurface` | `timeline` | 历史消息、活动块与当前计划 |
| `ComposerSurface` | `composer`、`sidecar` 的布局 selector | 输入、补全与待处理交互 |
| `ActivitySurface` | `activity` | 当前输入目标与运行状态 |
| `FooterSurface` | `footer` | 短寿命回执与常驻状态 |
| `SidecarSurface` | `sidecar` | 与主时间线并列的辅助信息 |

`ChatShell` 只编排 Surface，不订阅具体 State。Sidecar 内容刷新时，只有订阅到新值的 Surface
参与更新；布局没有变化时，Composer 及其输入 buffer 不参与刷新。

### Intent 与注入点

- `submit`、`command`、`cancel` 与 `exit` 表达基础输入意图。
- Picker 与 Interaction 通过稳定 ID 返回结果；Sidecar 关闭和历史导航使用独立 intent。
  请求执行、排队、取消和过期结果处理归 harness。
- slash 命令表、`@` 引用源、theme 与裁剪策略由接入方注入，chat-tui 不内置具体产品或
  provider 语义。

### 代码边界

- `state/` 只定义公开数据形状，不依赖 React、OpenTUI 或 Store。
- `store/` 拥有发布订阅契约与 React 订阅桥，不解释任何 State 的业务含义。
- `protocol/` 定义 TUI 到 harness 的 intent 契约。
- `surfaces/<surface>/` 同时拥有该 Surface、子组件和纯逻辑；规则优先写成纯函数，组件只做
  状态连接和渲染。
- `terminal/` 只承载多个 Surface 真正共用的终端原语，带界面领域语义的逻辑留在所属 Surface。
- `shell/` 拥有布局组合及真正跨 Surface 的交互，不代理具体 State。
- `input/` 拥有跨组件共用的输入路由运行时与层级约定，不拥有具体 Surface 行为。
- 根 `index.ts` 是唯一公开入口；内部路径不是兼容边界。

### 验证约束

纯逻辑通过单元测试覆盖边界与状态转换；Store 通过契约测试保证原子发布和定向通知；涉及输入
隔离的交互通过真实渲染测试保证外部 State 刷新不会重建 textarea、丢失焦点或清空 draft。
