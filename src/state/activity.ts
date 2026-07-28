export interface RunStatusItem {
  id: string;
  author?: string;
  label: string;
  startedAt?: number;
  hint?: string;
}

export interface ActivityState {
  items?: RunStatusItem[];
}
