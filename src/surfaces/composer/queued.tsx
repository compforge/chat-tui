import type { ReactNode } from "react";

import type { QueuedItem } from "../../state/composer.ts";
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

export interface InputAreaProps {
  items: QueuedItem[];
  theme?: Theme;
  children: ReactNode;
}

/**
 * Queued 和 Composer 的容器，左侧带共享的高亮边条。
 * 当没有 queued items 时，只渲染 children（composer）不带边条。
 */
export function InputArea(props: InputAreaProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const hasQueued = props.items.length > 0;

  if (!hasQueued) {
    return <>{props.children}</>;
  }

  return (
    <box style={{ flexDirection: "row", flexShrink: 0, paddingLeft: 1, paddingRight: 1, marginTop: 1 }}>
      <box style={{ width: 1, flexShrink: 0, backgroundColor: theme.accent ?? "#3b82f6" }} />
      <box style={{ flexDirection: "column", flexGrow: 1, paddingLeft: 1 }}>
        <QueuedList items={props.items} theme={theme} />
        {props.children}
      </box>
    </box>
  );
}
