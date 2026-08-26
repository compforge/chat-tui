// 键位单一事实来源（纯逻辑，可单测）：一张 Definitions 表驱动所有默认绑定。
//
// 组件不再各自硬编码键位字符串，而是从这张表取默认绑定；desc/group 元数据随表
// 提供，接入方可用来生成帮助。override 只按 action 粒度替换或解绑（null），不区分
// 一个 action 的多个默认键——override 后该 action 只剩用户给定的这一个键。
//
// 表里有两类条目：
// - keymap 层语义 command（editAction 缺省）：组件注册到分层路由的 binding；
// - textarea 编辑动作（editAction = "submit" | "newline"）：ComposerEditor 的
//   keyBindings，与 opentui textarea 内建编辑键合并。

/** keymap 层与 textarea 编辑键共用的语义 action 命名空间 */
export type KeybindAction =
  | "composer.clear-or-exit"
  | "composer.exit-eof"
  | "composer.cycle-mode"
  | "composer.history-previous"
  | "composer.history-next"
  | "composer.submit"
  | "composer.newline"
  | "turn.cancel"
  | "transcript.toggle-expanded"
  | "transcript.copy-last-message"
  | "picker.cancel"
  | "picker.previous"
  | "picker.next"
  | "picker.confirm"
  | "suggestions.previous"
  | "suggestions.next"
  | "suggestions.accept-tab"
  | "suggestions.accept-enter"
  | "suggestions.dismiss"
  | "interaction.cancel"
  | "suggested-input.use"
  | "suggested-input.dismiss"
  | "question.cancel-edit"
  | "sidecar.dismiss";

export interface KeybindDefinition {
  action: KeybindAction;
  /** 默认键位（"ctrl+c"、"shift+return" 形式）；一个 action 可有多个默认键 */
  keys: readonly string[];
  desc: string;
  group: string;
  /** textarea 编辑动作；缺省表示 keymap 层语义 command */
  editAction?: "submit" | "newline";
}

/** 所有默认键位。行为分层语义（哪层消费、Esc 冒泡）归组件，这里只有键与元数据。 */
export const defaultKeybinds: readonly KeybindDefinition[] = [
  {
    action: "composer.clear-or-exit",
    keys: ["ctrl+c"],
    desc: "Clear draft, or press again to exit",
    group: "Composer",
  },
  {
    action: "composer.exit-eof",
    keys: ["ctrl+d"],
    desc: "Exit when the composer is empty and idle",
    group: "Composer",
  },
  {
    action: "composer.cycle-mode",
    keys: ["shift+tab"],
    desc: "Cycle input mode",
    group: "Composer",
  },
  {
    action: "composer.history-previous",
    keys: ["up"],
    desc: "Recall queued message, then previous history entry at the cursor boundary",
    group: "Composer",
  },
  {
    action: "composer.history-next",
    keys: ["down"],
    desc: "Next history entry at the cursor boundary",
    group: "Composer",
  },
  {
    action: "composer.submit",
    keys: ["return", "kpenter"],
    desc: "Submit input",
    group: "Composer",
    editAction: "submit",
  },
  {
    action: "composer.newline",
    keys: ["shift+return", "shift+kpenter", "meta+return", "meta+kpenter"],
    desc: "Insert a newline",
    group: "Composer",
    editAction: "newline",
  },
  {
    action: "turn.cancel",
    keys: ["escape"],
    desc: "Interrupt the running turn",
    group: "Composer",
  },
  {
    action: "transcript.toggle-expanded",
    keys: ["ctrl+o"],
    desc: "Toggle expanded transcript content",
    group: "Transcript",
  },
  {
    action: "transcript.copy-last-message",
    keys: ["ctrl+shift+y"],
    desc: "Copy the latest agent message to the clipboard (code only when the message is a single code block)",
    group: "Transcript",
  },
  {
    action: "picker.cancel",
    keys: ["escape"],
    desc: "Clear picker query or close picker",
    group: "Picker",
  },
  {
    action: "picker.previous",
    keys: ["up"],
    desc: "Previous picker option",
    group: "Picker",
  },
  {
    action: "picker.next",
    keys: ["down"],
    desc: "Next picker option",
    group: "Picker",
  },
  {
    action: "picker.confirm",
    keys: ["return", "kpenter"],
    desc: "Choose picker option",
    group: "Picker",
  },
  {
    action: "suggestions.previous",
    keys: ["up"],
    desc: "Previous completion candidate",
    group: "Suggestions",
  },
  {
    action: "suggestions.next",
    keys: ["down"],
    desc: "Next completion candidate",
    group: "Suggestions",
  },
  {
    action: "suggestions.accept-tab",
    keys: ["tab"],
    desc: "Accept completion candidate",
    group: "Suggestions",
  },
  {
    action: "suggestions.accept-enter",
    keys: ["return", "kpenter"],
    desc: "Accept completion candidate and submit slash commands",
    group: "Suggestions",
  },
  {
    action: "suggestions.dismiss",
    keys: ["escape"],
    desc: "Dismiss completions",
    group: "Suggestions",
  },
  {
    action: "interaction.cancel",
    keys: ["escape"],
    desc: "Cancel interaction",
    group: "Interaction",
  },
  {
    action: "suggested-input.use",
    keys: ["ctrl+y"],
    desc: "Use suggested input",
    group: "Interaction",
  },
  {
    action: "suggested-input.dismiss",
    keys: ["ctrl+c"],
    desc: "Dismiss suggested input",
    group: "Interaction",
  },
  {
    action: "question.cancel-edit",
    keys: ["escape"],
    desc: "Return to question choices",
    group: "Question",
  },
  {
    action: "sidecar.dismiss",
    keys: ["escape"],
    desc: "Close sidecar",
    group: "Sidecar",
  },
];

