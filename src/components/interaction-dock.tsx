import { useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";

import {
  defaultTheme,
  type InteractionResponse,
  type InteractionView,
  type Theme,
} from "../types/index.ts";
import { ApprovalCard, QuestionCard } from "./overlays.tsx";

export interface InteractionDockProps {
  interactions: readonly InteractionView[];
  anchorBottom: number;
  canUseSuggestedInput: boolean;
  theme?: Theme;
  onResolve: (id: string, response: InteractionResponse) => void;
}

function frameTitle(count: number): string {
  return count > 1 ? `Needs your attention · 1/${count}` : "Needs your attention";
}

/**
 * Conditional, composer-adjacent surface for all current human interactions.
 * The consumer owns ordering and lifecycle; the dock renders one focused item.
 */
export function InteractionDock(props: InteractionDockProps): ReactNode {
  const interaction = props.interactions[0];
  if (!interaction) return null;

  const title = frameTitle(props.interactions.length);
  if (interaction.kind === "approval") {
    return (
      <ApprovalCard
        approval={interaction.approval}
        frameTitle={title}
        requester={interaction.requester}
        anchorBottom={props.anchorBottom}
        theme={props.theme}
        onSelect={(optionId) =>
          props.onResolve(interaction.id, { kind: "approval", optionId })
        }
      />
    );
  }
  if (interaction.kind === "question") {
    return (
      <QuestionCard
        requestId={interaction.id}
        question={interaction.question}
        frameTitle={title}
        requester={interaction.requester}
        anchorBottom={props.anchorBottom}
        theme={props.theme}
        onSubmit={(answers) =>
          props.onResolve(interaction.id, { kind: "question", answers })
        }
      />
    );
  }

  return (
    <SuggestedInputCard
      interaction={interaction}
      title={title}
      anchorBottom={props.anchorBottom}
      canUse={props.canUseSuggestedInput}
      theme={props.theme}
    />
  );
}

interface SuggestedInputCardProps {
  interaction: Extract<InteractionView, { kind: "suggested_input" }>;
  title: string;
  anchorBottom: number;
  canUse: boolean;
  theme?: Theme;
}

function SuggestedInputCard(props: SuggestedInputCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  const width = Math.max(20, Math.min(76, terminal.width - 4));
  const height = Math.max(5, Math.min(10, terminal.height - props.anchorBottom - 1));
  const hint = props.canUse
    ? "Ctrl+Y use in composer · Ctrl+C dismiss"
    : "Clear the composer to use · Ctrl+C clears draft";

  return (
    <box
      title={props.title}
      border
      borderColor={theme.accent}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width,
        height,
        backgroundColor: theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 200,
        flexDirection: "column",
      }}
    >
      <text>
        <strong>{props.interaction.title}</strong>
        {props.interaction.requester ? ` · ${props.interaction.requester}` : null}
      </text>
      <scrollbox style={{ flexGrow: 1 }} focused={false}>
        <text selectable>{props.interaction.text}</text>
      </scrollbox>
      <text fg={theme.dim}>{hint}</text>
    </box>
  );
}
