// chat-tui 的对外契约：视图模型进、用户意图（intents）出。
// intent 取 MVI 语义：UI 把原始输入翻译成"用户想干什么"（Esc → cancel、"/model x" → command）
// 再上抛，只表达意愿、不执行也不解释——意图如何落地归 harness。
// 刻意不定义 session / turn / provider / 事件流语义——那些归消费方的 harness 层；
// 消费方把自家状态 reduce/映射成这里的视图形状（这层映射越薄，说明 harness 的事件模型越健康）。

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  text: string;
  tone: ToastTone;
}

// 展示态分两根正交轴：outcome（结果如何）与 tone（是否需留意）。
// outcome = TranscriptBlockStatus：块的生命周期/终局。declined 是一等成员而非 failed 的别名——
// 被（用户/策略）拒绝 ≠ 执行出错，图标与颜色都不同，避免"没跑过的操作"被渲染成"跑挂了"。
export type TranscriptBlockStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "declined";

// tone = 正交于 outcome 的"注意/留痕"轴。warning：跑了但需留痕（如自动审批批准的操作）——
// 它是加在 outcome 上的一层，而不是替换 outcome：一个 completed 的块可带 warning tone
// （✓ 完成 + 警示色），不必把结果丢成 warning。缺省无 tone。
export type BlockTone = "warning";
export type PlanEntryStatus = "pending" | "in_progress" | "completed";

/** plan 的单个条目；transcript plan 块与 composer 上方的 pinned plan 共用此形状 */
export interface PlanEntry {
  content: string;
  status: PlanEntryStatus;
}
export type MessageFormat = "plain" | "markdown";

/** diff 内容块的文件操作语义：用于文件标题与路径表达；patch 统一按完整 unified diff 展示。 */
export type DiffOp = "add" | "modify" | "delete" | "move";

// 新增成员的门槛：chat-tui 需要为它提供不同的渲染/折叠策略；
// 成员命名的是"展示待遇"（怎么高亮、往哪头截断），不是接入方的内容语义。
export type TranscriptBlockContent =
  | { type: "text"; text: string }
  | { type: "lines"; lines: string[] }
  | { type: "plan"; entries: PlanEntry[] }
  | { type: "code"; code: string; language: string }
  /** 命令源码（如工具执行的 shell 命令）：语法高亮，language 缺省按 shell */
  | { type: "command"; command: string; language?: string }
  /** 执行输出：弱化颜色与命令源码区分；超预算时按视觉行折叠（Ctrl+O 展开），接入方传全量行即可 */
  | { type: "output"; lines: string[] }
  /**
   * 单个文件操作。op 必填，避免展示层猜测文件操作语义。
   * patch 若提供必须是标准 unified diff（含 `---`/`+++`/`@@` 头）——行号视图信任
   * 这一点，非法 patch 会渲染成错误提示；delete/move 可不带 patch。多文件改动传多个 diff 块。
   */
  | { type: "diff"; op: DiffOp; path: string; oldPath?: string; patch?: string };

/**
 * 时间线展示形状。消费方把 agent 事件归一成普通消息或 activity block；
 * block content 已完成展示侧格式化，chat-tui 不理解 diff 等 provider 内容语义。
 */
export type TranscriptItem =
  | {
      type: "message";
      id: string;
      role: "user" | "agent";
      /** 展示名（如 "you" / "codex" / "claude"）；缺省时按 role 取默认 */
      author?: string;
      text: string;
      /** 正文展示格式；缺省保持纯文本，避免把未知来源内容误解释为 Markdown。 */
      format?: MessageFormat;
      /** Markdown 是否仍在增量追加；完成后设 false 以收束尾部未稳定 token。 */
      streaming?: boolean;
    }
  | {
      type: "block";
      id: string;
      /** 展示类型，如 thought / tool / plan；开放字符串便于接入方扩展。 */
      kind: string;
      /** outcome 轴：块的结果/生命周期。表"结果如何"。 */
      status: TranscriptBlockStatus;
      /** tone 轴（正交于 status）：块是否需留意/留痕。缺省无。表"是否需留意"，不替换 status。 */
      tone?: BlockTone;
      /** 展示名（如 "codex"），语义对齐 message.author：多 agent 时间线标注活动归属；缺省不展示。 */
      author?: string;
      title: string;
      /** 多段内容用于组合命令源码、输出预览、diff 等展示块；单段写法保持兼容。 */
      content?: TranscriptBlockContent | TranscriptBlockContent[];
    };

