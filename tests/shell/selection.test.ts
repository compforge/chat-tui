import { afterEach, describe, expect, test } from "bun:test";
import {
  CodeRenderable,
  Renderable,
  TextareaRenderable,
  TextAttributes,
} from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { ChatShell } from "../../src/index.ts";
import { Transcript, type TranscriptProps } from "../../src/index.ts";
import type { ChatProtocol } from "../../src/index.ts";
import {
  createChatStore,
  type ChatState,
} from "../../src/index.ts";
import { tokenColumnRange, visualLineAt } from "../../src/index.ts";
import { useTokenSelectionOnDoubleClick } from "../../src/index.ts";

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

function testProtocol(initial: Partial<ChatState> = {}): ChatProtocol {
  return {
    stateStore: createChatStore({
      timeline: { items: [] },
      composer: {},
      activity: {},
      footer: {},
      sidecar: undefined,
      ...initial,
    }),
    submit: () => {},
    command: () => {},
    cancel: () => {},
    exit: () => {},
    resolvePicker: () => {},
    searchPicker: () => {},
    resolveInteraction: () => {},
  };
}

describe("double-click selection", () => {
  test("keeps session ids, paths, and URLs as one token", () => {
    expect(tokenColumnRange("Session: bs_01ABC-xyz", 14)).toEqual({ start: 9, end: 21 });
    expect(tokenColumnRange("Directory: /tmp/my-project", 16)).toEqual({ start: 11, end: 26 });
    expect(tokenColumnRange("See https://example.com/a-b", 18)).toEqual({ start: 4, end: 27 });
  });

  test("does not select whitespace and uses terminal columns for wide characters", () => {
    expect(tokenColumnRange("model codex", 5)).toBeNull();
    expect(tokenColumnRange("模型 codex", 1)).toEqual({ start: 0, end: 4 });
    expect(tokenColumnRange("模型 codex", 6)).toEqual({ start: 5, end: 10 });
  });

  test("maps wrapped text to its visible row", () => {
    expect(visualLineAt("Session: bs_01ABC-xyz", 12, 0)).toBe("Session:");
    expect(visualLineAt("Session: bs_01ABC-xyz", 12, 1)).toBe("bs_01ABC-xyz");
  });

  // 自定义壳的接线方式：hook 挂在根容器上，靠鼠标事件冒泡覆盖后代的一切可见文本
  function CustomShell(props: TranscriptProps) {
    const selectTokenOnDoubleClick = useTokenSelectionOnDoubleClick();
    return createElement("box", { onMouseDown: selectTokenOnDoubleClick }, createElement(Transcript, props));
  }

  test("messages use compact role markers instead of repeated author labels", async () => {
    const setup = await createTestRenderer({ width: 60, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(Transcript, {
        items: [
          { type: "message", id: "user", role: "user", author: "you", text: "Hello", format: "plain" },
          { type: "message", id: "agent", role: "agent", author: "codex", text: "Hi", format: "plain" },
          { type: "block", id: "tool", kind: "tool", status: "completed", author: "claude", title: "Read" },
        ],
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const visibleText = rendererItems(setup)
      .filter((renderable): renderable is Renderable & { plainText: string } => "plainText" in renderable)
      .map((renderable) => renderable.plainText);
    expect(visibleText).toContain("✨ ");
    expect(visibleText).toContain("●  ");
    expect(visibleText.some((text) =>
      text.includes("you >") || text.includes("codex >") || text.includes("claude ·")
    )).toBe(false);
  });

  test("underlines markdown link URLs", async () => {
    const setup = await createTestRenderer({ width: 80, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(Transcript, {
        items: [{
          type: "message",
          id: "agent",
          role: "agent",
          text: "Read [docs](https://example.com/guide)",
          format: "markdown",
        }],
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();
    const markdownBlocks = rendererItems(setup)
      .filter((renderable): renderable is CodeRenderable => renderable instanceof CodeRenderable);
    await Promise.all(markdownBlocks.map((renderable) => renderable.highlightingDone));
    await setup.flush();

    const underlinedText = setup.captureSpans().lines
      .flatMap((line) => line.spans)
      .filter((span) => (span.attributes & TextAttributes.UNDERLINE) !== 0)
      .map((span) => span.text)
      .join("");
    expect(underlinedText).toContain("https://example.com/guide");
    expect(underlinedText).not.toContain("docs");
  });

  test("double click expands OpenTUI's selection to the complete token", async () => {
    const setup = await createTestRenderer({ width: 60, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(CustomShell, {
        items: [
          { type: "message", id: "status", role: "agent", author: "baton", text: "Session: bs_01ABC-xyz", format: "plain" },
        ],
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const status = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "Session: bs_01ABC-xyz",
    );
    expect(status).toBeDefined();
    await setup.mockMouse.doubleClick(status!.x + 12, status!.y);

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("bs_01ABC-xyz");
  });

  test("double click selects and copies a token in markdown messages", async () => {
    const setup = await createTestRenderer({ width: 60, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol = testProtocol({
      timeline: {
        items: [
        {
          type: "message",
          id: "answer",
          role: "agent",
          author: "claude",
          text: "Check `meta.json` before persisting.",
          format: "markdown",
        },
        ],
      },
    });
    let copied = "";
    setup.renderer.copyToClipboardOSC52 = (text) => {
      copied = text;
      return true;
    };
    root.render(createElement(ChatShell, { protocol, commands: [] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();
    const markdownBlocks = rendererItems(setup)
      .filter((renderable): renderable is CodeRenderable => renderable instanceof CodeRenderable);
    await Promise.all(markdownBlocks.map((renderable) => renderable.highlightingDone));
    await setup.flush();

    const answer = rendererItems(setup).find(
      (renderable) =>
        "plainText" in renderable &&
        typeof renderable.plainText === "string" &&
        renderable.plainText.includes("meta.json"),
    );
    expect(answer).toBeDefined();
    const tokenColumn = (answer as Renderable & { plainText: string }).plainText.indexOf("meta.json") + 1;
    await setup.mockMouse.doubleClick(answer!.x + tokenColumn, answer!.y);

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("meta.json");
    expect(copied).toBe("meta.json");
  });

  test("keeps the footer visible with a toast and supports double-click copy", async () => {
    const setup = await createTestRenderer({ width: 80, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol = testProtocol({
      footer: {
        toast: { text: "claude turn queued", tone: "info" },
        text: "session: bs_01ABC-xyz  turns:2",
      },
    });
    let copied = "";
    setup.renderer.copyToClipboardOSC52 = (text) => {
      copied = text;
      return true;
    };
    root.render(createElement(ChatShell, { protocol, commands: [] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const footer = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "session: bs_01ABC-xyz  turns:2",
    );
    const status = rendererItems(setup).find(
      (renderable) => "plainText" in renderable && renderable.plainText === "claude turn queued",
    );
    expect(status).toBeDefined();
    expect(footer).toBeDefined();
    await setup.mockMouse.doubleClick(footer!.x + 12, footer!.y);

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("bs_01ABC-xyz");
    expect(copied).toBe("bs_01ABC-xyz");
  });

  test("double click copies a token in the composer", async () => {
    const setup = await createTestRenderer({ width: 80, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const protocol = testProtocol();
    let copied = "";
    setup.renderer.copyToClipboardOSC52 = (text) => {
      copied = text;
      return true;
    };
    root.render(createElement(ChatShell, { protocol, commands: [] }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const composer = rendererItems(setup).find(
      (renderable): renderable is TextareaRenderable => renderable instanceof TextareaRenderable,
    );
    expect(composer).toBeDefined();
    composer!.setText("copy meta.json please");
    await setup.flush();
    await setup.mockMouse.doubleClick(composer!.x + 7, composer!.y);

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("meta.json");
    expect(copied).toBe("meta.json");
  });
});
