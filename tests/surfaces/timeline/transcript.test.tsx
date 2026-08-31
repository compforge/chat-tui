import { afterEach, describe, expect, test } from "bun:test";
import { Renderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { InputProvider, Transcript } from "../../../src/index.ts";
import { createTestClipboard } from "../../clipboard.ts";

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

function longOutputBlock(id: string, lines: number) {
  return {
    type: "block" as const,
    id,
    kind: "tool",
    status: "completed" as const,
    title: `Run ${id}`,
    content: {
      type: "output" as const,
      lines: Array.from({ length: lines }, (_, i) => `${id}-out-${i + 1}`),
    },
  };
}

function frameRows(setup: TestRendererSetup): string[] {
  return setup.captureCharFrame().split("\n");
}

describe("Transcript per-block expansion", () => {
  async function mountTwoClippedBlocks() {
    const setup = await createTestRenderer({ width: 80, height: 24, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(
        InputProvider,
        null,
        createElement(Transcript, {
          items: [longOutputBlock("b1", 10), longOutputBlock("b2", 10)],
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();
    return setup;
  }

  function hintRow(frame: string[], marker: string): number {
    // 裁剪提示行位于 block 标题之后：先找标题行，再找其后的提示行
    const titleRow = frame.findIndex((row) => row.includes(marker));
    expect(titleRow).toBeGreaterThanOrEqual(0);
    const row = frame.findIndex(
      (line, index) => index > titleRow && line.includes("(ctrl+o to expand)"),
    );
    expect(row).toBeGreaterThan(titleRow);
    return row;
  }

  function collapseRow(frame: string[], marker: string): number {
    // 收起提示行在该 block 标题之后的内容尾部
    const titleRow = frame.findIndex((row) => row.includes(marker));
    expect(titleRow).toBeGreaterThanOrEqual(0);
    const row = frame.findIndex(
      (line, index) => index > titleRow && line.includes("(click to collapse)"),
    );
    expect(row).toBeGreaterThan(titleRow);
    return row;
  }

  test("clicking a clip hint expands only that block, clicking again collapses it", async () => {
    const setup = await mountTwoClippedBlocks();

    expect(visibleText().some((text) => text.includes("(ctrl+o to expand)"))).toBe(true);
    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(false);

    const row = hintRow(frameRows(setup), "Run b1");
    await setup.mockMouse.click(6, row);
    await setup.flush();

    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(true);
    // 另一块保持裁剪
    expect(visibleText().some((text) => text.includes("b2-out-5"))).toBe(false);

    // 按块展开后内容尾部出现收起提示行；点击它只收起该块
    const collapse = collapseRow(frameRows(setup), "Run b1");
    await setup.mockMouse.click(6, collapse);
    await setup.flush();
    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(false);
    expect(visibleText().some((text) => text.includes("b2-out-5"))).toBe(false);
  });

  test("a drag starting on the hint does not toggle expansion", async () => {
    const setup = await mountTwoClippedBlocks();
    const row = hintRow(frameRows(setup), "Run b1");

    await setup.mockMouse.drag(6, row, 20, row);
    await setup.flush();

    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(false);
  });

  test("per-block expansion is independent across blocks", async () => {
    const setup = await mountTwoClippedBlocks();
    const row = hintRow(frameRows(setup), "Run b1");
    await setup.mockMouse.click(6, row);
    await setup.flush();
    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(true);

    const b2Row = hintRow(frameRows(setup), "Run b2");
    await setup.mockMouse.click(6, b2Row);
    await setup.flush();
    expect(visibleText().some((text) => text.includes("b2-out-5"))).toBe(true);
    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(true);
  });

  test("global Ctrl+O expansion shows everything without collapse hints", async () => {
    const setup = await mountTwoClippedBlocks();

    const settle = async () => {
      await setup.flush();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await setup.flush();
    };
    setup.mockInput.pressKey("o", { ctrl: true });
    await settle();

    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(true);
    expect(visibleText().some((text) => text.includes("b2-out-5"))).toBe(true);
    // 全局展开不收起提示行——那是按块展开的配套；全局收起走 Ctrl+O
    expect(visibleText().some((text) => text.includes("(click to collapse)"))).toBe(false);
  });

  test("global Ctrl+O collapse clears per-block expansion", async () => {
    const setup = await mountTwoClippedBlocks();
    const row = hintRow(frameRows(setup), "Run b1");
    await setup.mockMouse.click(6, row);
    await setup.flush();

    // 测试渲染器空闲后按键，React 状态提交要晚一个 pass——让出一拍再多 flush 一次
    const settle = async () => {
      await setup.flush();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await setup.flush();
    };
    setup.mockInput.pressKey("o", { ctrl: true });
    await settle();
    expect(visibleText().some((text) => text.includes("b2-out-5"))).toBe(true);

    setup.mockInput.pressKey("o", { ctrl: true });
    await settle();
    expect(visibleText().some((text) => text.includes("b1-out-5"))).toBe(false);
    expect(visibleText().some((text) => text.includes("b2-out-5"))).toBe(false);
  });
});

describe("Transcript copy last agent message", () => {
  test("ctrl+shift+y copies the latest agent message and toasts", async () => {
    const setup = await createTestRenderer({ width: 80, height: 20, screenMode: "main-screen", kittyKeyboard: true });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const copied: string[] = [];
    const clipboard = createTestClipboard((text) => copied.push(text));
    const toasts: string[] = [];
    root.render(
      createElement(
        InputProvider,
        null,
        createElement(Transcript, {
          items: [
            { type: "message", id: "u1", role: "user", text: "question" },
            {
              type: "message",
              id: "a1",
              role: "agent",
              text: "```ts\nconst a = 1;\n```",
            },
          ],
          clipboard,
          onToast: (toast) => toasts.push(toast?.text ?? ""),
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    setup.mockInput.pressKey("y", { ctrl: true, shift: true });
    await setup.flush();

    // 整条消息只有一个 code fence：复制纯代码
    expect(copied).toEqual(["const a = 1;"]);
    expect(toasts).toEqual(["Copied message to clipboard"]);
  });

  test("does nothing without an agent message", async () => {
    const setup = await createTestRenderer({ width: 80, height: 20, screenMode: "main-screen", kittyKeyboard: true });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const copied: string[] = [];
    const clipboard = createTestClipboard((text) => copied.push(text));
    const toasts: string[] = [];
    root.render(
      createElement(
        InputProvider,
        null,
        createElement(Transcript, {
          items: [{ type: "message", id: "u1", role: "user", text: "question" }],
          clipboard,
          onToast: (toast) => toasts.push(toast?.text ?? ""),
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    setup.mockInput.pressKey("y", { ctrl: true, shift: true });
    await setup.flush();

    expect(copied).toEqual([]);
    expect(toasts).toEqual([]);
  });
});
