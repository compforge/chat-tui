import { useTerminalDimensions } from "@opentui/react";
import { memo, type ReactNode } from "react";

import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
  useKeybindOverrides,
} from "../../input/keyboard.tsx";
import { layerBindings } from "../../input/keybinds.ts";
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
  const keybinds = useKeybindOverrides();
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.overlay,
    commands: [{
      name: "sidecar.dismiss",
      run: () => {
        if (layout !== "overlay" || !props.onDismiss) return false;
        props.onDismiss();
      },
    }],
    bindings: layerBindings(["sidecar.dismiss"], keybinds),
  }), [keybinds]);

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
