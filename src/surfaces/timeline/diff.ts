// diff 展示的纯逻辑层：从 unified diff 文本推导"渲染层需要的数字"。
//
// 为什么自己扫而不是引 jsdiff：这里只需要行数与增删统计——渲染本身由 opentui 的
// DiffRenderable 负责（它内部用 jsdiff parsePatch）。为两个计数函数引一个解析依赖，
// 换来的是和渲染器解析行为强绑定的假精确；扫描器只依赖 unified diff 的行前缀约定，
// 与渲染器的解析宽严解耦，坏 patch 时渲染器自会显示错误视图。

/** 与 DiffRenderable 对齐的两种视图 */
export type DiffView = "unified" | "split";

interface HunkLine {
  kind: "+" | "-" | " ";
  text: string;
}

/**
 * 提取 hunk 体内的行（跳过 ---/+++/@@ 头与 "\ No newline" 标记）。
 * 空字符串行按 context 计：部分生成器对空上下文行省略前导空格，jsdiff 同样宽容。
 */
function hunkLines(patch: string): HunkLine[] {
  const out: HunkLine[] = [];
  let inHunk = false;
  const lines = patch.split("\n");
  if (lines.at(-1) === "") lines.pop(); // 尾部换行产生的空元素，不是内容行
  for (const line of lines) {
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk || line.startsWith("\\")) continue;
    const kind = line[0];
    if (kind === "+" || kind === "-") {
      out.push({ kind, text: line.slice(1) });
    } else if (kind === " " || line === "") {
      out.push({ kind: " ", text: line.slice(1) });
    }
  }
  return out;
}

/**
 * patch 渲染后的视觉行数（DiffRenderable 只渲染 hunk 行，不渲染 ---/+++/@@ 头）。
 * split 视图里连续的 -/+ 段左右并排，行数取两侧较大者；用它给渲染层定高度，
 * 高度多估会留空白行、少估会截尾，所以必须按视图分别计算。
 */
export function diffRows(patch: string, view: DiffView): number {
  const lines = hunkLines(patch);
  if (view === "unified") return Math.max(1, lines.length);
  let rows = 0;
  let i = 0;
  while (i < lines.length) {
    if (lines[i]?.kind === " ") {
      rows++;
      i++;
      continue;
    }
    let removed = 0;
    let added = 0;
    while (i < lines.length && lines[i]?.kind !== " ") {
      if (lines[i]?.kind === "-") removed++;
      else added++;
      i++;
    }
    rows += Math.max(removed, added);
  }
  return Math.max(1, rows);
}

/** 增删行统计（delete 摘要、header 后缀等文案用） */
export function diffStats(patch: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of hunkLines(patch)) {
    if (line.kind === "+") added++;
    else if (line.kind === "-") removed++;
  }
  return { added, removed };
}
