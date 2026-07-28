export interface ApprovalOption {
  optionId: string;
  name: string;
  kind: string;
}

export interface ApprovalView {
  title: string;
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
  secret?: boolean;
}

export interface QuestionView {
  questions: QuestionPrompt[];
}

interface InteractionViewBase {
  id: string;
  requester?: string;
  blocking: boolean;
}

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

export interface PickerOption {
  name: string;
  description: string;
  value: string;
}

export interface PickerSearchView {
  mode: "local" | "remote";
  query?: string;
  placeholder?: string;
  loading?: boolean;
}

export interface PickerView {
  title: string;
  options: PickerOption[];
  search?: PickerSearchView;
}

export interface QueuedItem {
  id: string;
  text: string;
  tag?: string;
}

export interface ComposerState {
  busy?: boolean;
  queued?: QueuedItem[];
  picker?: (PickerView & { id: string }) | null;
  interactions?: InteractionView[];
  placeholder?: string;
}
