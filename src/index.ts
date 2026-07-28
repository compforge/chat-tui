// Public API. Internal paths are intentionally not compatibility boundaries.

export * from "./state/chat.ts";
export * from "./state/timeline.ts";
export * from "./state/composer.ts";
export * from "./state/activity.ts";
export * from "./state/footer.ts";
export * from "./state/sidecar.ts";
export * from "./protocol/chat-protocol.ts";
export * from "./protocol/command.ts";
export * from "./protocol/interaction.ts";
export * from "./store/chat-store.ts";
export { type Store } from "./store/contract.ts";
export { useStoreSelector, useStoreState } from "./store/react.ts";
export * from "./theme.ts";
export * from "./terminal/text.ts";
export * from "./terminal/time.ts";

export { ChatShell, type ChatShellProps } from "./shell/chat-shell.tsx";
export {
  tokenColumnRange,
  visualLineAt,
  type ColumnRange,
} from "./shell/selection.ts";
export { useTokenSelectionOnDoubleClick } from "./shell/token-selection.ts";

export {
  TimelineSurface,
  type TimelineSurfaceProps,
} from "./surfaces/timeline/surface.tsx";
export {
  Transcript,
  type TranscriptProps,
} from "./surfaces/timeline/transcript.tsx";
export * from "./surfaces/timeline/clip.ts";
export * from "./surfaces/timeline/diff.ts";
export { blockStatus, type BlockStatusDisplay } from "./surfaces/timeline/block.ts";
export {
  PlanPinned,
  planWindow,
  type PlanPinnedProps,
  type PlanWindow,
} from "./surfaces/timeline/plan.tsx";

export {
  ComposerSurface,
  type ComposerSurfaceProps,
} from "./surfaces/composer/surface.tsx";
export {
  ComposerEditor,
  COMPOSER_KEY_BINDINGS,
  composerHeightFor,
  type ComposerEditorProps,
  type ComposerHandle,
} from "./surfaces/composer/editor.tsx";
export * from "./surfaces/composer/commands.ts";
export * from "./surfaces/composer/completion.ts";
export * from "./surfaces/composer/keys.ts";
export {
  QueuedList,
  InputArea,
  queuedPreview,
  type QueuedListProps,
  type InputAreaProps,
} from "./surfaces/composer/queued.tsx";
export {
  Picker,
  visiblePickerOptions,
  type PickerProps,
} from "./surfaces/composer/interactions/picker.tsx";
export {
  Suggestions,
  type SuggestionsProps,
} from "./surfaces/composer/interactions/suggestions.tsx";
export {
  ApprovalCard,
  type ApprovalCardProps,
} from "./surfaces/composer/interactions/approval-card.tsx";
export {
  QuestionCard,
  type QuestionCardProps,
} from "./surfaces/composer/interactions/question-card.tsx";
export {
  InteractionDock,
  type InteractionDockProps,
} from "./surfaces/composer/interactions/dock.tsx";
export {
  approvalCardLayout,
  type ApprovalCardLayout,
} from "./surfaces/composer/interactions/approval.ts";
export {
  questionCardLayout,
  type QuestionCardLayout,
} from "./surfaces/composer/interactions/question.ts";

export {
  ActivitySurface,
  type ActivitySurfaceProps,
} from "./surfaces/activity/surface.tsx";
export {
  RunStatus,
  runStatusParts,
  runStatusTail,
  type RunStatusProps,
} from "./surfaces/activity/run-status.tsx";

export {
  FooterSurface,
  type FooterSurfaceProps,
} from "./surfaces/footer/surface.tsx";
export { ToastLine, type ToastLineProps } from "./surfaces/footer/toast-line.tsx";

export {
  SidecarSurface,
  type SidecarSurfaceProps,
} from "./surfaces/sidecar/surface.tsx";
export {
  Sidecar,
  type SidecarProps,
} from "./surfaces/sidecar/sidecar.tsx";
export {
  SIDECAR_BREAKPOINT,
  SIDECAR_WIDTH,
  sidecarLayout,
  visibleSidecarSections,
  type SidecarLayout,
} from "./surfaces/sidecar/layout.ts";
