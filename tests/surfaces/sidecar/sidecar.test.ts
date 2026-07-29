import { afterEach, describe, expect, test } from "bun:test";
import {
  Renderable,
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import { createElement } from "react";

import {
  defaultTheme,
  Sidecar,
  sidecarLayout,
  visibleSidecarSections,
  type SidecarState,
} from "../../../src/index.ts";
import {
  marqueeContent,
  nextMarqueeOffset,
} from "../../../src/surfaces/sidecar/sidecar.tsx";

let mounted: { root: Root; setup: TestRendererSetup } | null = null;

afterEach(() => {
  mounted?.root.unmount();
  mounted?.setup.renderer.destroy();
  mounted = null;
});

const populated: SidecarState = {
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
  test("loops overflowing details through a blank gap", () => {
    const marquee = marqueeContent("abcde");
    expect(marquee).toEqual({
      text: "abcde   abcde",
      cycleWidth: 8,
    });

    const offsets = [0];
    for (let index = 0; index < marquee.cycleWidth; index += 1) {
      offsets.push(nextMarqueeOffset(offsets.at(-1)!, marquee.cycleWidth));
    }
    expect(offsets).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });

  test("hides when every section is empty", () => {
    const empty: SidecarState = {
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

  test("renders item URLs as terminal-native hyperlinks", async () => {
    const setup = await createTestRenderer({ width: 42, height: 8, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };

    root.render(
      createElement(Sidecar, {
        state: {
          title: "Board",
          sections: [{
            id: "pull-requests",
            items: [{
              id: "pr-42",
              title: "Pull request #42",
              url: "https://example.com/pulls/42",
            }],
          }],
        },
        theme: defaultTheme,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const title = [...Renderable.renderablesByNumber.values()].find(
      (renderable): renderable is TextRenderable =>
        renderable instanceof TextRenderable &&
        renderable.plainText === "Pull request #42",
    );
    expect(title?.textNode.toChunks()).toContainEqual(expect.objectContaining({
      text: "Pull request #42",
      link: { url: "https://example.com/pulls/42" },
    }));
  });

  test("scrolls details only when they overflow", async () => {
    const setup = await createTestRenderer({ width: 42, height: 10, screenMode: "main-screen" });
    const root = createRoot(setup.renderer);
    mounted = { root, setup };
    const longTitle =
      "A long pull request title that cannot fit inside the Board sidecar";

    root.render(
      createElement(Sidecar, {
        state: {
          title: "Board",
          sections: [{
            id: "pull-requests",
            items: [
              {
                id: "pr-short",
                title: "PR #1",
                detail: "Short title",
              },
              {
                id: "pr-long",
                title: "PR #2",
                detail: longTitle,
              },
            ],
          }],
        },
        theme: defaultTheme,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.flush();

    const details = [...Renderable.renderablesByNumber.values()].filter(
      (renderable): renderable is TextRenderable =>
        renderable instanceof TextRenderable &&
        (renderable.plainText === marqueeContent("Short title").text ||
          renderable.plainText === marqueeContent(longTitle).text),
    );
    const short = details.find((detail) =>
      detail.plainText === marqueeContent("Short title").text
    );
    const long = details.find((detail) =>
      detail.plainText === marqueeContent(longTitle).text
    );
    expect(short?.maxScrollX).toBe(0);
    expect(long?.maxScrollX).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(short?.scrollX).toBe(0);
    expect(long?.scrollX).toBeGreaterThan(0);
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
        state: {
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
