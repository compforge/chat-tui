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
import type {
  ActivitySurfaceState,
  ChatSurfaceState,
  ChatSurfaceStore,
  ComposerSurfaceState,
  FooterSurfaceState,
  TimelineSurfaceState,
} from "./surfaces.ts";

/**
 * 完整 View 是旧接入方的兼容快照；新接入方应直接发布五个 Surface，
 * 避免无关区域因一个对象引用变化而共同重渲染。
 */
export interface ChatViewState {
  transcript: TranscriptItem[];
  /** 有 turn 在跑：Esc 变为"打断"，输入框边框高亮 */
  busy?: boolean;
  /**
   * ActivitySurface：贴 composer 顶部的"现在时"运行状态，不随历史滚动。
   * 首条为主行（当前输入目标 + 运行相位），其余为附加行（其他活跃 agent / 子 agent）。
   * 空/缺省即隐藏不占高度。
   */
  runStatus?: RunStatusItem[];
  /**
   * pin 在 composer 上方的 plan（"何时显示"归接入方：建议仅在有未完成项时下发，
   * 全部完成后停发即自动消失）；空/缺省即隐藏不占高度。
   */
  plan?: PlanEntry[];
  /** 排队中的 steer 输入（队列本体归接入方） */
  queued?: QueuedItem[];
  /** 接入方请求 TUI 弹选择浮层；用户选择/关闭通过 resolvePicker 回传 */
  picker?: (PickerView & { id: string }) | null;
  /**
   * 当前等待用户参与的请求，按展示优先级排序。InteractionDock 只展示首项并标记总数；
   * blocking、排队和持久生命周期均由接入方决定。
   */
  interactions?: InteractionView[];
  /**
   * 与主对话并列的可选辅助视图。无有效条目时隐藏且不占宽度；
   * auto 模式仅在宽屏内联，open 模式在窄屏使用 overlay。
   */
  sidecar?: SidecarView;
  /** 瞬时提示，有内容时展示在常驻 footer 上方。 */
  toast?: ToastMessage | null;
  /** 常驻底部信息行（usage、队列长度、cwd 等） */
  footer?: string;
  composerPlaceholder?: string;
  /** 时间线顶部说明（产品名、快捷键提示） */
  header?: string;
  /** thought 消息是否渲染 */
  showThoughts?: boolean;
}

function timelineFrom(view: ChatViewState): TimelineSurfaceState {
  return {
    items: view.transcript,
    plan: view.plan,
    header: view.header,
    showThoughts: view.showThoughts,
  };
}

function composerFrom(view: ChatViewState): ComposerSurfaceState {
  return {
    busy: view.busy,
    queued: view.queued,
    picker: view.picker,
    interactions: view.interactions,
    placeholder: view.composerPlaceholder,
  };
}

function activityFrom(view: ChatViewState): ActivitySurfaceState {
  return { items: view.runStatus };
}

function footerFrom(view: ChatViewState): FooterSurfaceState {
  return { toast: view.toast, text: view.footer };
}

function sameTimeline(
  left: TimelineSurfaceState,
  right: TimelineSurfaceState,
): boolean {
  return (
    left.items === right.items &&
    left.plan === right.plan &&
    left.header === right.header &&
    left.showThoughts === right.showThoughts
  );
}

function sameComposer(
  left: ComposerSurfaceState,
  right: ComposerSurfaceState,
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
  left: ActivitySurfaceState,
  right: ActivitySurfaceState,
): boolean {
  return left.items === right.items;
}

function sameFooter(
  left: FooterSurfaceState,
  right: FooterSurfaceState,
): boolean {
  return left.toast === right.toast && left.text === right.text;
}

export function chatSurfaceStateFromView(
  view: ChatViewState,
): ChatSurfaceState {
  return {
    timeline: timelineFrom(view),
    composer: composerFrom(view),
    activity: activityFrom(view),
    footer: footerFrom(view),
    sidecar: view.sidecar,
  };
}

export function commitViewToSurfaces(
  store: ChatSurfaceStore,
  view: ChatViewState,
): void {
  const timeline = timelineFrom(view);
  const composer = composerFrom(view);
  const activity = activityFrom(view);
  const footer = footerFrom(view);
  store.commit({
    ...(sameTimeline(store.timeline.getSnapshot(), timeline)
      ? {}
      : { timeline }),
    ...(sameComposer(store.composer.getSnapshot(), composer)
      ? {}
      : { composer }),
    ...(sameActivity(store.activity.getSnapshot(), activity)
      ? {}
      : { activity }),
    ...(sameFooter(store.footer.getSnapshot(), footer)
      ? {}
      : { footer }),
    ...(view.sidecar === store.sidecar.getSnapshot()
      ? {}
      : { sidecar: view.sidecar }),
  });
}
