import { memo, type ReactNode } from "react";

import { RunStatus } from "../../components/run-status.tsx";
import type { ChatSurfaces } from "../../protocol/surfaces.ts";
import { useSurface } from "../../surface.ts";
import type { Theme } from "../../types/index.ts";

export interface ActivitySurfaceProps {
  surfaces: ChatSurfaces;
  theme: Theme;
}

export const ActivitySurface = memo(function ActivitySurface(
  props: ActivitySurfaceProps,
): ReactNode {
  const activity = useSurface(props.surfaces.activity);
  return <RunStatus items={activity.items ?? []} theme={props.theme} />;
});
