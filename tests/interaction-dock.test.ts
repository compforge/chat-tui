import { afterEach, describe, expect, test } from "bun:test";
import { Renderable, TextareaRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { ChatShell } from "../src/components/chat-shell.tsx";
import type { ChatProtocol, ChatViewState } from "../src/protocol/index.ts";
import type { InteractionResponse } from "../src/types/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

function testProtocol(initial: ChatViewState) {
  let view = initial;
  let listener: (() => void) | undefined;
  const responses: Array<{ id: string; response: InteractionResponse }> = [];
  const protocol: ChatProtocol = {
    getView: () => view,
    subscribe(onChange) {
      listener = onChange;
      return () => {
        listener = undefined;
      };
    },
    submit: () => {},
    command: () => {},
    cancel: () => {},
    exit: () => {},
    resolvePicker: () => {},
    searchPicker: () => {},
    resolveInteraction(id, response) {
      responses.push({ id, response });
    },
  };
  return { protocol, responses };
}

async function mount(protocol: ChatProtocol) {
  const setup = await createTestRenderer({
    width: 90,
    height: 14,
    screenMode: "main-screen",
  });
  const root = createRoot(setup.renderer);
  mounted = { root, setup };
  root.render(createElement(ChatShell, { protocol, commands: [] }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await setup.flush();
  const composer = [...Renderable.renderablesByNumber.values()].find(
    (renderable): renderable is TextareaRenderable =>
      renderable instanceof TextareaRenderable,
  );
  if (!composer) throw new Error("composer was not rendered");
  return { setup, composer };
}

describe("InteractionDock", () => {
  test("shows a suggested input without overwriting the composer", async () => {
    const harness = testProtocol({
      transcript: [],
      interactions: [{
        id: "proposal_1",
        kind: "suggested_input",
        blocking: false,
        requester: "turn-coach",
        title: "Suggested follow-up",
        text: "Review the previous turn",
      }],
    });
    const { setup, composer } = await mount(harness.protocol);

    expect(composer.plainText).toBe("");
    expect(setup.captureCharFrame()).toContain("Needs your attention");
    expect(setup.captureCharFrame()).toContain("Review the previous turn");
  });

  test("uses a suggestion explicitly and resolves it only after submit", async () => {
    const harness = testProtocol({
      transcript: [],
      interactions: [{
        id: "proposal_2",
        kind: "suggested_input",
        blocking: false,
        title: "Suggested follow-up",
        text: "Check material risks",
      }],
    });
    const { setup, composer } = await mount(harness.protocol);

    setup.mockInput.pressKey("y", { ctrl: true });
    await setup.waitFor(() => composer.plainText === "Check material risks");
    await setup.waitFor(() => !setup.captureCharFrame().includes("Needs your attention"));
    expect(harness.responses).toEqual([]);

    setup.mockInput.pressEnter();
    await setup.waitFor(() => harness.responses.length === 1);
    expect(harness.responses).toEqual([{
      id: "proposal_2",
      response: {
        kind: "suggested_input",
        outcome: "submitted",
        text: "Check material risks",
      },
    }]);
  });

  test("dismisses a visible non-blocking suggestion with Ctrl+C", async () => {
    const harness = testProtocol({
      transcript: [],
      interactions: [{
        id: "proposal_3",
        kind: "suggested_input",
        blocking: false,
        title: "Suggested follow-up",
        text: "Check material risks",
      }],
    });
    const { setup } = await mount(harness.protocol);

    setup.mockInput.pressCtrlC();
    await setup.waitFor(() => harness.responses.length === 1);
    expect(harness.responses).toEqual([{
      id: "proposal_3",
      response: { kind: "suggested_input", outcome: "dismissed" },
    }]);
  });
});
