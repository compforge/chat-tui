import type { ActivityState } from "./activity.ts";
import type { ComposerState } from "./composer.ts";
import type { FooterState } from "./footer.ts";
import type { ParallelState } from "./parallel.ts";
import type { SidecarState } from "./sidecar.ts";
import type { TimelineState } from "./timeline.ts";

export interface ChatState {
  timeline: TimelineState;
  composer: ComposerState;
  activity: ActivityState;
  parallel?: ParallelState;
  footer: FooterState;
  sidecar: SidecarState | undefined;
}

export type ChatStatePatch = Partial<ChatState>;
