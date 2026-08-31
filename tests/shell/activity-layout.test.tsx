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
import { createTestClipboard } from "../clipboard.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

function rendererItems(setup: TestRendererSetup): Renderable[] {
  return [...Renderable.renderablesByNumber.values()].filter(
    (renderable) => renderable.ctx === setup.renderer,
  );
}

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

describe("ChatShell activity layout", () => {
  test("keeps a blank row between transcript and activity when plan and queue are empty", async () => {
    const setup = await createTestRenderer({ width: 80, height: 10, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol: ChatProtocol = {
      stateStore: createChatStore({
        timeline: {
          items: [{
            type: "message",
            id: "last-message",
            role: "agent",
            text: "last transcript line",
          }],
        },
        composer: {},
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
    root.render(createElement(ChatShell, { protocol, commands: [], clipboard: createTestClipboard() }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const transcript = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "last transcript line",
    );
    const status = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "thinking…",
    );
    expect(transcript).toBeDefined();
    expect(status).toBeDefined();
    expect(status!.y - transcript!.y).toBeGreaterThanOrEqual(2);
  });

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
    root.render(createElement(ChatShell, { protocol, commands: [], clipboard: createTestClipboard() }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const statuses = rendererItems(setup).filter(
      (renderable) => "plainText" in renderable && renderable.plainText === "default · idle",
    );
    const composer = rendererItems(setup).find(
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
        composer: {},
        queue: { items: [{ id: "queued-1", text: "follow up" }] },
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
    root.render(createElement(ChatShell, { protocol, commands: [], clipboard: createTestClipboard() }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const queue = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "• Queued follow-ups",
    );
    const status = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "thinking…",
    );
    const composer = rendererItems(setup).find(
      (renderable): renderable is TextareaRenderable => renderable instanceof TextareaRenderable,
    );
    expect(queue).toBeDefined();
    expect(status).toBeDefined();
    expect(composer).toBeDefined();
    expect(queue!.y).toBeLessThan(status!.y);
    expect(status!.y).toBeLessThan(composer!.y);
  });
});
