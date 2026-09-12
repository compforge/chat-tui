import type {
  SidecarSection,
  SidecarState,
} from "../../state/sidecar.ts";

export const SIDECAR_WIDTH = 42;
export const SIDECAR_BREAKPOINT = 120;

export type SidecarLayout = "hidden" | "inline" | "overlay";

export interface SidecarLink {
  key: string;
  url: string;
}

export function sidecarItemKey(sectionId: string, itemId: string): string {
  return JSON.stringify([sectionId, itemId]);
}

export function sidecarLinks(state?: SidecarState): SidecarLink[] {
  return visibleSidecarSections(state).flatMap((section) =>
    section.items.flatMap((item) =>
      item.url
        ? [{ key: sidecarItemKey(section.id, item.id), url: item.url }]
        : []
    )
  );
}

export function visibleSidecarSections(
  state?: SidecarState,
): SidecarSection[] {
  return (state?.sections ?? []).filter((section) => section.items.length > 0);
}

export function sidecarLayout(
  state: SidecarState | undefined,
  terminalWidth: number,
): SidecarLayout {
  if (
    visibleSidecarSections(state).length === 0 ||
    state?.mode === "hidden"
  ) {
    return "hidden";
  }
  if (terminalWidth > SIDECAR_BREAKPOINT) return "inline";
  return state?.mode === "open" ? "overlay" : "hidden";
}
