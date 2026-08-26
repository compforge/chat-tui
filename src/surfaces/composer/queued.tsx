import { memo, useEffect, useState, type ReactNode } from "react";

import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
  useKeybindOverrides,
} from "../../input/keyboard.tsx";
import { keybindHint, layerBindings } from "../../input/keybinds.ts";
import type { QueueIntent } from "../../protocol/chat-protocol.ts";
import type {
  QueueItemAction,
  QueueItemView,
  QueueState,
} from "../../state/queue.ts";
import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import { defaultTheme, type Theme } from "../../theme.ts";

/** 队列条目的三行预览（↳ 首行缩进，超出折叠为 …） */
export function queuedPreview(text: string): string {
  const lines = text.split("\n");
  const visible = lines.slice(0, 3).map((line, index) => `${index === 0 ? "  ↳ " : "    "}${line}`);
  if (lines.length > 3 && visible.length > 0) {
    visible[visible.length - 1] = `${visible[visible.length - 1]}…`;
  }
  return visible.join("\n");
}

export interface QueuedListProps {
  items: QueueItemView[];
  theme?: Theme;
}

/**
 * 排队中的 steer 输入列表。召回/编辑/撤销的交互归消费方（队列本体在 harness 层）；
 * "↑ 召回"提示不在这里——交互发生地是 composer，提示归 composer placeholder。
 */
export function QueuedList(props: QueuedListProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  if (props.items.length === 0) return null;
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, paddingLeft: 1 }}>
      <text>• Queued follow-ups</text>
      {props.items.map((item) => (
        <text key={item.id} fg={theme.dim}>
          {`${queuedPreview(item.text)}${item.tag ? `  [${item.tag}]` : ""}`}
        </text>
      ))}
    </box>
  );
}

export interface QueueSurfaceProps {
  store: ChatStore;
  theme: Theme;
}

/** 可选的将来时区域；由 ChatShell 放在 Activity 之前，空队列不占高度。 */
export const QueueSurface = memo(function QueueSurface(
  props: QueueSurfaceProps,
): ReactNode {
  const items = useStoreState(props.store, "queue")?.items ?? [];
  if (items.length === 0) return null;
  return (
    <box
      style={{
        flexDirection: "row",
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        marginTop: 1,
      }}
    >
      <QueuedList items={items} theme={props.theme} />
    </box>
  );
});

export interface InputAreaProps {
  items: QueueItemView[];
  theme?: Theme;
  children: ReactNode;
}

export function queueActionAvailable(
  item: QueueItemView,
  action: QueueItemAction,
): boolean {
  return item.actions?.includes(action) ?? false;
}

export interface QueuePaneProps {
  queue: QueueState;
  anchorBottom: number;
  theme?: Theme;
  onIntent: (intent: QueueIntent) => void | Promise<void>;
}

