import { useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";

import {
  type InteractionView,
} from "../../../state/composer.ts";
import type { InteractionResponse } from "../../../protocol/interaction.ts";
import { defaultTheme, type Theme } from "../../../theme.ts";
import { ApprovalCard } from "./approval-card.tsx";
import { QuestionCard } from "./question-card.tsx";

export interface InteractionDockProps {
  interactions: readonly InteractionView[];
  anchorBottom: number;
  canUseSuggestedInput: boolean;
  theme?: Theme;
  onUseSuggestedInput: (
    interaction: Extract<InteractionView, { kind: "suggested_input" }>,
  ) => void;
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
      onUse={() => props.onUseSuggestedInput(interaction)}
      onDismiss={() =>
        props.onResolve(interaction.id, {
          kind: "suggested_input",
          outcome: "dismissed",
        })
      }
    />
  );
}

interface SuggestedInputCardProps {
  interaction: Extract<InteractionView, { kind: "suggested_input" }>;
  title: string;
  anchorBottom: number;
  canUse: boolean;
  theme?: Theme;
  onUse: () => void;
  onDismiss: () => void;
}

interface SuggestedInputOption {
  value?: unknown;
}

function SuggestedInputCard(props: SuggestedInputCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  const width = Math.max(28, Math.min(112, terminal.width - 4));
  const height = Math.max(8, Math.min(18, terminal.height - props.anchorBottom - 1));

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
      {props.canUse ? (
        <select
          focused
          showDescription={false}
          style={{ height: 2, flexShrink: 0 }}
          options={[
            {
              name: "Use in composer  (Ctrl+Y)",
              description: "",
              value: "use",
            },
            { name: "Dismiss  (Ctrl+C)", description: "", value: "dismiss" },
          ]}
          onSelect={(_index: number, option: SuggestedInputOption | null) => {
            if (option?.value === "use") props.onUse();
            else if (option?.value === "dismiss") props.onDismiss();
          }}
        />
      ) : (
        <text fg={theme.dim}>
          Clear the composer to choose an action · Ctrl+C clears draft
        </text>
      )}
    </box>
  );
}
