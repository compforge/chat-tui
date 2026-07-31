import { afterEach, describe, expect, test } from "bun:test";
import {
  BoxRenderable,
  InputRenderable,
  Renderable,
  SelectRenderable,
  TextareaRenderable,
} from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import { ChatShell } from "../../../../src/index.ts";
import type { ChatProtocol } from "../../../../src/index.ts";
import {
  createChatStore,
  type ChatState,
  type ChatStore,
} from "../../../../src/index.ts";
import type { InteractionResponse } from "../../../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

function testProtocol(initial: Partial<ChatState> = {}) {
  const responses: Array<{ id: string; response: InteractionResponse }> = [];
  const turnCancels: string[] = [];
  const pickerResults: Array<{ id: string; value: string | null }> = [];
  const sidecarDismisses: string[] = [];
  const stateStore = createChatStore({
    timeline: { items: [] },
    composer: {},
    activity: {},
    footer: {},
    sidecar: undefined,
    ...initial,
  });
  const protocol: ChatProtocol = {
    stateStore,
    submit: () => {},
    command: () => {},
    cancel: () => {
      turnCancels.push("cancel");
    },
    exit: () => {},
    resolvePicker: (id, value) => {
      pickerResults.push({ id, value });
    },
    searchPicker: () => {},
    dismissSidecar: () => {
      sidecarDismisses.push("dismiss");
    },
    resolveInteraction(id, response) {
      responses.push({ id, response });
    },
  };
  return {
    protocol,
    responses,
    turnCancels,
    pickerResults,
    sidecarDismisses,
    stateStore,
  };
}

