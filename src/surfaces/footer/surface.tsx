import { memo, type ReactNode } from "react";

import type { ToastMessage } from "../../state/footer.ts";
import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import type { Theme } from "../../theme.ts";
import { ToastLine } from "./toast-line.tsx";

export interface FooterSurfaceProps {
  store: ChatStore;
  localToast: ToastMessage | null;
  theme: Theme;
}

export const FooterSurface = memo(function FooterSurface(
  props: FooterSurfaceProps,
): ReactNode {
  const footer = useStoreState(props.store, "footer");
  return (
    <ToastLine
      toast={props.localToast ?? footer.toast ?? null}
      fallback={footer.text ?? ""}
      theme={props.theme}
    />
  );
});
