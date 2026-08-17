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

export interface TranscriptMessageItem {
  type: "message";
  id: string;
  role: "user" | "agent";
  author?: string;
  text: string;
  format?: MessageFormat;
  streaming?: boolean;
}

export interface TranscriptBlockItem {
  type: "block";
  id: string;
  kind: string;
  status: TranscriptBlockStatus;
  tone?: BlockTone;
  author?: string;
  title: string;
  content?: TranscriptBlockContent | TranscriptBlockContent[];
}

/**
 * A render-only container for adjacent blocks. Producers own grouping semantics;
 * chat-tui only keeps the group identity stable and renders its compact summary.
 * Members are deliberately blocks rather than TranscriptItem so groups cannot nest.
 */
export interface TranscriptGroupItem {
  type: "group";
  id: string;
  /** Compact row shown while the group is collapsed. */
  summary?: TranscriptBlockItem;
  /** Complete semantic blocks retained for transcript-wide expansion. */
  members: TranscriptBlockItem[];
  /** Only groups with a summary can collapse. */
  collapsedByDefault?: boolean;
}

export type TranscriptItem =
  | TranscriptMessageItem
  | TranscriptBlockItem
  | TranscriptGroupItem;

export interface TimelineState {
  items: TranscriptItem[];
  plan?: PlanEntry[];
  header?: string;
  showThoughts?: boolean;
}
