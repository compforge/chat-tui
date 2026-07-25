import { describe, expect, test } from "bun:test";

import {
  sidecarLayout,
  visibleSidecarSections,
  type SidecarView,
} from "../src/index.ts";

const populated: SidecarView = {
  title: "Board",
  sections: [
    { id: "empty", title: "Empty", items: [] },
    {
      id: "active",
      title: "Active",
      items: [{ id: "one", title: "Requirement loop" }],
    },
  ],
};

describe("sidecar", () => {
  test("hides when every section is empty", () => {
    const empty: SidecarView = {
      title: "Board",
      sections: [{ id: "empty", items: [] }],
      mode: "open",
    };

    expect(visibleSidecarSections(empty)).toEqual([]);
    expect(sidecarLayout(empty, 160)).toBe("hidden");
  });

  test("shows inline only on wide terminals in auto mode", () => {
    expect(sidecarLayout(populated, 121)).toBe("inline");
    expect(sidecarLayout(populated, 120)).toBe("hidden");
  });

  test("uses an overlay when explicitly opened on a narrow terminal", () => {
    expect(sidecarLayout({ ...populated, mode: "open" }, 80)).toBe("overlay");
  });

  test("explicit hidden mode wins on wide terminals", () => {
    expect(sidecarLayout({ ...populated, mode: "hidden" }, 160)).toBe("hidden");
  });
});
