/** Queue actions are capabilities supplied by the harness for each item. */
export type QueueItemAction =
  | "recall"
  | "discard"
  | "move-up"
  | "move-down"
  | "dispatch-now";

export interface QueueItemView {
  id: string;
  text: string;
  tag?: string;
  actions?: readonly QueueItemAction[];
}

export interface QueueState {
  items: QueueItemView[];
  /** Presence opens the interactive queue pane; lifecycle remains harness-owned. */
  manager?: { title?: string } | null;
}
