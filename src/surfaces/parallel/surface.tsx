import { memo, type ReactNode } from "react";

import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import type { Theme } from "../../theme.ts";
import { Parallel } from "./parallel.tsx";

export interface ParallelSurfaceProps {
  store: ChatStore;
  theme: Theme;
}

export const ParallelSurface = memo(function ParallelSurface(
  props: ParallelSurfaceProps,
): ReactNode {
  const parallel = useStoreState(props.store, "parallel");
  return parallel
    ? <Parallel state={parallel} theme={props.theme} />
    : null;
});
