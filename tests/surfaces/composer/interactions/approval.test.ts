import { afterEach, describe, expect, test } from "bun:test";
import { Renderable, SelectRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { ApprovalCard } from "../../../../src/index.ts";
import { approvalCardLayout } from "../../../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

const OPTIONS = [
  { optionId: "accept", name: "Allow once", kind: "allow_once" },
  { optionId: "acceptForSession", name: "Allow for this session", kind: "allow_always" },
  { optionId: "decline", name: "Deny (agent continues)", kind: "reject_once" },
  { optionId: "cancel", name: "Deny and interrupt turn", kind: "reject_always" },
];

const LONG_COMMAND =
  "/bin/zsh -lc 'bash /Users/bytedance/.codex/plugins/cache/devloop/devloop/0.1.38/scripts/smart_gcampr.sh " +
  "--message-file /Users/bytedance/myprojects/mono-agent/chat-tui/.devloop/commit_msg " +
  "--repo /Users/bytedance/myprojects/mono-agent/chat-tui --branch feat/footer-double-click-copy " +
  "--files src/shell/chat-shell.tsx,src/surfaces/footer/toast-line.tsx,src/shell/token-selection.ts," +
  "src/surfaces/timeline/transcript.tsx,tests/shell/selection.test.ts'";

describe("approval card", () => {
  test("reserves visible action rows when operation details wrap", async () => {
    const setup = await createTestRenderer({ width: 120, height: 24, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    let selected = "";
    root.render(
      createElement(ApprovalCard, {
        approval: { title: `Run command: ${LONG_COMMAND}`, options: OPTIONS },
        anchorBottom: 4,
        onSelect: (optionId: string) => {
          selected = optionId;
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const select = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is SelectRenderable => renderable instanceof SelectRenderable,
    );
    expect(select?.height).toBe(OPTIONS.length);
    expect(setup.captureCharFrame()).toContain("Allow once");

    // The approval is a blocking modal, so its actions remain keyboard-operable
    // even if the terminal/window transition cleared OpenTUI's renderable focus.
    select?.blur();
    setup.mockInput.pressArrow("down");
    expect(select?.getSelectedIndex()).toBe(1);
    setup.mockInput.pressEnter();
    expect(selected).toBe("acceptForSession");
  });

  test("keeps at least one detail and action row on a short terminal", () => {
    expect(
      approvalCardLayout({
        terminalWidth: 40,
        terminalHeight: 8,
        anchorBottom: 3,
        detail: LONG_COMMAND,
        optionCount: OPTIONS.length,
      }),
    ).toMatchObject({ height: 4, detailRows: 1, actionRows: 1 });
  });

  test("renders an explicit fail-closed state without approval options", async () => {
    const setup = await createTestRenderer({ width: 80, height: 12, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    root.render(
      createElement(ApprovalCard, {
        approval: { title: "Run command?", description: LONG_COMMAND, options: [] },
        anchorBottom: 3,
        onSelect: () => {},
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    expect(setup.captureCharFrame()).toContain("No approval actions available");
  });
});
