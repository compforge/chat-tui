import { memo, type ReactNode } from "react";

import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import type { Theme } from "../../theme.ts";
import { RunStatus } from "./run-status.tsx";

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
