import type { ReactNode } from "react";

import { defaultTheme, type Theme, type ToastMessage, type ToastTone } from "../types/index.ts";

export interface ToastLineProps {
  /** 瞬时提示；存在时展示在 footer 上方。 */
  toast: ToastMessage | null;
  /** 常驻信息行（usage、队列长度、cwd 等） */
  fallback: string;
  theme?: Theme;
}

function toastColor(tone: ToastTone, theme: Theme): string {
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.warning;
  if (tone === "error") return theme.error;
  return theme.accent;
}

/** Footer 常驻；Toast 有内容时在其上方另占一行。 */
export function ToastLine(props: ToastLineProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  return (
    <box style={{ flexDirection: "column", flexShrink: 0 }}>
      {props.toast && (
        <box style={{ height: 1, flexShrink: 0 }}>
          <text fg={toastColor(props.toast.tone, theme)} selectable>
            {props.toast.text}
          </text>
        </box>
      )}
      <box style={{ height: 1, flexShrink: 0 }}>
        <text fg={theme.dim} selectable>{props.fallback}</text>
      </box>
    </box>
  );
}
