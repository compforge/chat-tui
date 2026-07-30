// chat-tui 的接入协议：接入方实现 ChatProtocol，ChatShell 负责渲染与交互。
//
//   输出（接入方 → TUI）：stateStore 提供五个可独立订阅的稳定 State。
//     Surface 通过 Store 直接订阅所需 State，避免无关区域互相触发重渲染。
//   输入（TUI → 接入方）：submit / command / cancel / exit / searchPicker / resolvePicker /
//     resolveInteraction / recallQueued。这些是用户意图（intent，MVI 语义）：TUI 已把
//     原始按键翻译成语义级请求，只表达"用户想干什么"；如何执行（发本地进程还是
//     远端、cancel 映射到哪家 provider 的 interrupt）由接入方决定。

import type { ChatStore } from "../store/chat-store.ts";
import type { InteractionResponse } from "./interaction.ts";

export interface ChatProtocol {
  // ===== 输出：接入方 → TUI =====
  /** State 的发布与订阅入口；接入方通常用 createChatStore 创建并提交。 */
  readonly stateStore: ChatStore;

  // ===== 输入：TUI → 接入方 =====
  /** 普通消息（slash 命令已被 TUI 识别并走 command()，不会进这里） */
  submit(text: string): void | Promise<void>;
  /** 已注册 slash 命令：/name argument */
  command(name: string, argument: string): void | Promise<void>;
  /** 打断当前 turn（Esc） */
  cancel(): void;
  /** 切换到下一个接入方定义的工作模式（Shift+Tab）；未实现时保留普通按键行为。 */
  cycleMode?(): void | Promise<void>;
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
