import { Fragment, type ReactNode } from "react";

import { defaultTheme, type Theme } from "../../../theme.ts";
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
        width: 60,
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
            <text fg={theme.dim}>{candidate.group}</text>
          ) : null}
          <text fg={index === props.selectedIndex ? theme.accent : undefined}>
            {`${index === props.selectedIndex ? "▸ " : "  "}${candidate.label}  ${candidate.detail}`}
          </text>
        </Fragment>
      ))}
    </box>
  );
}
