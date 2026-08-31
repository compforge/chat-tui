import type { ClipboardService } from "@opentui/core";

export function createTestClipboard(
  onWrite: (text: string) => void = () => {},
): ClipboardService {
  return {
    read: async () => ({ status: "unsupported" }),
    writeText: async (text) => {
      onWrite(text);
      return {
        host: { status: "not-attempted" },
        terminal: { status: "attempted", capability: "supported" },
      };
    },
    clear: async () => ({
      host: { status: "not-attempted" },
      terminal: { status: "attempted", capability: "supported" },
    }),
    dispose: async () => {},
  };
}
