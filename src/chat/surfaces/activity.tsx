import { memo, type ReactNode } from "react";

import { RunStatus } from "../../components/run-status.tsx";
import type { ChatStore } from "../../protocol/state.ts";
import { useStoreState } from "../../state.ts";
import type { Theme } from "../../types/index.ts";

export interface ActivitySurfaceProps {
  store: ChatStore;
  theme: Theme;
}

export const ActivitySurface = memo(function ActivitySurface(
  props: ActivitySurfaceProps,
): ReactNode {
  const activity = useStoreState(props.store, "activity");
  return <RunStatus items={activity.items ?? []} theme={props.theme} />;
});
