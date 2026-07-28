import { Fragment, type ReactNode } from "react";

import type {
  SidecarItemTone,
  SidecarState,
} from "../../state/sidecar.ts";
import type { Theme } from "../../theme.ts";
import {
  SIDECAR_WIDTH,
  visibleSidecarSections,
} from "./layout.ts";

function toneColor(tone: SidecarItemTone | undefined, theme: Theme): string {
  switch (tone) {
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "error":
      return theme.error;
    case "muted":
      return theme.dim;
    default:
      return theme.accent;
  }
}

export interface SidecarProps {
  state: SidecarState;
  theme: Theme;
  overlay?: boolean;
}

/** 只渲染接入方提供的展示快照，不解释条目背后的 agent 或业务语义。 */
export function Sidecar(props: SidecarProps): ReactNode {
  const sections = visibleSidecarSections(props.state);
  if (sections.length === 0) return null;

  return (
    <box
      border={["left"]}
      borderColor={props.theme.border}
      style={{
        width: SIDECAR_WIDTH,
        height: "100%",
        flexShrink: 0,
        flexDirection: "column",
        paddingTop: 1,
        paddingBottom: 1,
        paddingLeft: 2,
        paddingRight: 1,
        backgroundColor: props.theme.overlayBackground,
      }}
    >
      <box style={{ flexDirection: "row", justifyContent: "space-between", flexShrink: 0 }}>
        <text fg={props.theme.accent}>
          <b>{props.state.title ?? "Details"}</b>
        </text>
        {props.overlay ? <text fg={props.theme.dim}>Esc close</text> : null}
      </box>
      <scrollbox style={{ flexGrow: 1, marginTop: 1, paddingRight: 1 }} focused={false}>
        {sections.map((section, sectionIndex) => (
          <Fragment key={section.id}>
            {sectionIndex > 0 ? <box style={{ height: 1, flexShrink: 0 }} /> : null}
            {section.title ? (
              <text fg={props.theme.agent} style={{ flexShrink: 0 }}>
                <b>{section.title}</b>
              </text>
            ) : null}
            {section.items.map((item) => (
              <box key={item.id} style={{ flexDirection: "column", flexShrink: 0 }}>
                <box style={{ flexDirection: "row", justifyContent: "space-between", gap: 1 }}>
                  <text fg={props.theme.user} wrapMode="word">
                    {item.title}
                  </text>
                  {item.status ? (
                    <text fg={toneColor(item.tone, props.theme)} style={{ flexShrink: 0 }}>
                      {item.status}
                    </text>
                  ) : null}
                </box>
                {item.detail ? (
                  <text fg={props.theme.dim} wrapMode="word">
                    {item.detail}
                  </text>
                ) : null}
              </box>
            ))}
          </Fragment>
        ))}
      </scrollbox>
    </box>
  );
}
