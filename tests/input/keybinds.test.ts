import { describe, expect, test } from "bun:test";

import {
  defaultKeybinds,
  editorKeyBindings,
  keybindHint,
  layerBindings,
  resolveKeybinds,
  type KeybindAction,
} from "../../src/index.ts";
import { parseKeybindKey } from "../../src/input/keybinds.ts";

describe("defaultKeybinds", () => {
  test("covers every action exactly once with desc and group", () => {
    const actions = defaultKeybinds.map((definition) => definition.action);
    expect(new Set(actions).size).toBe(actions.length);
    for (const definition of defaultKeybinds) {
      expect(definition.keys.length).toBeGreaterThan(0);
      expect(definition.desc.length).toBeGreaterThan(0);
      expect(definition.group.length).toBeGreaterThan(0);
    }
  });

  test("keeps the established default keys", () => {
    const keysOf = (action: KeybindAction) =>
      defaultKeybinds.find((definition) => definition.action === action)?.keys;
    expect(keysOf("composer.clear-or-exit")).toEqual(["ctrl+c"]);
    expect(keysOf("turn.cancel")).toEqual(["escape"]);
    expect(keysOf("transcript.toggle-expanded")).toEqual(["ctrl+o"]);
    expect(keysOf("transcript.copy-last-message")).toEqual(["ctrl+shift+y"]);
    expect(keysOf("composer.cycle-mode")).toEqual(["shift+tab"]);
    expect(keysOf("composer.history-previous")).toEqual(["up"]);
    expect(keysOf("composer.history-next")).toEqual(["down"]);
    expect(keysOf("sidecar.previous-link")).toEqual(["alt+up"]);
    expect(keysOf("sidecar.next-link")).toEqual(["alt+down"]);
    expect(keysOf("sidecar.open-link")).toEqual([
      "ctrl+return",
      "ctrl+kpenter",
    ]);
  });

  test("copy-last-message does not collide with any other default key", () => {
    const copy = defaultKeybinds.find(
      (definition) => definition.action === "transcript.copy-last-message",
    );
    const others = defaultKeybinds
      .filter((definition) => definition.action !== "transcript.copy-last-message")
      .flatMap((definition) => definition.keys);
    for (const key of copy?.keys ?? []) {
      expect(others).not.toContain(key);
    }
  });
});

describe("resolveKeybinds", () => {
  test("expands multi-key defaults into one row per key", () => {
    const resolved = resolveKeybinds();
    const submits = resolved.filter(
      (binding) => binding.action === "composer.submit",
    );
    expect(submits.map((binding) => binding.key)).toEqual(["return", "kpenter"]);
  });

  test("an override replaces all default keys of the action", () => {
    const resolved = resolveKeybinds({ "composer.submit": "ctrl+return" });
    const submits = resolved.filter(
      (binding) => binding.action === "composer.submit",
    );
    expect(submits.map((binding) => binding.key)).toEqual(["ctrl+return"]);
  });

  test("null unbinds the action entirely", () => {
    const resolved = resolveKeybinds({ "transcript.toggle-expanded": null });
    expect(
      resolved.some((binding) => binding.action === "transcript.toggle-expanded"),
    ).toBe(false);
  });
});

describe("keybindHint", () => {
  test("formats effective keys for UI text and honors overrides", () => {
    expect(keybindHint("suggested-input.use")).toBe("Ctrl+Y");
    expect(keybindHint("composer.submit")).toBe("Enter");
    expect(keybindHint("queue.move-up")).toBe("Alt+↑");
    expect(keybindHint("suggested-input.use", {
      "suggested-input.use": "ctrl+u",
    })).toBe("Ctrl+U");
    expect(keybindHint("suggested-input.use", {
      "suggested-input.use": null,
    })).toBeUndefined();
  });
});

describe("layerBindings", () => {
  test("returns keymap-layer bindings in declaration order, without editor actions", () => {
    const bindings = layerBindings([
      "transcript.toggle-expanded",
      "transcript.copy-last-message",
    ]);
    expect(bindings.map((binding) => binding.cmd)).toEqual([
      "transcript.toggle-expanded",
      "transcript.copy-last-message",
    ]);
    expect(bindings.every((binding) => binding.key.length > 0)).toBe(true);
    // textarea 编辑动作不属于 keymap 层
    expect(bindings.some((binding) => binding.cmd === "composer.submit")).toBe(
      false,
    );
  });

  test("applies overrides", () => {
    const bindings = layerBindings(["turn.cancel"], { "turn.cancel": "ctrl+x" });
    expect(bindings).toEqual([
      {
        key: "ctrl+x",
        desc: "Interrupt the running turn",
        group: "Composer",
        cmd: "turn.cancel",
      },
    ]);
    expect(layerBindings(["turn.cancel"], { "turn.cancel": null })).toEqual([]);
  });
});

describe("editorKeyBindings", () => {
  test("derives textarea submit/newline bindings from the definitions table", () => {
    const bindings = editorKeyBindings();
    expect(bindings).toContainEqual({ name: "return", action: "submit" });
    expect(bindings).toContainEqual({ name: "kpenter", action: "submit" });
    expect(bindings).toContainEqual({
      name: "return",
      shift: true,
      action: "newline",
    });
    expect(bindings).toContainEqual({
      name: "kpenter",
      meta: true,
      action: "newline",
    });
  });

  test("an override rewires the editor action", () => {
    const bindings = editorKeyBindings({ "composer.newline": "ctrl+j" });
    const newlines = bindings.filter((binding) => binding.action === "newline");
    expect(newlines).toEqual([{ name: "j", ctrl: true, action: "newline" }]);
  });
});

describe("parseKeybindKey", () => {
  test("parses modifiers and key name", () => {
    expect(parseKeybindKey("ctrl+shift+y")).toEqual({
      name: "y",
      ctrl: true,
      shift: true,
    });
    expect(parseKeybindKey("return")).toEqual({ name: "return" });
  });

  test("rejects modifiers unsupported by editor bindings", () => {
    expect(() => parseKeybindKey("alt+return")).toThrow(
      "Unsupported editor key binding: alt+return",
    );
  });
});
