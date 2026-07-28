import type {
  SidecarSection,
  SidecarState,
} from "../../state/sidecar.ts";

export const SIDECAR_WIDTH = 42;
export const SIDECAR_BREAKPOINT = 120;

export type SidecarLayout = "hidden" | "inline" | "overlay";

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
