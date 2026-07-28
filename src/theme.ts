/** 配色主题。默认值取自 tokyo-night，消费方可整体或逐项覆盖。 */
export interface Theme {
  dim: string;
  /** 运行状态词（thinking / compacting 等）的强调色；省略时回落 accent。 */
  runStatus?: string;
  user: string;
  agent: string;
  tool: string;
  plan: string;
  success: string;
  error: string;
  /** declined 等"被拒绝/需注意"状态色；区别于 error（执行出错）与 success */
  warning: string;
  accent: string;
  border: string;
  borderActive: string;
  /** 绝对定位浮层的实色背景；必须不透明，避免下层 transcript 透出。 */
  overlayBackground?: string;
  /** diff 行背景；省略时使用透明背景，只保留 +/- 状态色。 */
  diffAddedBg?: string;
  diffRemovedBg?: string;
  /** 按 author 名着色 agent 消息；返回 undefined 时用 theme.agent */
  agentColorFor?: (author: string) => string | undefined;
}

export const defaultTheme: Theme = {
  dim: "#565f89",
  runStatus: "#bb9af7",
  user: "#7aa2f7",
  agent: "#bb9af7",
  tool: "#e0af68",
  plan: "#7dcfff",
  success: "#9ece6a",
  error: "#f7768e",
  warning: "#ff9e64",
  accent: "#7aa2f7",
  border: "#3b4261",
  borderActive: "#e0af68",
  overlayBackground: "#24283b",
  diffAddedBg: "#1f342d",
  diffRemovedBg: "#3b252d",
};
