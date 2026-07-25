// chat-tui 的接入协议：接入方实现 ChatProtocol，ChatShell 负责渲染与交互。
//
//   输出（接入方 → TUI）：getView() 返回完整视图快照 + subscribe() 变更通知。
//     选快照而非增量事件：TUI 规模下全量重渲染足够便宜，接入方不用维护
//     delta 语义，本地 harness 和远端转发（SSE/WebSocket → 本地状态）实现同构。
//   输入（TUI → 接入方）：submit / command / cancel / exit / resolvePicker /
//     resolveInteraction / recallQueued。这些是用户意图（intent，MVI 语义）：TUI 已把
//     原始按键翻译成语义级请求，只表达"用户想干什么"；如何执行（发本地进程还是
//     远端、cancel 映射到哪家 provider 的 interrupt）由接入方决定。

import type {
  InteractionResponse,
  InteractionView,
  PickerView,
  PlanEntry,
  QueuedItem,
  RunStatusItem,
  StatusMessage,
  TranscriptItem,
} from "../types/index.ts";

export interface ChatViewState {
  transcript: TranscriptItem[];
  /** 有 turn 在跑：Esc 变为"打断"，输入框边框高亮 */
  busy?: boolean;
  /**
   * Provider Status 区：贴 composer 顶部的"现在时"状态行，不随历史滚动。
   * 首条为主行（当前输入目标 + 运行相位），其余为附加行（其他活跃 agent / 子 agent）。
   * 空/缺省即隐藏不占高度。
   */
  runStatus?: RunStatusItem[];
  /**
   * pin 在 composer 上方的 plan（"何时显示"归接入方：建议仅在有未完成项时下发，
   * 全部完成后停发即自动消失）；空/缺省即隐藏不占高度。
   */
  plan?: PlanEntry[];
  /** 排队中的 steer 输入（队列本体归接入方） */
  queued?: QueuedItem[];
  /** 接入方请求 TUI 弹选择浮层；用户选择/关闭通过 resolvePicker 回传 */
  picker?: (PickerView & { id: string }) | null;
  /**
   * 当前等待用户参与的请求，按展示优先级排序。InteractionDock 只展示首项并标记总数；
   * blocking、排队和持久生命周期均由接入方决定。
   */
  interactions?: InteractionView[];
  /** 瞬时状态（错误/提示），有内容时展示在常驻 footer 上方 */
  status?: StatusMessage | null;
  /** 常驻底部信息行（usage、队列长度、cwd 等） */
  footer?: string;
  composerPlaceholder?: string;
  /** 时间线顶部说明（产品名、快捷键提示） */
  header?: string;
  /** thought 消息是否渲染 */
  showThoughts?: boolean;
}

export interface ChatProtocol {
  // ===== 输出：接入方 → TUI =====
  /**
   * 返回当前视图快照。ChatShell 用 useSyncExternalStore 消费：
   * 未变化时必须返回同一对象引用（变化时换新对象），否则会触发无限重渲染。
   * 推荐实现：内部持有一个 view 对象，每次变更整体替换后再通知 subscribe 监听者。
   */
  getView(): ChatViewState;
  /** 视图变化时通知；返回取消订阅函数 */
  subscribe(onChange: () => void): () => void;

  // ===== 输入：TUI → 接入方 =====
  /** 普通消息（slash 命令已被 TUI 识别并走 command()，不会进这里） */
  submit(text: string): void | Promise<void>;
  /** 已注册 slash 命令：/name argument */
  command(name: string, argument: string): void | Promise<void>;
  /** 打断当前 turn（Esc） */
  cancel(): void;
  /** 优雅退出（/exit、双击 Ctrl+C、Ctrl+D）；进程退出由接入方决定 */
  exit(): void | Promise<void>;
  /** picker 选择结果；用户 Esc 关闭时 value 为 null */
  resolvePicker(id: string, value: string | null): void;
  /** InteractionDock 收集的统一响应；接入方按 id 与 kind 收口真实生命周期。 */
  resolveInteraction(id: string, response: InteractionResponse): void | Promise<void>;
  /** ↑ 召回最近一条排队输入（同时应将其从队列移除）；无可召回返回 null */
  recallQueued?(): { text: string } | null;
  /**
   * ↑ 历史回溯（shell 式）：把输入框内容替换成更早一条用户输入。TUI 仅在光标位于
   * 输入边界时调用（避免劫持多行光标移动），并传入当前输入；接入方据此判断是否处于
   * 连续浏览（当前文本 == 上次召回条目才继续）。返回要显示的条目，或 null 表示不导航
   * （已到最旧 / 无历史 / 用户已改动召回内容）——null 时 TUI 放行为普通光标上移。
   */
  historyPrev?(current: string): { text: string } | null;
  /** ↓ 历史前进：与 historyPrev 对称；越过最新条目时返回进入浏览前暂存的草稿。 */
  historyNext?(current: string): { text: string } | null;
}
