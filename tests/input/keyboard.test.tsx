import { afterEach, describe, expect, test } from "bun:test";
import { InputRenderable } from "@opentui/core";
import {
  createTestRenderer,
  type TestRendererSetup,
} from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement, type ReactNode } from "react";

import {
  INPUT_LAYER_PRIORITY,
  InputProvider,
  useInputBindings,
} from "../../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

function LayeredInput(props: {
  events: string[];
  rejectModal?: boolean;
}): ReactNode {
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.surface,
    bindings: [{
      key: "escape",
      cmd: () => props.events.push("surface"),
    }],
  }));
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.modal,
    bindings: [{
      key: "escape",
      cmd: () => {
        if (props.rejectModal) return false;
        props.events.push("modal");
      },
    }],
  }));
  return <input focused />;
}

async function mount(events: string[], rejectModal = false) {
  const setup = await createTestRenderer({
    width: 80,
    height: 20,
    kittyKeyboard: true,
    screenMode: "main-screen",
  });
  const root = createRoot(setup.renderer);
  mounted = { root, setup };
  root.render(
    createElement(
      InputProvider,
      null,
      createElement(LayeredInput, { events, rejectModal }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  await setup.flush();
  return setup;
}

describe("layered keyboard routing", () => {
  test("the highest active layer is the only consumer", async () => {
    const events: string[] = [];
    const setup = await mount(events);

    setup.mockInput.pressEscape();
    await setup.flush();

    expect(events).toEqual(["modal"]);
  });

  test("a rejected behavior falls through to the next layer", async () => {
    const events: string[] = [];
    const setup = await mount(events, true);

    setup.mockInput.pressEscape();
    await setup.flush();

    expect(events).toEqual(["surface"]);
  });

  test("an unmatched key reaches the focused renderable", async () => {
    const events: string[] = [];
    const setup = await mount(events);

    setup.mockInput.pressKey("a");
    await setup.flush();

    expect(setup.renderer.currentFocusedRenderable).toBeInstanceOf(
      InputRenderable,
    );
    expect(
      (setup.renderer.currentFocusedRenderable as InputRenderable).value,
    ).toBe("a");
    expect(events).toEqual([]);
  });
});
