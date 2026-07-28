import { describe, expect, test } from "bun:test";

import {
  createChatStore,
  type ChatState,
  type SidecarState,
} from "../../src/index.ts";

function initialState(): ChatState {
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

describe("chat state store", () => {
  test("notifies only the channels changed by a commit", () => {
    const runtime = createChatStore(initialState());
    const calls = { timeline: 0, composer: 0, activity: 0, footer: 0, sidecar: 0 };
    const composerBefore = runtime.getState("composer");
    const timelineBefore = runtime.getState("timeline");

    runtime.subscribe("timeline", () => calls.timeline++);
    runtime.subscribe("composer", () => calls.composer++);
    runtime.subscribe("activity", () => calls.activity++);
    runtime.subscribe("footer", () => calls.footer++);
    runtime.subscribe("sidecar", () => calls.sidecar++);

    const board: SidecarState = {
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
    expect(runtime.getState("composer")).toBe(composerBefore);
    expect(runtime.getState("timeline")).toBe(timelineBefore);
    expect(runtime.getState("sidecar")).toBe(board);
    expect(runtime.getRevision()).toBe(1);
  });

  test("publishes a multi-channel commit atomically", () => {
    const runtime = createChatStore(initialState());
    const nextComposer = { busy: true, placeholder: "Steer the running turn" };
    const nextTimeline = {
      items: [{ id: "message-2", type: "message", role: "agent", text: "working" }] as const,
    };
    let observedComposer: unknown;
    let observedRevision = -1;

    runtime.subscribe("timeline", () => {
      observedComposer = runtime.getState("composer");
      observedRevision = runtime.getRevision();
    });
    runtime.commit({
      composer: nextComposer,
      timeline: { items: [...nextTimeline.items] },
    });

    expect(observedComposer).toBe(nextComposer);
    expect(observedRevision).toBe(1);
  });

  test("keeps activity and footer State independently subscribable", () => {
    const runtime = createChatStore(initialState());
    const calls = { composer: 0, activity: 0, footer: 0 };
    runtime.subscribe("composer", () => calls.composer++);
    runtime.subscribe("activity", () => calls.activity++);
    runtime.subscribe("footer", () => calls.footer++);

    runtime.commit({ activity: { items: [{ id: "primary", label: "running" }] } });
    expect(calls).toEqual({ composer: 0, activity: 1, footer: 0 });

    runtime.commit({ footer: { text: "tokens: 42" } });
    expect(calls).toEqual({ composer: 0, activity: 1, footer: 1 });
  });

  test("keeps composer State cold during repeated sidecar State updates", () => {
    const runtime = createChatStore(initialState());
    let composerNotifications = 0;
    let sidecarNotifications = 0;
    runtime.subscribe("composer", () => composerNotifications++);
    runtime.subscribe("sidecar", () => sidecarNotifications++);

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
});
