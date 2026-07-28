// chat-tui 的接入协议：接入方实现 ChatProtocol，ChatShell 负责渲染与交互。
//
//   输出（接入方 → TUI）：surfaces 提供五个独立订阅的稳定快照。
//     getView() + subscribe() 是兼容入口；新接入方应提供 surfaces，避免无关
//     read model 变化让 timeline / composer / activity / footer / sidecar 互相触发重渲染。
//   输入（TUI → 接入方）：submit / command / cancel / exit / searchPicker / resolvePicker /
//     resolveInteraction / recallQueued。这些是用户意图（intent，MVI 语义）：TUI 已把
//     原始按键翻译成语义级请求，只表达"用户想干什么"；如何执行（发本地进程还是
//     远端、cancel 映射到哪家 provider 的 interrupt）由接入方决定。

import type {
  InteractionResponse,
} from "../types/index.ts";
import type { ChatSurfaces } from "./surfaces.ts";
import type { ChatViewState } from "./view.ts";

export type { ChatViewState } from "./view.ts";

export interface ChatProtocol {
  // ===== 输出：接入方 → TUI =====
  /**
   * 五个 Surface 各自订阅的 read model。存在时 ChatShell 不再订阅完整 getView()；
   * 接入方通常用 createChatSurfaceStore 创建并提交。
   */
  surfaces?: ChatSurfaces;
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
  /** 远端搜索型 picker 的查询变化；debounce、取消与结果归并由接入方负责。 */
  searchPicker(id: string, query: string): void | Promise<void>;
  /** InteractionDock 收集的统一响应；接入方按 id 与 kind 收口真实生命周期。 */
  resolveInteraction(id: string, response: InteractionResponse): void | Promise<void>;
  /** 窄屏 overlay 的 Esc 关闭意图；显示状态仍由下一份视图快照决定。 */
  dismissSidecar?(): void;
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
