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
import type { ChatViewState } from "./index.ts";

/** 可独立订阅和渲染的 UI 区域；具体 Surface 以语义命名，不需要基类或注册器。 */
export interface SurfaceChannel<T> {
  getSnapshot(): T;
  subscribe(onChange: () => void): () => void;
}

export interface TimelinePresentation {
  items: TranscriptItem[];
  plan?: PlanEntry[];
  header?: string;
  showThoughts?: boolean;
}

export interface ComposerPresentation {
  busy?: boolean;
  queued?: QueuedItem[];
  picker?: (PickerView & { id: string }) | null;
  interactions?: InteractionView[];
  placeholder?: string;
}

export interface ActivityPresentation {
  items?: RunStatusItem[];
}

export interface FooterPresentation {
  toast?: ToastMessage | null;
  text?: string;
}

export interface ChatPresentationState {
  timeline: TimelinePresentation;
  composer: ComposerPresentation;
  activity: ActivityPresentation;
  footer: FooterPresentation;
  sidecar: SidecarView | undefined;
}

export type ChatPresentationPatch = Partial<ChatPresentationState>;

export interface ChatPresentation {
  readonly timeline: SurfaceChannel<TimelinePresentation>;
  readonly composer: SurfaceChannel<ComposerPresentation>;
  readonly activity: SurfaceChannel<ActivityPresentation>;
  readonly footer: SurfaceChannel<FooterPresentation>;
  readonly sidecar: SurfaceChannel<SidecarView | undefined>;
  getRevision(): number;
}

export interface ChatPresentationRuntime extends ChatPresentation {
  /**
   * 所有新快照先落地，再通知发生变化的 Surface；订阅回调始终看到同一 revision。
   */
  commit(patch: ChatPresentationPatch): void;
  /** 兼容旧式完整 ChatViewState 的迁移入口。 */
  commitView(view: ChatViewState): void;
}

interface MutableChannel<T> extends SurfaceChannel<T> {
  snapshot: T;
  listeners: Set<() => void>;
}

function channel<T>(snapshot: T): MutableChannel<T> {
  const listeners = new Set<() => void>();
  const result: MutableChannel<T> = {
    snapshot,
    listeners,
    getSnapshot: () => result.snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return result;
}

function timelineFrom(view: ChatViewState): TimelinePresentation {
  return {
    items: view.transcript,
    plan: view.plan,
    header: view.header,
    showThoughts: view.showThoughts,
  };
}

function composerFrom(view: ChatViewState): ComposerPresentation {
  return {
    busy: view.busy,
    queued: view.queued,
    picker: view.picker,
    interactions: view.interactions,
    placeholder: view.composerPlaceholder,
  };
}

function activityFrom(view: ChatViewState): ActivityPresentation {
  return { items: view.runStatus };
}

function footerFrom(view: ChatViewState): FooterPresentation {
  return { toast: view.toast, text: view.footer };
}

function sameTimeline(
  left: TimelinePresentation,
  right: TimelinePresentation,
): boolean {
  return (
    left.items === right.items &&
    left.plan === right.plan &&
    left.header === right.header &&
    left.showThoughts === right.showThoughts
  );
}

function sameComposer(
  left: ComposerPresentation,
  right: ComposerPresentation,
): boolean {
  return (
    left.busy === right.busy &&
    left.queued === right.queued &&
    left.picker === right.picker &&
    left.interactions === right.interactions &&
    left.placeholder === right.placeholder
  );
}

function sameActivity(
  left: ActivityPresentation,
  right: ActivityPresentation,
): boolean {
  return left.items === right.items;
}

function sameFooter(
  left: FooterPresentation,
  right: FooterPresentation,
): boolean {
  return left.toast === right.toast && left.text === right.text;
}

export function presentationStateFrom(view: ChatViewState): ChatPresentationState {
  return {
    timeline: timelineFrom(view),
    composer: composerFrom(view),
    activity: activityFrom(view),
    footer: footerFrom(view),
    sidecar: view.sidecar,
  };
}

export function createChatPresentationRuntime(
  initial: ChatViewState | ChatPresentationState,
): ChatPresentationRuntime {
  const state = "composer" in initial ? initial : presentationStateFrom(initial);
  const timeline = channel(state.timeline);
  const composer = channel(state.composer);
  const activity = channel(state.activity);
  const footer = channel(state.footer);
  const sidecar = channel(state.sidecar);
  let revision = 0;

  const commit = (patch: ChatPresentationPatch): void => {
    const changed: Array<{ listeners: Set<() => void> }> = [];
    const replace = <T>(
      key: keyof ChatPresentationPatch,
      target: MutableChannel<T>,
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
    commitView(view) {
      const nextTimeline = timelineFrom(view);
      const nextComposer = composerFrom(view);
      const nextActivity = activityFrom(view);
      const nextFooter = footerFrom(view);
      commit({
        ...(sameTimeline(timeline.snapshot, nextTimeline)
          ? {}
          : { timeline: nextTimeline }),
        ...(sameComposer(composer.snapshot, nextComposer)
          ? {}
          : { composer: nextComposer }),
        ...(sameActivity(activity.snapshot, nextActivity)
          ? {}
          : { activity: nextActivity }),
        ...(sameFooter(footer.snapshot, nextFooter)
          ? {}
          : { footer: nextFooter }),
        ...(view.sidecar === sidecar.snapshot ? {} : { sidecar: view.sidecar }),
      });
    },
  };
}
