import { useEffect, useState, type ReactNode } from "react";

import type { ParallelItem, ParallelState } from "../../state/parallel.ts";
import { formatElapsed } from "../../terminal/time.ts";
import { defaultTheme, type Theme } from "../../theme.ts";

const REFRESH_MS = 1_000;

export interface ParallelProps {
  state: ParallelState;
  theme?: Theme;
}

/** Compact current-work region; lifecycle and visibility remain owned by the caller. */
export function Parallel(props: ParallelProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const ticking = props.state.items.some((item) => item.startedAt !== undefined);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  if (props.state.items.length === 0) return null;

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        marginTop: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.accent}>
        <b>{`Parallel (${props.state.items.length})`}</b>
      </text>
      {props.state.items.map((item) => {
        const details = parallelItemDetails(item, now);
        return (
          <box key={item.id} style={{ flexDirection: "row" }}>
            <text fg={theme.agentColorFor?.(item.name) ?? theme.agent}>
              {`${item.icon ?? "•"} ${item.name}`}
            </text>
            {details.length > 0 ? (
              <text fg={theme.dim}>{` · ${details.join(" · ")}`}</text>
            ) : null}
          </box>
        );
      })}
    </box>
  );
}

/** Display-ready suffix follows the item contract: description, progress, tokens, elapsed. */
export function parallelItemDetails(
  item: Pick<ParallelItem, "description" | "progress" | "tokens" | "startedAt">,
  now: number,
): string[] {
  return [
    item.description,
    item.progress,
    item.tokens === undefined ? undefined : `${item.tokens.toLocaleString("en-US")} tokens`,
    item.startedAt === undefined ? undefined : formatElapsed(now - item.startedAt),
  ].filter((part): part is string => Boolean(part));
}
