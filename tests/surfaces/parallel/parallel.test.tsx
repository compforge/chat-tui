import { afterEach, describe, expect, test } from "bun:test";
import { Renderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import {
  ChatShell,
  Parallel,
  createChatStore,
  parallelItemDetails,
  type ChatProtocol,
} from "../../../src/index.ts";
import { createTestClipboard } from "../../clipboard.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

describe("parallelItemDetails", () => {
  test("orders description, progress, tokens, and elapsed time", () => {
    expect(parallelItemDetails({
      description: "Inspect adapter",
      progress: "running",
      tokens: 12_345,
      startedAt: 100_000,
    }, 161_000)).toEqual([
      "Inspect adapter",
      "running",
      "12,345 tokens",
      "01:01",
    ]);
  });
});

describe("Parallel", () => {
  test("renders current parallel work in its own compact region", async () => {
    const setup = await createTestRenderer({ width: 80, height: 10, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(createElement(Parallel, {
      state: {
        items: [{
          id: "worker-1",
          icon: "◇",
          name: "claude/Explore",
          description: "Inspect adapter",
          progress: "running · Read",
          tokens: 12,
        }],
      },
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const visibleText = [...Renderable.renderablesByNumber.values()]
      .filter((renderable): renderable is Renderable & { plainText: string } =>
        "plainText" in renderable
      )
      .map((renderable) => renderable.plainText)
      .join(" ");
    expect(visibleText).toContain("Parallel (1)");
    expect(visibleText).toContain("claude/Explore");
    expect(visibleText).toContain("Inspect adapter");
    expect(visibleText).toContain("running · Read · 12 tokens");
  });

  test("ChatShell places the optional region below the footer", async () => {
    const setup = await createTestRenderer({ width: 80, height: 14, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol: ChatProtocol = {
      stateStore: createChatStore({
        timeline: { items: [] },
        composer: {},
        activity: {},
        footer: { text: "ready" },
        parallel: { items: [{ id: "worker-1", name: "reviewer" }] },
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

    const visible = [...Renderable.renderablesByNumber.values()]
      .filter((renderable): renderable is Renderable & { plainText: string } =>
        "plainText" in renderable
      );
    const footer = visible.find((renderable) => renderable.plainText === "ready");
    const parallel = visible.find((renderable) => renderable.plainText === "Parallel (1)");
    expect(footer).toBeDefined();
    expect(parallel).toBeDefined();
    expect(parallel!.y).toBeGreaterThan(footer!.y);
  });
});
