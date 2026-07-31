// Ctrl+C 的分层语义（纯逻辑，可单测）：有输入 → 清空并进入退出确认窗口；
// 无输入 → 进入退出确认窗口；窗口内再按一次 → 退出。

export const CTRL_C_CONFIRM_WINDOW_MS = 1500;

export type CtrlCAction = "clear-draft" | "arm-exit" | "exit";
export function ctrlCAction(state: {
  hasDraft: boolean;
  /** 上一次清空草稿或空输入按下 Ctrl+C 的时间戳；从未按过传 0 */
  armedAt: number;
  now: number;
}): CtrlCAction {
  if (state.armedAt > 0 && state.now - state.armedAt < CTRL_C_CONFIRM_WINDOW_MS) return "exit";
  if (state.hasDraft) return "clear-draft";
  return "arm-exit";
}