/**
 * 用户级键位覆盖：action → 替换键；null 表示解绑该 action。
 * 由接入方构造后传给 InputProvider（或 ChatShell 的 keybinds prop）；
 * chat-tui 不读取配置文件。
 */
export type KeybindOverrides = Partial<Record<KeybindAction, string | null>>;

export interface ResolvedKeybind {
  action: KeybindAction;
  key: string;
  desc: string;
  group: string;
  editAction?: "submit" | "newline";
}

/** Definitions + overrides → 逐键展开的生效绑定表；被解绑（null）的 action 不出现在结果里。 */
export function resolveKeybinds(
  overrides?: KeybindOverrides,
): ResolvedKeybind[] {
  const resolved: ResolvedKeybind[] = [];
  for (const definition of defaultKeybinds) {
    const override = overrides?.[definition.action];
    if (override === null) continue;
    const keys = override === undefined ? definition.keys : [override];
    for (const key of keys) {
      resolved.push({
        action: definition.action,
        key,
        desc: definition.desc,
        group: definition.group,
        editAction: definition.editAction,
      });
    }
  }
  return resolved;
}

/** keymap 层绑定（useInputBindings 的 bindings 元素形状；desc/group 供帮助展示）。 */
export interface KeybindLayerBinding {
  key: string;
  desc: string;
  group: string;
  cmd: KeybindAction;
}

/** 按声明顺序取一组 action 的 keymap 层绑定；editAction 条目（textarea 编辑键）不会出现。 */
export function layerBindings(
  actions: readonly KeybindAction[],
  overrides?: KeybindOverrides,
): KeybindLayerBinding[] {
  const wanted = new Set(actions);
  return resolveKeybinds(overrides)
    .filter((binding) => binding.editAction === undefined && wanted.has(binding.action))
    .map((binding) => ({
      key: binding.key,
      desc: binding.desc,
      group: binding.group,
      cmd: binding.action,
    }));
}

export interface KeybindEditorBinding {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: "submit" | "newline";
}

/** textarea 编辑键（与 opentui textarea 内建编辑键合并后生效）。 */
export function editorKeyBindings(
  overrides?: KeybindOverrides,
): KeybindEditorBinding[] {
  return resolveKeybinds(overrides)
    .filter((binding) => binding.editAction !== undefined)
    .map((binding) => ({
      ...parseKeybindKey(binding.key),
      action: binding.editAction as "submit" | "newline",
    }));
}

/** "ctrl+shift+y" → { name: "y", ctrl: true, shift: true }；无法识别的修饰键留在 name 里让下游报错。 */
export function parseKeybindKey(key: string): {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
} {
  const parts = key.split("+");
  const name = parts[parts.length - 1] ?? key;
  const modifiers = new Set(parts.slice(0, -1));
  return {
    name,
    ...(modifiers.has("ctrl") ? { ctrl: true } : {}),
    ...(modifiers.has("shift") ? { shift: true } : {}),
    ...(modifiers.has("meta") ? { meta: true } : {}),
  };
}
