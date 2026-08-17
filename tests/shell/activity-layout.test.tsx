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
  test("renders one main status region above the composer", async () => {
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
    expect(statuses[0]!.y).toBeLessThan(composer!.y);
  });
});
