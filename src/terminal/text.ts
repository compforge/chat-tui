// 终端文本原语（真通用、无 chat-tui 业务语义）：宽度度量、清洗、按显示宽度 wrap。
// Timeline 裁剪与 Shell 选择几何共用这一层。

// 匹配 CSI 转义序列（颜色等）；不清洗会破坏宽度计算
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\[[0-9;]*[A-Za-z]/g;

/** 展示前的行清洗：去 ANSI 转义、tab 展开为 4 空格（宽度计算需要确定的列数） */
export function sanitizeLine(line: string): string {
  return line.replace(ANSI_PATTERN, "").replaceAll("\t", "    ");
}

/**
 * 终端显示宽度（列数）。近似 wcwidth：CJK/全角/emoji 记 2，组合字符记 0，其余记 1。
 * 不追求与 opentui 的 native wcwidth 完全一致——低估时行提前折断、高估时由渲染层兜底
 * wrap（多占 1 行），都不破坏预算量级；换精确一致要付出复刻 zig 实现的成本，不值。
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue; // combining marks
    width += isWideCodePoint(code) ? 2 : 1;
  }
  return width;
}

function isWideCodePoint(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK 部首/汉字/假名等
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK 兼容形式
    (code >= 0xff00 && code <= 0xff60) || // 全角形式
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) || // emoji（近似）
    (code >= 0x20000 && code <= 0x3fffd) // CJK 扩展
  );
}

/** 单行按显示宽度 wrap：贪心断词，无空格可断时按字符硬切（Codex NoHyphenation 同款语义） */
export function wrapLine(line: string, width: number): string[] {
  if (width <= 0) return [line];
  if (displayWidth(line) <= width) return [line];
  const out: string[] = [];
  let current = "";
  let currentWidth = 0;
  let lastSpaceAt = -1; // current 中最后一个空格的字符串下标
  for (const char of line) {
    const charWidth = displayWidth(char);
    if (currentWidth + charWidth > width && currentWidth > 0) {
      if (char === " ") {
        // 溢出的正好是空格：它本身就是断点，整行收下、空格丢弃
        out.push(current);
        current = "";
        currentWidth = 0;
        lastSpaceAt = -1;
        continue;
      }
      if (lastSpaceAt > 0) {
        out.push(current.slice(0, lastSpaceAt));
        current = current.slice(lastSpaceAt + 1) + char;
      } else {
        out.push(current);
        current = char;
      }
      currentWidth = displayWidth(current);
      lastSpaceAt = current.lastIndexOf(" ");
      continue;
    }
    if (char === " ") lastSpaceAt = current.length;
    current += char;
    currentWidth += charWidth;
  }
  if (current.length > 0) out.push(current);
  return out.length > 0 ? out : [line];
}

/**
 * 按**显示宽度**截断并缀省略号；放得下则原样返回。
 * 截断必须留痕：宁可少一个字也要让 `…` 出现，否则被切的内容会静默消失、用户以为看到的就是全部。
 * width 小到放不下省略号时退化为纯硬切（此时任何提示都没有意义）。
 */
export function ellipsize(text: string, width: number): string {
  if (width <= 0) return "";
  if (displayWidth(text) <= width) return text;
  const budget = width - displayWidth(ELLIPSIS);
  if (budget <= 0) return ELLIPSIS;
  let out = "";
  let used = 0;
  for (const char of text) {
    const charWidth = displayWidth(char);
    if (used + charWidth > budget) break;
    out += char;
    used += charWidth;
  }
  return out + ELLIPSIS;
}

const ELLIPSIS = "…";
