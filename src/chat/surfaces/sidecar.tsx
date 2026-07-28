import { memo, type ReactNode } from "react";

import {
  Sidecar,
  type SidecarLayout,
} from "../../components/sidecar.tsx";
import type { SidecarView, Theme } from "../../types/index.ts";

export interface SidecarSurfaceProps {
  view: SidecarView | undefined;
  layout: SidecarLayout;
  theme: Theme;
}

export const SidecarSurface = memo(function SidecarSurface(
  props: SidecarSurfaceProps,
): ReactNode {
  if (!props.view || props.layout === "hidden") return null;
  if (props.layout === "inline") {
    return <Sidecar view={props.view} theme={props.theme} />;
  }
  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 300,
      }}
    >
      <Sidecar view={props.view} theme={props.theme} overlay />
    </box>
  );
});
