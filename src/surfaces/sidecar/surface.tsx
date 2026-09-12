import { useTerminalDimensions } from "@opentui/react";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
  useKeybindOverrides,
} from "../../input/keyboard.tsx";
import { keybindHint, layerBindings } from "../../input/keybinds.ts";
import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import type { Theme } from "../../theme.ts";
import { sidecarLayout, sidecarLinks } from "./layout.ts";
import { Sidecar } from "./sidecar.tsx";

export interface SidecarSurfaceProps {
  store: ChatStore;
  theme: Theme;
  onDismiss?: () => void;
  onOpenUrl?: (url: string) => void | Promise<void>;
}

export const SidecarSurface = memo(function SidecarSurface(
  props: SidecarSurfaceProps,
): ReactNode {
  const terminal = useTerminalDimensions();
  const state = useStoreState(props.store, "sidecar");
  const layout = sidecarLayout(state, terminal.width);
  const keybinds = useKeybindOverrides();
  const links = useMemo(() => sidecarLinks(state), [state]);
  const [selectedLinkKey, setSelectedLinkKey] = useState<string | undefined>(
    links[0]?.key,
  );
  const selectedIndex = Math.max(
    0,
    links.findIndex((link) => link.key === selectedLinkKey),
  );
  const selected = links[selectedIndex];

  useEffect(() => {
    if (!links.some((link) => link.key === selectedLinkKey)) {
      setSelectedLinkKey(links[0]?.key);
    }
  }, [links, selectedLinkKey]);

  const inputPriority = layout === "overlay"
    ? INPUT_LAYER_PRIORITY.overlay
    : INPUT_LAYER_PRIORITY.surface;
  useInputBindings(() => ({
    priority: inputPriority,
    commands: [
      {
        name: "sidecar.previous-link",
        run: () => {
          if (!props.onOpenUrl || links.length === 0) return false;
          setSelectedLinkKey(
            links[(selectedIndex - 1 + links.length) % links.length]?.key,
          );
        },
      },
      {
        name: "sidecar.next-link",
        run: () => {
          if (!props.onOpenUrl || links.length === 0) return false;
          setSelectedLinkKey(
            links[(selectedIndex + 1) % links.length]?.key,
          );
        },
      },
      {
        name: "sidecar.open-link",
        run: () => {
          if (!props.onOpenUrl || !selected) return false;
          void props.onOpenUrl(selected.url);
        },
      },
      {
        name: "sidecar.dismiss",
        run: () => {
          if (layout !== "overlay" || !props.onDismiss) return false;
          props.onDismiss();
        },
      },
    ],
    bindings: layerBindings(
      [
        "sidecar.previous-link",
        "sidecar.next-link",
        "sidecar.open-link",
        "sidecar.dismiss",
      ],
      keybinds,
    ),
  }), [inputPriority, keybinds]);

  if (!state || layout === "hidden") return null;
  const selectHint = [
    keybindHint("sidecar.previous-link", keybinds),
    keybindHint("sidecar.next-link", keybinds),
  ].filter((hint): hint is string => Boolean(hint)).join("/");
  const openHint = keybindHint("sidecar.open-link", keybinds);
  const interactive = Boolean(props.onOpenUrl && selected && openHint);
  const linkHelp = interactive
    ? [
      selectHint ? `${selectHint} select` : undefined,
      `${openHint} open`,
    ].filter((hint): hint is string => Boolean(hint)).join(" · ")
    : undefined;
  const sidecar = (
    <Sidecar
      state={state}
      theme={props.theme}
      selectedLinkKey={interactive ? selected?.key : undefined}
      linkHelp={linkHelp}
      overlay={layout === "overlay"}
    />
  );
  if (layout === "inline") {
    return sidecar;
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
      {sidecar}
    </box>
  );
});
