// chat-tui：终端 chat/agent 界面的组件层。视图模型进、用户意图（intents）出——
// UI 只上报"用户想干什么"（submit/cancel/command…），不执行也不解释，
// 不含任何 session / provider / 事件流语义——那些归消费方的 harness。

export * from "./types/index.ts";
export * from "./protocol/index.ts";
export * from "./utils/text.ts";
export * from "./utils/time.ts";
export * from "./components/clip.ts";
export * from "./components/diff.ts";
export * from "./components/commands.ts";
export * from "./components/completion.ts";
export * from "./components/keys.ts";
export { ChatShell, type ChatShellProps } from "./components/chat-shell.tsx";
export { Transcript, type TranscriptProps } from "./components/transcript.tsx";
export {
  Composer,
  COMPOSER_KEY_BINDINGS,
  composerHeightFor,
  type ComposerHandle,
  type ComposerProps,
} from "./components/composer.tsx";
export {
  ApprovalCard,
  Picker,
  QuestionCard,
  Suggestions,
  type ApprovalCardProps,
  type PickerProps,
  type QuestionCardProps,
  type SuggestionsProps,
} from "./components/overlays.tsx";
export {
  InteractionDock,
  type InteractionDockProps,
} from "./components/interaction-dock.tsx";
export { PlanPinned, planWindow, type PlanPinnedProps, type PlanWindow } from "./components/plan-pinned.tsx";
export { QueuedList, InputArea, queuedPreview, type QueuedListProps, type InputAreaProps } from "./components/queued.tsx";
export { RunStatus, runStatusParts, runStatusTail, type RunStatusProps } from "./components/run-status.tsx";
export { StatusLine, type StatusLineProps } from "./components/status-line.tsx";
export {
  Sidecar,
  SIDECAR_BREAKPOINT,
  SIDECAR_WIDTH,
  sidecarLayout,
  visibleSidecarSections,
  type SidecarLayout,
  type SidecarProps,
} from "./components/sidecar.tsx";
// 自定义壳（不用 ChatShell 自行组装组件）在根容器上挂一次，即可让全部可见文本获得双击选词
export { useTokenSelectionOnDoubleClick } from "./components/token-selection.ts";
