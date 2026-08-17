import { memo, type ReactNode } from "react";

import type { QueuedItem } from "../../state/composer.ts";
import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import { defaultTheme, type Theme } from "../../theme.ts";

/** 队列条目的三行预览（↳ 首行缩进，超出折叠为 …） */
export function queuedPreview(text: string): string {
  const lines = text.split("\n");
  const visible = lines.slice(0, 3).map((line, index) => `${index === 0 ? "  ↳ " : "    "}${line}`);
  if (lines.length > 3) visible.push("    …");
  return visible.join("\n");
}

export interface QueuedListProps {
  items: QueuedItem[];
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
  const composer = useStoreState(props.store, "composer");
  const items = composer.queued ?? [];
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
  items: QueuedItem[];
  theme?: Theme;
  children: ReactNode;
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
