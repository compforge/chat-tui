import { describe, expect, test } from "bun:test";

import {
  createChatPresentationRuntime,
  type ChatPresentationState,
  type SidecarView,
} from "../src/index.ts";

function initialState(): ChatPresentationState {
  return {
    timeline: {
      items: [{ id: "message-1", type: "message", role: "agent", text: "hello" }],
    },
    composer: { busy: false, placeholder: "Ask anything" },
    activity: {},
    footer: { text: "ready" },
    sidecar: undefined,
  };
}

describe("chat presentation runtime", () => {
  test("notifies only the channels changed by a commit", () => {
    const runtime = createChatPresentationRuntime(initialState());
    const calls = { timeline: 0, composer: 0, activity: 0, footer: 0, sidecar: 0 };
    const composerBefore = runtime.composer.getSnapshot();
    const timelineBefore = runtime.timeline.getSnapshot();

    runtime.timeline.subscribe(() => calls.timeline++);
    runtime.composer.subscribe(() => calls.composer++);
    runtime.activity.subscribe(() => calls.activity++);
    runtime.footer.subscribe(() => calls.footer++);
    runtime.sidecar.subscribe(() => calls.sidecar++);

    const board: SidecarView = {
      title: "Board",
      sections: [{ id: "active", items: [{ id: "task-1", title: "Implement runtime" }] }],
    };
    runtime.commit({ sidecar: board });

    expect(calls).toEqual({
      timeline: 0,
      composer: 0,
      activity: 0,
      footer: 0,
      sidecar: 1,
    });
    expect(runtime.composer.getSnapshot()).toBe(composerBefore);
    expect(runtime.timeline.getSnapshot()).toBe(timelineBefore);
    expect(runtime.sidecar.getSnapshot()).toBe(board);
    expect(runtime.getRevision()).toBe(1);
  });

  test("publishes a multi-channel commit atomically", () => {
    const runtime = createChatPresentationRuntime(initialState());
    const nextComposer = { busy: true, placeholder: "Steer the running turn" };
    const nextTimeline = {
      items: [{ id: "message-2", type: "message", role: "agent", text: "working" }] as const,
    };
    let observedComposer: unknown;
    let observedRevision = -1;

    runtime.timeline.subscribe(() => {
      observedComposer = runtime.composer.getSnapshot();
      observedRevision = runtime.getRevision();
    });
    runtime.commit({
      composer: nextComposer,
      timeline: { items: [...nextTimeline.items] },
    });

    expect(observedComposer).toBe(nextComposer);
    expect(observedRevision).toBe(1);
  });

  test("keeps ActivitySurface and FooterSurface independently subscribable", () => {
    const runtime = createChatPresentationRuntime(initialState());
    const calls = { composer: 0, activity: 0, footer: 0 };
    runtime.composer.subscribe(() => calls.composer++);
    runtime.activity.subscribe(() => calls.activity++);
    runtime.footer.subscribe(() => calls.footer++);

    runtime.commit({ activity: { items: [{ id: "primary", label: "running" }] } });
    expect(calls).toEqual({ composer: 0, activity: 1, footer: 0 });

    runtime.commit({ footer: { text: "tokens: 42" } });
    expect(calls).toEqual({ composer: 0, activity: 1, footer: 1 });
  });

  test("keeps ComposerSurface cold during repeated SidecarSurface updates", () => {
    const runtime = createChatPresentationRuntime(initialState());
    let composerNotifications = 0;
    let sidecarNotifications = 0;
    runtime.composer.subscribe(() => composerNotifications++);
    runtime.sidecar.subscribe(() => sidecarNotifications++);

    for (let index = 0; index < 5_000; index++) {
      runtime.commit({
        sidecar: {
          title: "Board",
          sections: [
            {
              id: "active",
              items: [{ id: "task", title: "Streaming", detail: String(index) }],
            },
          ],
        },
      });
    }

    expect(composerNotifications).toBe(0);
    expect(sidecarNotifications).toBe(5_000);
    expect(runtime.getRevision()).toBe(5_000);
  });

  test("legacy full-view commits preserve unchanged Surface references", () => {
    const transcript = initialState().timeline.items;
    const runtime = createChatPresentationRuntime({
      transcript,
      footer: "ready",
      sidecar: undefined,
    });
    const composerBefore = runtime.composer.getSnapshot();
    let composerNotifications = 0;
    runtime.composer.subscribe(() => composerNotifications++);

    runtime.commitView({
      transcript,
      footer: "updated",
      sidecar: {
        title: "Board",
        sections: [{ id: "active", items: [{ id: "task", title: "Updated" }] }],
      },
    });

    expect(runtime.composer.getSnapshot()).toBe(composerBefore);
    expect(composerNotifications).toBe(0);
  });
});
