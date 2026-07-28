import { memo, type ReactNode } from "react";

import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import type { Theme } from "../../theme.ts";
import type { ClipPolicy } from "./clip.ts";
import { PlanPinned } from "./plan.tsx";
import { Transcript } from "./transcript.tsx";

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
