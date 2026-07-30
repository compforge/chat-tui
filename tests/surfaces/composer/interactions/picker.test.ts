import { afterEach, describe, expect, test } from "bun:test";
import {
  Renderable,
  SelectRenderable,
} from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement, useState } from "react";

import {
  defaultTheme,
  Picker,
  visiblePickerOptions,
  type PickerView,
} from "../../../../src/index.ts";
import { marqueeFrame } from "../../../../src/terminal/marquee.tsx";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

const options: PickerView["options"] = [
  {
    name: "Requirement intake",
    description: "meego · story · REQ-7",
    value: "REQ-7",
  },
  {
    name: "Fix session recovery",
    description: "meego · issue · BUG-9",
    value: "BUG-9",
  },
];

describe("Picker search", () => {
  test("keeps a full display column when scrolling through wide characters", () => {
    expect(marqueeFrame("甲乙", 1)).toBe(" 乙   甲乙");
  });

  test("filters local options by name and description", () => {
    const picker: PickerView = {
      title: "Requirements",
      options,
      search: { mode: "local" },
    };

    expect(visiblePickerOptions(picker, "SESSION")).toEqual([options[1]!]);
    expect(visiblePickerOptions(picker, "req-7")).toEqual([options[0]!]);
    expect(visiblePickerOptions(picker, "  ")).toEqual(options);
  });

  test("does not filter remote result snapshots again", () => {
    const picker: PickerView = {
      title: "Requirements",
      options,
      search: { mode: "remote", query: "deployment" },
    };

    expect(visiblePickerOptions(picker, "session")).toEqual(options);
  });

  test("scrolls only the selected overflowing option name", async () => {
    const setup = await createTestRenderer({
      width: 54,
      height: 14,
      screenMode: "main-screen",
    });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const longOptions: PickerView["options"] = [
      {
        name: "A selected requirement title that cannot fit on one row",
        description: "meego · issue · REQ-1",
        value: "REQ-1",
      },
      {
        name: "Another requirement title that cannot fit on one row",
        description: "meego · issue · REQ-2",
        value: "REQ-2",
      },
    ];

    function SelectablePicker() {
      const [selectedIndex, setSelectedIndex] = useState(0);
      return createElement(Picker, {
        picker: { title: "Requirements", options: longOptions },
        selectedIndex,
        anchorBottom: 3,
        theme: defaultTheme,
        onSelectionChange: setSelectedIndex,
        onSelect: () => {},
      });
    }

    root.render(createElement(SelectablePicker));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const select = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is SelectRenderable =>
        renderable instanceof SelectRenderable,
    );
    expect(select?.options[0]?.name).toBe(
      marqueeFrame(longOptions[0]!.name, 0),
    );
    expect(select?.options[1]?.name).toBe(longOptions[1]!.name);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(select?.options[0]?.name).not.toBe(longOptions[0]!.name);
    expect(select?.options[1]?.name).toBe(longOptions[1]!.name);

    select?.moveDown();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();
    expect(select?.options[0]?.name).toBe(longOptions[0]!.name);
    expect(select?.options[1]?.name).toBe(
      marqueeFrame(longOptions[1]!.name, 0),
    );
  });
});
