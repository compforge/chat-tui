import { afterEach, describe, expect, test } from "bun:test";
import {
  createTestRenderer,
  type TestRendererSetup,
} from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { RunStatus } from "../../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

async function mount(props: {
  items: { id: string; label: string; startedAt?: number }[];
  tips?: string[];
  width?: number;
}) {
  const setup = await createTestRenderer({
    width: props.width ?? 80,
    height: 10,
    screenMode: "main-screen",
  });
  const root = createRoot(setup.renderer);
  mounted = { root, setup };
  root.render(createElement(RunStatus, { items: props.items, tips: props.tips }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await setup.flush();
  return setup;
}

describe("RunStatus rotating tips", () => {
  test("appends a dim tip to the status row while running", async () => {
    const setup = await mount({
      items: [{ id: "1", label: "Thinking", startedAt: Date.now() }],
      tips: ["Use /help to list commands"],
    });
    expect(setup.captureCharFrame()).toContain("· Tip: Use /help to list commands");
  });

  test("renders no tip without a corpus", async () => {
    const setup = await mount({
      items: [{ id: "1", label: "Thinking", startedAt: Date.now() }],
    });
    expect(setup.captureCharFrame()).not.toContain("Tip:");
  });

  test("renders nothing when idle, tips or not", async () => {
    const setup = await mount({ items: [], tips: ["unused"] });
    expect(setup.captureCharFrame().trim()).toBe("");
  });

  test("truncates the tip with an ellipsis on a narrow terminal", async () => {
    const setup = await mount({
      width: 40,
      items: [{ id: "1", label: "Thinking", startedAt: Date.now() }],
      tips: ["a fairly long tip that cannot fit here"],
    });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("· Tip: a fairly lo…");
    expect(frame).not.toContain("cannot fit here");
  });

  test("drops the tip entirely when the row cannot hold even a stub", async () => {
    const setup = await mount({
      width: 30,
      items: [{ id: "1", label: "Thinking", startedAt: Date.now() }],
      tips: ["a fairly long tip that cannot fit here"],
    });
    expect(setup.captureCharFrame()).not.toContain("Tip:");
  });
});