async function mount(
  protocol: ChatProtocol,
  dimensions: { width: number; height: number } = {
    width: 90,
    height: 14,
  },
) {
  const setup = await createTestRenderer({
    width: dimensions.width,
    height: dimensions.height,
    kittyKeyboard: true,
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
  test("sends Shift+Tab as a mode-cycle intent without changing the draft", async () => {
    const harness = testProtocol();
    let cycles = 0;
    harness.protocol.cycleMode = () => {
      cycles++;
    };
    const { setup, composer } = await mount(harness.protocol);

    for (const key of "draft") setup.mockInput.pressKey(key);
    await setup.waitFor(() => composer.plainText === "draft");
    setup.mockInput.pressTab({ shift: true });
    await setup.waitFor(() => cycles === 1);

    expect(composer.plainText).toBe("draft");
  });

  test("preserves the active composer while the sidecar updates", async () => {
    const harness = testProtocol({
      sidecar: {
        title: "Board",
        mode: "open",
        sections: [{
          id: "active",
          items: [{ id: "task", title: "Reconcile" }],
        }],
      },
    });
    const runtime = harness.stateStore;
    let composerReads = 0;
    const protocol: ChatProtocol = {
      ...harness.protocol,
      stateStore: new Proxy(runtime, {
        get(target, property, receiver) {
          if (property !== "getState") {
            return Reflect.get(target, property, receiver);
          }
          return (key: keyof ChatState) => {
            if (key === "composer") composerReads += 1;
            return target.getState(key);
          };
        },
      }) as ChatStore,
    };
    const { setup, composer } = await mount(protocol);

    for (const key of "draft") setup.mockInput.pressKey(key);
    await setup.waitFor(() => composer.plainText === "draft");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();
    composerReads = 0;

    for (let index = 0; index < 100; index++) {
      runtime.commit({
        sidecar: {
          title: "Board",
          mode: "open",
          sections: [{
            id: "active",
            items: [{
              id: "task",
              title: "Reconcile",
              detail: `revision ${index}`,
            }],
          }],
        },
      });
    }
    await setup.flush();

    const currentComposer = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is TextareaRenderable =>
        renderable instanceof TextareaRenderable,
    );
    expect(currentComposer).toBe(composer);
    expect(currentComposer?.plainText).toBe("draft");
    expect(composerReads).toBe(0);
  });

  test("shows a suggested input without overwriting the composer", async () => {
    const harness = testProtocol({
      composer: {
        interactions: [{
          id: "proposal_1",
          kind: "suggested_input",
          blocking: false,
          requester: "turn-coach",
          title: "Suggested follow-up",
          text: "Review the previous turn",
          cancelResponse: { kind: "suggested_input", outcome: "dismissed" },
        }],
      },
    });
    const { setup, composer } = await mount(harness.protocol, {
      width: 120,
      height: 32,
    });
    const suggestion = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is BoxRenderable =>
        renderable instanceof BoxRenderable &&
        renderable.title === "Needs your attention",
    );

    expect(composer.plainText).toBe("");
    expect(suggestion?.width).toBe(112);
    expect(suggestion?.height).toBe(18);
    expect(setup.captureCharFrame()).toContain("Needs your attention");
    expect(setup.captureCharFrame()).toContain("Review the previous turn");
    expect(setup.captureCharFrame()).toContain("Use in composer  (Ctrl+Y)");
    expect(setup.captureCharFrame()).toContain("Dismiss  (Ctrl+C)");
  });

  test("chooses a visible suggestion action with arrow keys and Enter", async () => {
    const harness = testProtocol({
      composer: {
        interactions: [{
          id: "proposal_options",
          kind: "suggested_input",
          blocking: false,
          title: "Suggested follow-up",
          text: "Check material risks",
          cancelResponse: { kind: "suggested_input", outcome: "dismissed" },
        }],
      },
    });
    const { setup } = await mount(harness.protocol);
    const select = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is SelectRenderable =>
        renderable instanceof SelectRenderable,
    );
    expect(select?.focused).toBe(true);

    setup.mockInput.pressArrow("down");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();
    expect(select?.getSelectedIndex()).toBe(1);
    setup.mockInput.pressEnter();
    await setup.waitFor(() => harness.responses.length === 1);
    expect(harness.responses).toEqual([{
      id: "proposal_options",
      response: { kind: "suggested_input", outcome: "dismissed" },
    }]);
  });

  test("uses a suggestion explicitly and resolves it only after submit", async () => {
    const harness = testProtocol({
      composer: {
        interactions: [{
          id: "proposal_2",
          kind: "suggested_input",
          blocking: false,
          title: "Suggested follow-up",
          text: "Check material risks",
          cancelResponse: { kind: "suggested_input", outcome: "dismissed" },
        }],
      },
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
      composer: {
        interactions: [{
          id: "proposal_3",
          kind: "suggested_input",
          blocking: false,
          title: "Suggested follow-up",
          text: "Check material risks",
          cancelResponse: { kind: "suggested_input", outcome: "dismissed" },
        }],
      },
    });
    const { setup } = await mount(harness.protocol);

    setup.mockInput.pressCtrlC();
    await setup.waitFor(() => harness.responses.length === 1);
    expect(harness.responses).toEqual([{
      id: "proposal_3",
      response: { kind: "suggested_input", outcome: "dismissed" },
    }]);
  });

  test("routes Esc through the active interaction's declared response", async () => {
    const harness = testProtocol({
      composer: {
        busy: true,
        interactions: [{
          id: "proposal_4",
          kind: "suggested_input",
          blocking: false,
          title: "Suggested follow-up",
          text: "Check material risks",
          cancelResponse: { kind: "suggested_input", outcome: "dismissed" },
        }],
      },
    });
    const { setup } = await mount(harness.protocol);

    setup.mockInput.pressEscape();
    await setup.waitFor(() => harness.responses.length === 1);
    expect(harness.responses).toEqual([{
      id: "proposal_4",
      response: { kind: "suggested_input", outcome: "dismissed" },
    }]);
    expect(harness.turnCancels).toEqual([]);
  });

  test("an inner question editor handles Esc before the interaction", async () => {
    const harness = testProtocol({
      composer: {
        interactions: [{
          id: "question_1",
          kind: "question",
          blocking: true,
          cancelResponse: { kind: "cancelled" },
          question: {
            questions: [{
              id: "strategy",
              header: "Strategy",
              question: "How should this run?",
              options: [{
                label: "Automatic",
                description: "Use defaults",
              }],
              allowOther: true,
            }],
          },
        }],
      },
    });
    const { setup } = await mount(harness.protocol);

    const choices = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is SelectRenderable =>
        renderable instanceof SelectRenderable,
    );
    if (!choices) throw new Error("question choices were not rendered");
    choices.moveDown();
    choices.selectCurrent();
    await setup.waitFor(() =>
      setup.renderer.currentFocusedRenderable instanceof InputRenderable
    );

    setup.mockInput.pressEscape();
    await setup.waitFor(() =>
      setup.captureCharFrame().includes("Automatic")
    );
    expect(harness.responses).toEqual([]);

    setup.mockInput.pressEscape();
    await setup.waitFor(() => harness.responses.length === 1);
    expect(harness.responses).toEqual([{
      id: "question_1",
      response: { kind: "cancelled" },
    }]);
  });

  test("a searchable picker clears its query before closing", async () => {
    const harness = testProtocol({
      composer: {
        busy: true,
        picker: {
          id: "picker_1",
          title: "Choose session",
          options: [{
            name: "Session one",
            description: "First",
            value: "one",
          }],
          search: {
            mode: "local",
            query: "session",
            placeholder: "Search",
          },
        },
      },
    });
    const { setup } = await mount(harness.protocol);

    setup.mockInput.pressEscape();
    await setup.flush();
    expect(harness.pickerResults).toEqual([]);
    expect(harness.turnCancels).toEqual([]);

    setup.mockInput.pressEscape();
    await setup.waitFor(() => harness.pickerResults.length === 1);
    expect(harness.pickerResults).toEqual([{ id: "picker_1", value: null }]);
    expect(harness.turnCancels).toEqual([]);
  });

  test("the topmost sidecar overlay handles Esc before an interaction", async () => {
    const harness = testProtocol({
      composer: {
        interactions: [{
          id: "approval_1",
          kind: "approval",
          blocking: true,
          cancelResponse: { kind: "cancelled" },
          approval: {
            title: "Run command?",
            options: [{
              optionId: "allow",
              name: "Allow",
              kind: "allow_once",
            }],
          },
        }],
      },
      sidecar: {
        title: "Board",
        mode: "open",
        sections: [{
          id: "active",
          items: [{ id: "task", title: "Reconcile" }],
        }],
      },
    });
    const { setup } = await mount(harness.protocol, {
      width: 80,
      height: 24,
    });

    setup.mockInput.pressEscape();
    await setup.waitFor(() => harness.sidecarDismisses.length === 1);

    expect(harness.sidecarDismisses).toEqual(["dismiss"]);
    expect(harness.responses).toEqual([]);
  });
});
