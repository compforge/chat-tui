import type { TextRenderable } from "@opentui/core";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { displayWidth, ellipsize } from "./text.ts";

const MARQUEE_GAP = "   ";
export const MARQUEE_INTERVAL_MS = 200;

// Repeat the text after a blank gap so the viewport can keep moving forward
// and wrap to the first copy without visibly reversing direction.
export function marqueeContent(text: string): {
  readonly text: string;
  readonly cycleWidth: number;
} {
  return {
    text: `${text}${MARQUEE_GAP}${text}`,
    cycleWidth: displayWidth(text) + displayWidth(MARQUEE_GAP),
  };
}

export function nextMarqueeOffset(
  current: number,
  cycleWidth: number,
): number {
  return current + 1 >= cycleWidth ? 0 : current + 1;
}

/** Text suffix shown when a renderer cannot scroll a stable text viewport itself. */
export function marqueeFrame(text: string, offset: number): string {
  const marquee = marqueeContent(text);
  const normalizedOffset = Math.max(
    0,
    Math.min(offset, marquee.cycleWidth - 1),
  );
  let skippedWidth = 0;
  let frame = "";
  for (const char of marquee.text) {
    const charWidth = displayWidth(char);
    if (skippedWidth + charWidth <= normalizedOffset) {
      skippedWidth += charWidth;
      continue;
    }
    if (skippedWidth < normalizedOffset) {
      frame += " ".repeat(skippedWidth + charWidth - normalizedOffset);
    } else {
      frame += char;
    }
    skippedWidth += charWidth;
  }
  return frame;
}

export interface MarqueeTextProps {
  text: string;
  color?: string;
  active?: boolean;
}

/**
 * A stable one-row viewport: inactive overflow is ellipsized, while active
 * overflow scrolls through the complete text without changing layout.
 */
export function MarqueeText(props: MarqueeTextProps): ReactNode {
  const textRef = useRef<TextRenderable | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const active = props.active ?? true;
  const overflow =
    viewportWidth > 0 && displayWidth(props.text) > viewportWidth;
  const marquee = marqueeContent(props.text);

  useEffect(() => {
    const width = textRef.current?.width ?? 0;
    if (width !== viewportWidth) setViewportWidth(width);
  });

  useEffect(() => {
    const text = textRef.current;
    if (!text) return;
    text.scrollX = 0;
    if (!active || !overflow) return;
    const timer = setInterval(() => {
      text.scrollX = nextMarqueeOffset(text.scrollX, marquee.cycleWidth);
    }, MARQUEE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, marquee.cycleWidth, overflow, props.text]);

  const content = active && overflow
    ? marquee.text
    : viewportWidth > 0
      ? ellipsize(props.text, viewportWidth)
      : props.text;

  return (
    <text
      ref={textRef}
      fg={props.color}
      wrapMode="none"
      style={{
        width: "100%",
        height: 1,
        flexShrink: 1,
        overflow: "hidden",
      }}
    >
      {content}
    </text>
  );
}
