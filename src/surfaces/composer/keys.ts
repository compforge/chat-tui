// 按键所有权约定——按"是否争用"划分，不按"是否全局"收权：
// - 争用键（多个 context 抢同一个键，如 Esc/Ctrl+C）：优先级决策必须收敛到本文件的
//   纯函数（context 入参 → 语义 action 出参）+ tests/keys.test.ts 表格测试；
//   组件只执行返回的 action，不得在 handler 里直接写 if 分支定优先级。
//   （曾因 ChatShell handler 内分支顺序导致 Esc 语义失效，故有此约定。）
// - 争用键的默认优先级语义是"局部优先"：最内层局部交互先消费按键，没有局部交互时
//   才轮到全局动作（中断 turn / 退出）。Ctrl+C 不参与 turn 控制，只负责清空 composer
//   与二次确认退出；中断统一归 Esc。
// - 无争用的局部键（如 Transcript 的 Ctrl+O）：允许就地 useKeyboard 注册，
//   但必须 preventDefault 并注释说明为什么归属该组件，保持特性对 ChatShell 透明。
//
// Ctrl+C 的分层语义（纯逻辑，可单测）：有输入 → 清空并进入退出确认窗口；
// 无输入 → 进入退出确认窗口；窗口内再按一次 → 退出。

export const CTRL_C_CONFIRM_WINDOW_MS = 1500;

export type CtrlCAction = "clear-draft" | "arm-exit" | "exit";
export type EscapeAction = "cancel-turn" | "close-picker" | "dismiss-suggestions" | "none";

/** 争用键"局部优先"（见文件头约定）的实例：Esc 先退出最内层局部交互（picker > 补全候选）；没有可关闭的 popup 时才中断运行中的 turn。 */
export function escapeAction(state: {
  busy: boolean;
  hasPicker: boolean;
  hasCandidates: boolean;
}): EscapeAction {
  if (state.hasPicker) return "close-picker";
  if (state.hasCandidates) return "dismiss-suggestions";
  if (state.busy) return "cancel-turn";
  return "none";
}

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
