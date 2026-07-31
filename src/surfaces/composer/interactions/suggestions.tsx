import { useTerminalDimensions } from "@opentui/react";
import { Fragment, type ReactNode } from "react";

import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
} from "../../../input/keyboard.tsx";
import { defaultTheme, type Theme } from "../../../theme.ts";
import { MarqueeText } from "../../../terminal/marquee.tsx";
import type { Candidate } from "../completion.ts";

export interface SuggestionsProps {
  candidates: Candidate[];
  selectedIndex: number;
  anchorBottom: number;
  theme?: Theme;
  onPrevious: () => void;
  onNext: () => void;
  onAccept: (key: "tab" | "enter") => void;
  onDismiss: () => void;
}

/** 补全候选声明自身行为；具体补全计算和选中态由 ComposerSurface 提供。 */
export function Suggestions(props: SuggestionsProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.popup,
    commands: [
      {
        name: "suggestions.previous",
        run: () => {
          if (props.candidates.length === 0) return false;
          props.onPrevious();
        },
      },
      {
        name: "suggestions.next",
        run: () => {
          if (props.candidates.length === 0) return false;
          props.onNext();
        },
      },
      {
        name: "suggestions.accept-tab",
        run: () => {
          if (props.candidates.length === 0) return false;
          props.onAccept("tab");
        },
      },
      {
        name: "suggestions.accept-enter",
        run: () => {
          if (props.candidates.length === 0) return false;
          props.onAccept("enter");
        },
      },
      {
        name: "suggestions.dismiss",
        run: () => {
          if (props.candidates.length === 0) return false;
          props.onDismiss();
        },
      },
    ],
    bindings: [
      { key: "up", cmd: "suggestions.previous" },
      { key: "down", cmd: "suggestions.next" },
      { key: "tab", cmd: "suggestions.accept-tab" },
      { key: "return", cmd: "suggestions.accept-enter" },
      { key: "kpenter", cmd: "suggestions.accept-enter" },
      { key: "escape", cmd: "suggestions.dismiss" },
    ],
  }));
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
