import { memo, type ReactNode } from "react";

import { ToastLine } from "../../components/toast-line.tsx";
import type { ChatSurfaces } from "../../protocol/surfaces.ts";
import { useSurface } from "../../surface.ts";
import type { Theme, ToastMessage } from "../../types/index.ts";

export interface FooterSurfaceProps {
  surfaces: ChatSurfaces;
  localToast: ToastMessage | null;
  theme: Theme;
}

export const FooterSurface = memo(function FooterSurface(
  props: FooterSurfaceProps,
): ReactNode {
  const footer = useSurface(props.surfaces.footer);
  return (
    <ToastLine
      toast={props.localToast ?? footer.toast ?? null}
      fallback={footer.text ?? ""}
      theme={props.theme}
    />
  );
});
