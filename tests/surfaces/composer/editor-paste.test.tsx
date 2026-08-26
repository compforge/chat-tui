import { afterEach, describe, expect, test } from "bun:test";
import { TextareaRenderable } from "@opentui/core";
import {
  createTestRenderer,
  type TestRendererSetup,
} from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement, createRef } from "react";

import {
  ComposerEditor,
  InputProvider,
  type ComposerHandle,
} from "../../../src/index.ts";
import { visiblePasteTokenText } from "../../../src/surfaces/composer/paste.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

const multiline = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n");

async function mount(props: {
  onChange?: (text: string) => void;
  onSubmit?: (text: string) => void;
  editorRef?: ReturnType<typeof createRef<ComposerHandle>>;
}) {
  const setup = await createTestRenderer({
    width: 80,
    height: 20,
    screenMode: "main-screen",
  });
  const root = createRoot(setup.renderer);
  mounted = { root, setup };
  root.render(
    createElement(
      InputProvider,
      null,
      createElement(ComposerEditor, {
        ref: props.editorRef,
        focused: true,
        onChange: props.onChange ?? (() => undefined),
        onSubmit: props.onSubmit ?? (() => undefined),
      }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await setup.flush();
  return setup;
}

function bufferText(setup: TestRendererSetup): string {
  const textarea = setup.renderer.currentFocusedRenderable;
  if (!(textarea instanceof TextareaRenderable)) throw new Error("no textarea");
  return textarea.plainText;
}

function focusedTextarea(setup: TestRendererSetup): TextareaRenderable {
  const textarea = setup.renderer.currentFocusedRenderable;
  if (!(textarea instanceof TextareaRenderable)) throw new Error("no textarea");
  return textarea;
}

describe("ComposerEditor paste folding", () => {
  test("a large bracketed paste becomes an atomic token and submits the original", async () => {
    const submitted: string[] = [];
    const editorRef = createRef<ComposerHandle>();
    const setup = await mount({
      editorRef,
      onSubmit: (text) => submitted.push(text),
    });

    await setup.mockInput.pasteBracketedText(multiline);
    await setup.flush();
    expect(visiblePasteTokenText(bufferText(setup))).toBe("[Pasted #1 ~12 lines]");

    editorRef.current?.editText(`review ${bufferText(setup)}`);
    setup.mockInput.pressEnter();
    await setup.flush();
    expect(submitted).toEqual([`review ${multiline}`]);

    editorRef.current?.setText("[Pasted #1 ~12 lines]");
    setup.mockInput.pressEnter();
    await setup.flush();
    expect(submitted).toEqual([
      `review ${multiline}`,
      "[Pasted #1 ~12 lines]",
    ]);
  });

  test("a small paste keeps the default verbatim behavior", async () => {
    const setup = await mount({});
    await setup.mockInput.pasteBracketedText("tiny paste");
    await setup.flush();
    expect(bufferText(setup)).toBe("tiny paste");
  });

  test("backspace on a token removes it as a whole and it no longer expands", async () => {
    const submitted: string[] = [];
    const setup = await mount({ onSubmit: (text) => submitted.push(text) });

    await setup.mockInput.pasteBracketedText(multiline);
    await setup.flush();
    // 光标在 token 末尾（插入后即在末尾），一次 backspace 整体删除
    setup.mockInput.pressBackspace();
    await setup.flush();
    expect(bufferText(setup)).toBe("");

    setup.mockInput.typeText("ok");
    setup.mockInput.pressEnter();
    await setup.flush();
    expect(submitted).toEqual(["ok"]);
  });

  test("repeated large pastes get incrementing token ids", async () => {
    const setup = await mount({});
    await setup.mockInput.pasteBracketedText(multiline);
    await setup.mockInput.pasteBracketedText("x".repeat(300));
    await setup.flush();
    expect(visiblePasteTokenText(bufferText(setup))).toBe(
      "[Pasted #1 ~12 lines][Pasted #2 300 chars]",
    );
  });

  test("a literal look-alike remains literal when the matching chip exists", async () => {
    const submitted: string[] = [];
    const setup = await mount({ onSubmit: (text) => submitted.push(text) });
    setup.mockInput.typeText("[Pasted #1 ~12 lines] ");
    await setup.mockInput.pasteBracketedText(multiline);
    setup.mockInput.pressEnter();
    await setup.flush();
    expect(submitted).toEqual([`[Pasted #1 ~12 lines] ${multiline}`]);
  });

  test("editing a partial token selection replaces the whole chip", async () => {
    const submitted: string[] = [];
    const setup = await mount({ onSubmit: (text) => submitted.push(text) });
    await setup.mockInput.pasteBracketedText(multiline);
    focusedTextarea(setup).setSelection(2, 6);
    setup.mockInput.typeText("x");
    setup.mockInput.pressEnter();
    await setup.flush();
    expect(submitted).toEqual(["x"]);
  });

});
