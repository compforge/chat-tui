import { memo, type ReactNode } from "react";

import type { ClipPolicy } from "../../components/clip.ts";
import { PlanPinned } from "../../components/plan-pinned.tsx";
import { Transcript } from "../../components/transcript.tsx";
import type { ChatSurfaces } from "../../protocol/surfaces.ts";
import { useSurface } from "../../surface.ts";
import type { Theme } from "../../types/index.ts";

export interface TimelineSurfaceProps {
  surfaces: ChatSurfaces;
  theme: Theme;
  clipPolicy?: ClipPolicy;
}

export const TimelineSurface = memo(function TimelineSurface(
  props: TimelineSurfaceProps,
): ReactNode {
  const timeline = useSurface(props.surfaces.timeline);
  return (
    <>
      <Transcript
        header={timeline.header}
        items={timeline.items}
        showThoughts={timeline.showThoughts}
        theme={props.theme}
        clipPolicy={props.clipPolicy}
      />
      <PlanPinned entries={timeline.plan ?? []} theme={props.theme} />
    </>
  );
});
