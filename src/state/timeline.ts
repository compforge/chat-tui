export type TranscriptBlockStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "declined";

export type BlockTone = "warning";
export type PlanEntryStatus = "pending" | "in_progress" | "completed";

export interface PlanEntry {
  content: string;
  status: PlanEntryStatus;
}

export type MessageFormat = "plain" | "markdown";
export type DiffOp = "add" | "modify" | "delete" | "move";

// A content kind earns a variant only when chat-tui gives it distinct rendering
// or clipping behavior. Provider-specific payloads stay outside this contract.
export type TranscriptBlockContent =
  | { type: "text"; text: string }
  | { type: "lines"; lines: string[] }
  | { type: "plan"; entries: PlanEntry[] }
  | { type: "code"; code: string; language: string }
  | { type: "command"; command: string; language?: string }
  | { type: "output"; lines: string[] }
  | {
      type: "diff";
      op: DiffOp;
      path: string;
      oldPath?: string;
      patch?: string;
    };

export type TranscriptItem =
  | {
      type: "message";
      id: string;
      role: "user" | "agent";
      author?: string;
      text: string;
      format?: MessageFormat;
      streaming?: boolean;
    }
  | {
      type: "block";
      id: string;
      kind: string;
      status: TranscriptBlockStatus;
      tone?: BlockTone;
      author?: string;
      title: string;
      content?: TranscriptBlockContent | TranscriptBlockContent[];
    };

export interface TimelineState {
  items: TranscriptItem[];
  plan?: PlanEntry[];
  header?: string;
  showThoughts?: boolean;
}
