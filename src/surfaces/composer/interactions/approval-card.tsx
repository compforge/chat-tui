import type { SelectRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useRef, type ReactNode } from "react";

import type { ApprovalView } from "../../../state/composer.ts";
import { defaultTheme, type Theme } from "../../../theme.ts";
import { approvalCardLayout } from "./approval.ts";

interface SelectOption {
  name: string;
  description: string;
  value?: unknown;
}

export interface ApprovalCardProps {
  approval: ApprovalView;
  frameTitle?: string;
  requester?: string;
  anchorBottom: number;
  theme?: Theme;
  onSelect: (optionId: string) => void;
}

export function ApprovalCard(props: ApprovalCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  const actions = useRef<SelectRenderable | null>(null);
  const detail = props.approval.description
    ? `${props.approval.title}\n${props.approval.description}`
    : props.approval.title;
  const layout = approvalCardLayout({
    terminalWidth: terminal.width,
    terminalHeight: terminal.height,
    anchorBottom: props.anchorBottom,
    detail,
    optionCount: props.approval.options.length,
  });
  useKeyboard((key) => {
    if (!actions.current) return;
    if (key.name === "up" || key.name === "down") {
      key.preventDefault();
      if (key.name === "up") actions.current.moveUp();
      else actions.current.moveDown();
      return;
    }
    if (
      key.name === "return" ||
      key.name === "linefeed" ||
      key.name === "kpenter"
    ) {
      key.preventDefault();
      actions.current.selectCurrent();
    }
  });

  return (
    <box
      title={props.frameTitle ?? "Approval required"}
      border
      borderColor={theme.borderActive}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: layout.width,
        height: layout.height,
        backgroundColor:
          theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 200,
        flexDirection: "column",
      }}
    >
      <scrollbox
        style={{ height: layout.detailRows, flexShrink: 0 }}
        focused={false}
      >
        <text selectable>
          <strong>{props.approval.title}</strong>
          {props.requester ? ` · ${props.requester}` : null}
          {props.approval.description
            ? `\n${props.approval.description}`
            : null}
        </text>
      </scrollbox>
      {props.approval.options.length > 0 ? (
        <select
          ref={actions}
          focused
          showDescription={false}
          showScrollIndicator={
            props.approval.options.length > layout.actionRows
          }
          style={{ height: layout.actionRows, flexShrink: 0 }}
          options={props.approval.options.map((option) => ({
            name: option.name,
            description: option.kind,
            value: option.optionId,
          }))}
          onSelect={(_i: number, option: SelectOption | null) => {
            if (option) props.onSelect(String(option.value));
          }}
        />
      ) : (
        <text
          fg={theme.error}
          style={{ height: layout.actionRows, flexShrink: 0 }}
        >
          No approval actions available · Esc interrupts turn
        </text>
      )}
    </box>
  );
}
