import { afterEach, describe, expect, test } from "bun:test";
import { Renderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { InputProvider, Transcript } from "../../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

function visibleText(): string[] {
  return [...Renderable.renderablesByNumber.values()]
    .filter((renderable): renderable is Renderable & { plainText: string } => "plainText" in renderable)
    .map((renderable) => renderable.plainText);
}

describe("Transcript groups", () => {
  test("keeps a collapsed group to one row and reveals intact members with Ctrl+O", async () => {
    const setup = await createTestRenderer({ width: 80, height: 20, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(
        InputProvider,
        null,
        createElement(Transcript, {
          items: [{
            type: "group",
            id: "read-group-1",
            collapsedByDefault: true,
            summary: {
              type: "block",
              id: "read-group-1:summary",
              kind: "tool",
              status: "completed",
              title: "Read ×2",
            },
            members: [
              {
                type: "block",
                id: "read-1:child",
                kind: "tool",
                status: "completed",
                title: "Read · src/one.ts",
                content: { type: "output", lines: ["one"] },
              },
              {
                type: "block",
                id: "read-2",
                kind: "tool",
                status: "completed",
                title: "Read · src/two.ts",
                content: { type: "output", lines: ["two"] },
              },
            ],
          }],
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    expect(visibleText().some((text) => text.includes("Read ×2"))).toBe(true);
    expect(visibleText().some((text) => text.includes("src/one.ts"))).toBe(false);
    expect(visibleText().some((text) => text.includes("src/two.ts"))).toBe(false);

    setup.mockInput.pressKey("o", { ctrl: true });
    await setup.flush();

    expect(visibleText().some((text) => text.includes("src/one.ts"))).toBe(true);
    expect(visibleText().some((text) => text.includes("src/two.ts"))).toBe(true);
    expect(visibleText().some((text) => text.includes("└ one"))).toBe(true);
    expect(visibleText().some((text) => text.includes("└ two"))).toBe(true);
  });

  test("renders a singleton group as a transparent stable container when expanded", async () => {
    const setup = await createTestRenderer({ width: 80, height: 20, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(
        InputProvider,
        null,
        createElement(Transcript, {
          items: [{
            type: "group",
            id: "thought-group-1",
            collapsedByDefault: true,
            summary: {
              type: "block",
              id: "thought-group-1:summary",
              kind: "thought",
              status: "completed",
              title: "Inspecting files",
            },
            members: [{
              type: "block",
              id: "thought-1",
              kind: "thought",
              status: "completed",
              title: "Inspecting files",
              content: { type: "text", text: "detail" },
            }],
          }],
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    setup.mockInput.pressKey("o", { ctrl: true });
    await setup.flush();

    const matches = visibleText().filter((text) => text.includes("Inspecting files"));
    expect(matches).toHaveLength(1);
    expect(visibleText().some((text) => text.includes("└ detail"))).toBe(true);
  });
});