/** Interactive queue manager. It renders capabilities and emits generic intents only. */
export function QueuePane(props: QueuePaneProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const items = props.queue.items;
  const [selectedId, setSelectedId] = useState<string | undefined>(items[0]?.id);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );
  const selected = items[selectedIndex];
  const keybinds = useKeybindOverrides();

  useEffect(() => {
    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id);
    }
  }, [items, selectedId]);

  const run = (intent: QueueIntent): void => {
    void props.onIntent(intent);
  };
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.modal,
    commands: [
      { name: "queue.cancel", run: () => run({ kind: "close" }) },
      {
        name: "queue.previous",
        run: () => {
          if (items.length === 0) return false;
          setSelectedId(items[(selectedIndex - 1 + items.length) % items.length]?.id);
        },
      },
      {
        name: "queue.next",
        run: () => {
          if (items.length === 0) return false;
          setSelectedId(items[(selectedIndex + 1) % items.length]?.id);
        },
      },
      {
        name: "queue.recall",
        run: () => {
          if (!selected || !queueActionAvailable(selected, "recall")) return false;
          run({ kind: "recall", itemId: selected.id });
        },
      },
      {
        name: "queue.discard",
        run: () => {
          if (!selected || !queueActionAvailable(selected, "discard")) return false;
          run({ kind: "discard", itemId: selected.id });
        },
      },
      {
        name: "queue.move-up",
        run: () => {
          if (!selected || !queueActionAvailable(selected, "move-up")) return false;
          run({ kind: "move", itemId: selected.id, direction: "up" });
        },
      },
      {
        name: "queue.move-down",
        run: () => {
          if (!selected || !queueActionAvailable(selected, "move-down")) return false;
          run({ kind: "move", itemId: selected.id, direction: "down" });
        },
      },
      {
        name: "queue.dispatch-now",
        run: () => {
          if (!selected || !queueActionAvailable(selected, "dispatch-now")) return false;
          run({ kind: "dispatch-now", itemId: selected.id });
        },
      },
    ],
    bindings: layerBindings(
      [
        "queue.cancel",
        "queue.previous",
        "queue.next",
        "queue.recall",
        "queue.discard",
        "queue.move-up",
        "queue.move-down",
        "queue.dispatch-now",
      ],
      keybinds,
    ),
  }), [keybinds]);

  const selectHint = [
    keybindHint("queue.previous", keybinds),
    keybindHint("queue.next", keybinds),
  ].filter((hint): hint is string => Boolean(hint)).join("/");
  const moveHint = [
    keybindHint("queue.move-up", keybinds),
    keybindHint("queue.move-down", keybinds),
  ].filter((hint): hint is string => Boolean(hint)).join("/");
  const recallHint = keybindHint("queue.recall", keybinds);
  const discardHint = keybindHint("queue.discard", keybinds);
  const dispatchHint = keybindHint("queue.dispatch-now", keybinds);
  const closeHint = keybindHint("queue.cancel", keybinds);
  const help = [
    selectHint ? `${selectHint} select` : undefined,
    recallHint ? `${recallHint} recall` : undefined,
    discardHint ? `${discardHint} discard` : undefined,
    moveHint ? `${moveHint} reorder` : undefined,
    dispatchHint ? `${dispatchHint} dispatch` : undefined,
    closeHint ? `${closeHint} close` : undefined,
  ].filter((hint): hint is string => Boolean(hint)).join(" · ");

  const first = Math.max(
    0,
    Math.min(selectedIndex - 1, Math.max(0, items.length - 3)),
  );
  const visible = items.slice(first, first + 3);
  return (
    <box
      title={props.queue.manager?.title ?? "Queued inputs"}
      border
      borderColor={theme.accent}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: "90%",
        maxHeight: 22,
        backgroundColor: theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 210,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {visible.map((item) => {
        const active = item.id === selected?.id;
        return (
          <box key={item.id} style={{ flexDirection: "column", marginBottom: 1 }}>
            <text fg={active ? theme.accent : theme.dim}>
              {active ? "› " : "  "}{item.tag ?? "queued"}
            </text>
            <text fg={active ? theme.agent : theme.dim}>{queuedPreview(item.text)}</text>
          </box>
        );
      })}
      {items.length === 0 ? <text fg={theme.dim}>Queue is empty</text> : null}
      {help ? <text fg={theme.dim}>{help}</text> : null}
    </box>
  );
}

/** 自定义组合用的 Queue + children 容器；默认 ChatShell 由 QueueSurface 单独编排。 */
export function InputArea(props: InputAreaProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const hasQueued = props.items.length > 0;

  if (!hasQueued) {
    return <>{props.children}</>;
  }

  return (
    <box style={{ flexDirection: "row", flexShrink: 0, paddingLeft: 1, paddingRight: 1, marginTop: 1 }}>
      <box style={{ flexDirection: "column", flexGrow: 1, paddingLeft: 1 }}>
        <QueuedList items={props.items} theme={theme} />
        {props.children}
      </box>
    </box>
  );
}
