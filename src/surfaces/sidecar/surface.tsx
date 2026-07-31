import { useTerminalDimensions } from "@opentui/react";
import { memo, type ReactNode } from "react";

import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
} from "../../input/keyboard.tsx";
import { Sidecar } from "./sidecar.tsx";
import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import type { Theme } from "../../theme.ts";
import { sidecarLayout } from "./layout.ts";

export interface SidecarSurfaceProps {
  store: ChatStore;
  theme: Theme;
  onDismiss?: () => void;
}

export const SidecarSurface = memo(function SidecarSurface(
  props: SidecarSurfaceProps,
): ReactNode {
  const terminal = useTerminalDimensions();
  const state = useStoreState(props.store, "sidecar");
  const layout = sidecarLayout(state, terminal.width);
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.overlay,
    commands: [{
      name: "sidecar.dismiss",
      run: () => {
        if (layout !== "overlay" || !props.onDismiss) return false;
        props.onDismiss();
      },
    }],
    bindings: [{
      key: "escape",
      desc: "Close sidecar",
      group: "Sidecar",
      cmd: "sidecar.dismiss",
    }],
  }));

  if (!state || layout === "hidden") return null;
  if (layout === "inline") {
    return <Sidecar state={state} theme={props.theme} />;
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
      <Sidecar state={state} theme={props.theme} overlay />
    </box>
  );
});
