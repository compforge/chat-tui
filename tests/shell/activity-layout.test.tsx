import { afterEach, describe, expect, test } from "bun:test";
import { Renderable, TextareaRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import {
  ChatShell,
  createChatStore,
  type ChatProtocol,
} from "../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

describe("ChatShell activity layout", () => {
  test("keeps the main status directly above the composer", async () => {
    const setup = await createTestRenderer({ width: 80, height: 10, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol: ChatProtocol = {
      stateStore: createChatStore({
        timeline: { items: [] },
        composer: {},
        activity: { items: [{ id: "main", author: "claude", label: "default · idle" }] },
        footer: {},
        sidecar: undefined,
      }),
      submit: () => {},
      command: () => {},
      cancel: () => {},
      exit: () => {},
      resolvePicker: () => {},
      searchPicker: () => {},
      resolveInteraction: () => {},
    };
    root.render(createElement(ChatShell, { protocol, commands: [] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const statuses = [...Renderable.renderablesByNumber.values()].filter(
      (renderable) => "plainText" in renderable && renderable.plainText === "default · idle",
    );
    const composer = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is TextareaRenderable => renderable instanceof TextareaRenderable,
    );
    expect(statuses).toHaveLength(1);
    expect(composer).toBeDefined();
    // Textarea 坐标位于 Composer 顶边框内一行；差 2 表示两者之间没有额外空白行。
    expect(composer!.y).toBe(statuses[0]!.y + 2);
  });

  test("places the optional queue above the main status", async () => {
    const setup = await createTestRenderer({ width: 80, height: 14, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol: ChatProtocol = {
      stateStore: createChatStore({
        timeline: { items: [] },
        composer: { queued: [{ id: "queued-1", text: "follow up" }] },
        activity: { items: [{ id: "main", author: "codex", label: "thinking…" }] },
        footer: {},
        sidecar: undefined,
      }),
      submit: () => {},
      command: () => {},
      cancel: () => {},
      exit: () => {},
      resolvePicker: () => {},
      searchPicker: () => {},
      resolveInteraction: () => {},
    };
    root.render(createElement(ChatShell, { protocol, commands: [] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const queue = [...Renderable.renderablesByNumber.values()].find(
      (renderable) => "plainText" in renderable && renderable.plainText === "• Queued follow-ups",
    );
    const status = [...Renderable.renderablesByNumber.values()].find(
      (renderable) => "plainText" in renderable && renderable.plainText === "thinking…",
    );
    const composer = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is TextareaRenderable => renderable instanceof TextareaRenderable,
    );
    expect(queue).toBeDefined();
    expect(status).toBeDefined();
    expect(composer).toBeDefined();
    expect(queue!.y).toBeLessThan(status!.y);
    expect(status!.y).toBeLessThan(composer!.y);
  });
});
