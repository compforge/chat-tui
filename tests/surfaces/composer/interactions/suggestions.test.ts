import { afterEach, describe, expect, test } from "bun:test";
import {
  BoxRenderable,
  Renderable,
  TextRenderable,
} from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, useKeyboard, type Root } from "@opentui/react";
import { createElement, useState } from "react";

import {
  defaultTheme,
  Suggestions,
  type Candidate,
} from "../../../../src/index.ts";
import { marqueeContent } from "../../../../src/terminal/marquee.tsx";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

const candidates: Candidate[] = [
  {
    insert: "@first",
    label: "@first",
    detail: "A selected candidate with a complete title that exceeds one row",
  },
  {
    insert: "@second",
    label: "@second",
    detail: "An inactive candidate with another complete title that exceeds one row",
  },
];

function SelectableSuggestions() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  useKeyboard((key) => {
    if (key.name !== "down") return;
    key.preventDefault();
    setSelectedIndex(1);
  });
  return createElement(Suggestions, {
    candidates,
    selectedIndex,
    anchorBottom: 3,
    theme: defaultTheme,
  });
}

describe("Suggestions", () => {
  test("keeps every candidate on one row and scrolls only the selected overflow", async () => {
    const setup = await createTestRenderer({
      width: 54,
      height: 14,
      screenMode: "main-screen",
    });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(createElement(SelectableSuggestions));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const suggestions = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is BoxRenderable =>
        renderable instanceof BoxRenderable &&
        Boolean(renderable.title?.startsWith("Suggestions")),
    );
    const rows = [...Renderable.renderablesByNumber.values()].filter(
      (renderable): renderable is TextRenderable =>
        renderable instanceof TextRenderable &&
        (
          renderable.plainText === marqueeContent(
            `${candidates[0]!.label}  ${candidates[0]!.detail}`,
          ).text ||
          renderable.plainText.startsWith(candidates[1]!.label)
        ),
    );
    const selected = rows.find((row) =>
      row.plainText === marqueeContent(
        `${candidates[0]!.label}  ${candidates[0]!.detail}`,
      ).text
    );
    const inactive = rows.find((row) =>
      row.plainText.startsWith(candidates[1]!.label)
    );

    expect(suggestions?.width).toBe(50);
    expect(suggestions?.height).toBe(4);
    expect(selected?.height).toBe(1);
    expect(inactive?.height).toBe(1);
    expect(inactive?.plainText.endsWith("…")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(selected?.scrollX).toBeGreaterThan(0);
    expect(inactive?.scrollX).toBe(0);

    setup.mockInput.pressArrow("down");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const first = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is TextRenderable =>
        renderable instanceof TextRenderable &&
        renderable.plainText.startsWith(candidates[0]!.label),
    );
    const second = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is TextRenderable =>
        renderable instanceof TextRenderable &&
        renderable.plainText === marqueeContent(
          `${candidates[1]!.label}  ${candidates[1]!.detail}`,
        ).text,
    );
    expect(first?.plainText.endsWith("…")).toBe(true);
    expect(first?.scrollX).toBe(0);
    expect(second?.scrollX).toBe(0);
  });
});
