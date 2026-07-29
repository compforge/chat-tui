import { useTerminalDimensions } from "@opentui/react";
import { Fragment, type ReactNode } from "react";

import { defaultTheme, type Theme } from "../../../theme.ts";
import { MarqueeText } from "../../../terminal/marquee.tsx";
import type { Candidate } from "../completion.ts";

export interface SuggestionsProps {
  candidates: Candidate[];
  selectedIndex: number;
  anchorBottom: number;
  theme?: Theme;
}

/** 补全候选。按键处理归 ComposerSurface，选中态由 props 提供。 */
export function Suggestions(props: SuggestionsProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  if (props.candidates.length === 0) return null;
  const groupHeadings = props.candidates.reduce(
    (count, candidate, index) =>
      candidate.group &&
        candidate.group !== props.candidates[index - 1]?.group
        ? count + 1
        : count,
    0,
  );
  return (
    <box
      border
      borderColor={theme.border}
      title="Suggestions (Tab/Enter accept · ↑↓ select · Esc close)"
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: Math.min(80, Math.max(20, terminal.width - 4)),
        height: props.candidates.length + groupHeadings + 2,
        backgroundColor:
          theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 150,
        flexDirection: "column",
      }}
    >
      {props.candidates.map((candidate, index) => (
        <Fragment key={candidate.insert}>
          {candidate.group &&
          candidate.group !== props.candidates[index - 1]?.group ? (
            <text
              fg={theme.dim}
              wrapMode="none"
              style={{ height: 1, flexShrink: 0, overflow: "hidden" }}
            >
              {candidate.group}
            </text>
          ) : null}
          <box
            style={{
              height: 1,
              flexShrink: 0,
              flexDirection: "row",
            }}
          >
            <text
              fg={index === props.selectedIndex ? theme.accent : undefined}
              style={{ width: 2, flexShrink: 0 }}
            >
              {index === props.selectedIndex ? "▸ " : "  "}
            </text>
            <MarqueeText
              text={`${candidate.label}  ${candidate.detail}`}
              color={index === props.selectedIndex ? theme.accent : undefined}
              active={index === props.selectedIndex}
            />
          </box>
        </Fragment>
      ))}
    </box>
  );
}
