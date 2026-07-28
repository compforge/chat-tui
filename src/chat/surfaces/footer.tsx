import { memo, type ReactNode } from "react";

import { ToastLine } from "../../components/toast-line.tsx";
import type { ChatStore } from "../../protocol/state.ts";
import { useStoreState } from "../../state.ts";
import type { Theme, ToastMessage } from "../../types/index.ts";

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
