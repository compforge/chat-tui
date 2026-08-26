export interface RunStatusItem {
  id: string;
  author?: string;
  label: string;
  startedAt?: number;
  hint?: string;
}

export interface ActivityState {
  items?: RunStatusItem[];
  /**
   * 运行期轮换提示语料（接入方注入；chat-tui 不含语料内容）。
   * 有运行项时每 10s 轮换一条，以 dim 色 `· Tip: ...` 缀在最后一行状态尾部；
   * idle 或无 tips 时不渲染也不挂定时器。
   */
  tips?: string[];
}
