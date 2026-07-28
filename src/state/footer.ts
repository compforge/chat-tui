export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  text: string;
  tone: ToastTone;
}

export interface FooterState {
  toast?: ToastMessage | null;
  text?: string;
}
