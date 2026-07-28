import type {
  InteractionView,
  PickerView,
  PlanEntry,
  QueuedItem,
  RunStatusItem,
  SidecarView,
  ToastMessage,
  TranscriptItem,
} from "../types/index.ts";
import {
  createSurfaceCell,
  type Surface,
  type SurfaceCell,
} from "../surface.ts";

export interface TimelineSurfaceState {
  items: TranscriptItem[];
  plan?: PlanEntry[];
  header?: string;
  showThoughts?: boolean;
}

export interface ComposerSurfaceState {
  busy?: boolean;
  queued?: QueuedItem[];
  picker?: (PickerView & { id: string }) | null;
  interactions?: InteractionView[];
  placeholder?: string;
}

export interface ActivitySurfaceState {
  items?: RunStatusItem[];
}

export interface FooterSurfaceState {
  toast?: ToastMessage | null;
  text?: string;
}

export interface ChatSurfaceState {
  timeline: TimelineSurfaceState;
  composer: ComposerSurfaceState;
  activity: ActivitySurfaceState;
  footer: FooterSurfaceState;
  sidecar: SidecarView | undefined;
}

export type ChatSurfacePatch = Partial<ChatSurfaceState>;

export interface ChatSurfaces {
  readonly timeline: Surface<TimelineSurfaceState>;
  readonly composer: Surface<ComposerSurfaceState>;
  readonly activity: Surface<ActivitySurfaceState>;
  readonly footer: Surface<FooterSurfaceState>;
  readonly sidecar: Surface<SidecarView | undefined>;
  getRevision(): number;
}

export interface ChatSurfaceStore extends ChatSurfaces {
  /**
   * 所有新快照先落地，再通知发生变化的 Surface；订阅回调始终看到同一 revision。
   */
  commit(patch: ChatSurfacePatch): void;
}

export function createChatSurfaceStore(
  initial: ChatSurfaceState,
): ChatSurfaceStore {
  const timeline = createSurfaceCell(initial.timeline);
  const composer = createSurfaceCell(initial.composer);
  const activity = createSurfaceCell(initial.activity);
  const footer = createSurfaceCell(initial.footer);
  const sidecar = createSurfaceCell(initial.sidecar);
  let revision = 0;

  const commit = (patch: ChatSurfacePatch): void => {
    const changed: Array<{ listeners: Set<() => void> }> = [];
    const replace = <T>(
      key: keyof ChatSurfacePatch,
      target: SurfaceCell<T>,
      next: T | undefined,
    ): void => {
      if (!Object.hasOwn(patch, key) || next === target.snapshot) return;
      target.snapshot = next as T;
      changed.push(target);
    };

    replace("timeline", timeline, patch.timeline);
    replace("composer", composer, patch.composer);
    replace("activity", activity, patch.activity);
    replace("footer", footer, patch.footer);
    replace("sidecar", sidecar, patch.sidecar);
    if (changed.length === 0) return;

    revision += 1;
    for (const target of changed) {
      for (const listener of [...target.listeners]) listener();
    }
  };

  return {
    timeline,
    composer,
    activity,
    footer,
    sidecar,
    getRevision: () => revision,
    commit,
  };
}
