import { useTerminalDimensions } from "@opentui/react";
import { memo, type ReactNode } from "react";

import {
  Sidecar,
  sidecarLayout,
} from "../../components/sidecar.tsx";
import type { ChatStore } from "../../protocol/state.ts";
import { useStoreState } from "../../state.ts";
import type { Theme } from "../../types/index.ts";

export interface SidecarSurfaceProps {
  store: ChatStore;
  theme: Theme;
}

export const SidecarSurface = memo(function SidecarSurface(
  props: SidecarSurfaceProps,
): ReactNode {
  const terminal = useTerminalDimensions();
  const view = useStoreState(props.store, "sidecar");
  const layout = sidecarLayout(view, terminal.width);

  if (!view || layout === "hidden") return null;
  if (layout === "inline") {
    return <Sidecar view={view} theme={props.theme} />;
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
      <Sidecar view={view} theme={props.theme} overlay />
    </box>
  );
});
