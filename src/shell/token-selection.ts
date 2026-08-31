import type { MouseEvent, Renderable, TextareaRenderable, TextRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/react";

import { tokenColumnRange, visualLineAt } from "./selection.ts";

/** 有可选中文本形状的 renderable：text、textarea、markdown 内部 text 等。 */
type SelectableTextTarget = TextRenderable | TextareaRenderable;

// 鸭子判型而非 instanceof 枚举类型：以"selectable 且暴露 plainText"为准，
// 未来新增的文本类 renderable（或 markdown 内部节点）自动被覆盖，不用回来补类型。
// selectable 是硬前提——OpenTUI 只对 selectable 目标在 mouse-down 建立选区，
// 对非 selectable 目标扩选区会凭空造出没有锚点的选择。
function selectableTextTarget(target: Renderable | null): SelectableTextTarget | null {
  if (!target?.selectable) return null;
  const plainText = (target as { plainText?: unknown }).plainText;
  return typeof plainText === "string" ? (target as SelectableTextTarget) : null;
}

/**
 * 把 OpenTUI 双击产生的 word 选区扩成完整产品 token。
 *
 * 在壳的根容器上挂一次即可（ChatShell 已挂）：OpenTUI 鼠标事件沿 parent 链冒泡，
 * `event.target` 始终是命中的 renderable，因此后代的一切可见文本都被覆盖，
 * 新增组件无需自行挂载。不用 ChatShell 的自定义壳同样只在自己的根上挂一次。
 */
export function useTokenSelectionOnDoubleClick(): (event: MouseEvent) => void {
  const renderer = useRenderer();

  return (event: MouseEvent): void => {
    const target = selectableTextTarget(event.target);
    if (!target || event.button !== 0) return;
    // OpenTUI 统一维护 click repeat 的时间窗、落点容差和 cell/word/line 状态。
    // 这里只扩展原生 word；第三击的 line 选择原样保留，不再维护另一套点击时钟。
    if (renderer.getSelection()?.behavior !== "word") return;

    const localY = event.y - target.y;
    const line = visualLineAt(target.plainText, target.width, localY);
    const range = line ? tokenColumnRange(line, event.x - target.x) : null;
    if (!range || range.end <= range.start) return;

    // OpenTUI 已在第二次 mouse-down 建立 word 选区；这里用产品 token 边界替换它，
    // mouse-up 仍走框架原生 finishSelection，从而保留高亮并触发统一剪贴板回调。0.5.7 起
    // cell occupancy 包含 focus cell，因此 exclusive end 要回退到 token 最后一个 cell。
    renderer.startSelection(target, target.x + range.start, event.y);
    renderer.updateSelection(target, target.x + range.end - 1, event.y);
  };
}
