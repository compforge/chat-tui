import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { QuestionCard } from "../../../../src/index.ts";
import { questionCardLayout } from "../../../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

const LONG_DESCRIPTION =
  "This option re-indexes the whole repository, invalidates every cached embedding, " +
  "rebuilds the symbol table from scratch, and may take several minutes on large monorepos. " +
  "Prefer the incremental option unless the index is known to be corrupted or the schema changed. " +
  "It also drops all warm caches, replays the full ingest pipeline for every tracked file, " +
  "re-computes cross-file references, and re-validates every stored checksum before swapping " +
  "the new index in atomically, so interrupted runs never leave a half-built index behind.";

describe("question card layout", () => {
  test("card width follows the terminal within its density bounds", () => {
    const narrow = questionCardLayout({ terminalWidth: 20, terminalHeight: 24, choiceCount: 2, hasPreview: false });
    expect(narrow.width).toBe(24); // 窄终端不塌成不可读
    const wide = questionCardLayout({ terminalWidth: 200, terminalHeight: 24, choiceCount: 2, hasPreview: false });
    expect(wide.width).toBe(76); // 宽终端不无限铺开
    const mid = questionCardLayout({ terminalWidth: 60, terminalHeight: 24, choiceCount: 2, hasPreview: false });
    expect(mid.width).toBe(56);
    expect(mid.descWidth).toBe(50);
  });

  test("clips the focused detail with an explicit remainder trace", () => {
    const layout = questionCardLayout({
      terminalWidth: 80,
      terminalHeight: 40,
      choiceCount: 2,
      focusedDescription: LONG_DESCRIPTION,
      hasPreview: false,
    });
    expect(layout.detailLines.length).toBe(6); // DETAIL_MAX_ROWS：详情不许顶穿卡片
    expect(layout.detailHidden).toBeGreaterThan(0); // 被截必须留痕，不静默吞
  });

  test("caps the card height on a short terminal while keeping the floor", () => {
    const layout = questionCardLayout({
      terminalWidth: 80,
      terminalHeight: 14,
      choiceCount: 6,
      focusedDescription: LONG_DESCRIPTION,
      hasPreview: true,
    });
    expect(layout.height).toBe(8); // max(8, 14 - 6)：给输入区留位，卡片自身保底可用
  });

  test("sizes to content when the terminal has room", () => {
    const layout = questionCardLayout({ terminalWidth: 80, terminalHeight: 40, choiceCount: 3, hasPreview: false });
    expect(layout.height).toBe(9); // 3 项 × 2 行 + 边框 2 + 问题行 1
  });

  test("keeps every option visible when the focused description already fits inline", async () => {
    const setup = await createTestRenderer({ width: 120, height: 30, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(QuestionCard, {
        requestId: "req-1",
        question: {
          questions: [
            {
              id: "q1",
              header: "Requirement",
              question: "Which Requirement should compforge/reqloop PR/MR 48 join?",
              options: [
                { label: "Trace analysis", description: "llmops · story · 7282882268" },
                { label: "Keep standalone", description: "" },
              ],
            },
          ],
        },
        anchorBottom: 4,
        onSubmit: () => {},
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Trace analysis");
    expect(frame).toContain("Keep standalone");
    expect(frame.match(/llmops · story · 7282882268/g)).toHaveLength(1);
  });

  test("renders the truncation trace for a long focused description", async () => {
    const setup = await createTestRenderer({ width: 80, height: 40, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(QuestionCard, {
        requestId: "req-1",
        question: {
          questions: [
            {
              id: "q1",
              header: "Index",
              question: "How should the index be rebuilt?",
              options: [
                { label: "Full rebuild", description: LONG_DESCRIPTION },
                { label: "Incremental", description: "Only re-index changed files" },
              ],
            },
          ],
        },
        anchorBottom: 4,
        onSubmit: () => {},
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Full rebuild");
    expect(frame).toContain("… +"); // 焦点详情超预算：留痕行可见
  });
});
