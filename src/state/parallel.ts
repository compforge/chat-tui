/** One current unit of parallel work; its runtime origin remains caller-owned. */
export interface ParallelItem {
  id: string;
  icon?: string;
  name: string;
  description?: string;
  /** Display-ready progress such as `queued`, `running`, or `2/5`. */
  progress?: string;
  tokens?: number;
  /** Presence adds elapsed time; lifecycle still belongs to the caller. */
  startedAt?: number;
}

export interface ParallelState {
  items: ParallelItem[];
}
