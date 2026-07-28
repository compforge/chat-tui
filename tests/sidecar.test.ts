import { afterEach, describe, expect, test } from "bun:test";
import { Renderable, ScrollBoxRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import {
  defaultTheme,
  Sidecar,
  sidecarLayout,
  visibleSidecarSections,
  type SidecarView,
} from "../src/index.ts";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

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

  test("exposes every row directly to scrollbox viewport culling", async () => {
    const setup = await createTestRenderer({ width: 42, height: 12, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const items = Array.from({ length: 40 }, (_, index) => ({
      id: `resource-${index}`,
      title: `Resource ${index}`,
      status: "waiting",
    }));

    root.render(
      createElement(Sidecar, {
        view: {
          title: "Board",
          sections: [{ id: "resources", title: "Resources", items }],
        },
        theme: defaultTheme,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const scrollbox = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is ScrollBoxRenderable =>
        renderable instanceof ScrollBoxRenderable,
    );
    expect(scrollbox).toBeDefined();
    // OpenTUI 只对 scrollbox 的直接子节点做 viewport culling；禁止重新包回整块 Board。
    expect(scrollbox!.content.getChildren()).toHaveLength(items.length + 1);

    let renderedRows = 0;
    const rowRenderables = [...Renderable.renderablesByNumber.values()].filter(
      (renderable): renderable is Renderable & { plainText: string } =>
        "plainText" in renderable &&
        typeof renderable.plainText === "string" &&
        renderable.plainText.startsWith("Resource "),
    );
    expect(rowRenderables).toHaveLength(items.length);
    for (const renderable of rowRenderables) {
      const render = renderable.render.bind(renderable);
      renderable.render = (buffer, deltaTime) => {
        renderedRows += 1;
        render(buffer, deltaTime);
      };
    }

    setup.renderer.requestRender();
    await setup.flush();
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(items.length);
  });
});
