import { memo, type ReactNode } from "react";

import type { ClipPolicy } from "../../components/clip.ts";
import { PlanPinned } from "../../components/plan-pinned.tsx";
import { Transcript } from "../../components/transcript.tsx";
import type { ChatStore } from "../../protocol/state.ts";
import { useStoreState } from "../../state.ts";
import type { Theme } from "../../types/index.ts";

export interface TimelineSurfaceProps {
  store: ChatStore;
  theme: Theme;
  clipPolicy?: ClipPolicy;
}

export const TimelineSurface = memo(function TimelineSurface(
  props: TimelineSurfaceProps,
): ReactNode {
  const timeline = useStoreState(props.store, "timeline");
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
