import { describe, expect, test } from "bun:test";

import {
  visiblePickerOptions,
  type PickerView,
} from "../src/index.ts";

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
});