/**
 * Provider Status 区（贴 composer 顶部）的一条状态行（"现在时"信息：输入目标 / 运行相位）。
 * 阶段语义归消费方：chat-tui 只负责渲染与 elapsed 跳秒，不理解 label 含义。
 */
export interface RunStatusItem {
  id: string;
  /** 谁在跑（展示名，如 "codex"）；着色沿用 theme.agentColorFor，与 transcript 同源同色 */
  author?: string;
  /** 已格式化的状态文案，如 "Compacting context…" */
  label: string;
  /** epoch ms；提供时 TUI 渲染 elapsed 并自行每秒刷新，消费方无需为跳秒重发快照 */
  startedAt?: number;
  /** 操作提示，如 "Esc to interrupt" */
  hint?: string;
}

export interface ApprovalOption {
  optionId: string;
  name: string;
  kind: string;
}

export interface ApprovalView {
  title: string;
  /** 待审批操作的完整详情；title 保持短小，长命令/路径放这里。 */
  description?: string;
  options: ApprovalOption[];
}

export interface QuestionOption {
  label: string;
  description: string;
  preview?: string;
}

export interface QuestionPrompt {
  id: string;
  header: string;
  question: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  allowOther?: boolean;
  /** 接入方可据此选择更安全的输入控件；默认组件暂不做终端级遮罩。 */
  secret?: boolean;
}

export interface QuestionView {
  questions: QuestionPrompt[];
}

export type QuestionAnswers = Record<string, string[]>;

interface InteractionViewBase {
  /** Stable identity owned by the consumer; chat-tui only echoes it in intents. */
  id: string;
  /** Display-ready source label, such as "codex" or "turn-coach". */
  requester?: string;
  /** Whether progress is waiting for this interaction to resolve. */
  blocking: boolean;
}

/**
 * A current request for human participation. Variants keep their own payloads;
 * the shared shape only drives InteractionDock ordering and attribution.
 */
export type InteractionView =
  | (InteractionViewBase & {
      kind: "approval";
      approval: ApprovalView;
    })
  | (InteractionViewBase & {
      kind: "question";
      question: QuestionView;
    })
  | (InteractionViewBase & {
      kind: "suggested_input";
      title: string;
      text: string;
    });

export type InteractionResponse =
  | { kind: "approval"; optionId: string }
  | { kind: "question"; answers: QuestionAnswers }
  | { kind: "suggested_input"; outcome: "submitted"; text: string }
  | { kind: "suggested_input"; outcome: "dismissed" };

export interface PickerOption {
  name: string;
  description: string;
  value: string;
}

export interface PickerView {
  title: string;
  options: PickerOption[];
}

export interface QueuedItem {
  id: string;
  text: string;
  /** 右侧标注（如目标 provider 名） */
  tag?: string;
}

export type SidecarItemTone = "default" | "muted" | "success" | "warning" | "error";

/** Sidecar 的通用展示条目；业务状态与分组语义由接入方提前投影。 */
export interface SidecarItem {
  id: string;
  title: string;
  status?: string;
  detail?: string;
  tone?: SidecarItemTone;
}

export interface SidecarSection {
  id: string;
  title?: string;
  items: SidecarItem[];
}

/**
 * 与主对话并列的可选辅助视图。无有效条目时 ChatShell 完全隐藏 Sidecar；
 * mode 缺省为 auto：宽屏内联，窄屏隐藏。
 */
export interface SidecarView {
  title?: string;
  sections: SidecarSection[];
  mode?: "auto" | "open" | "hidden";
}

/** slash 命令声明：chat-tui 只用于补全候选，语义执行归消费方 */
export interface CommandSpec {
  name: string;
  description: string;
}

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
