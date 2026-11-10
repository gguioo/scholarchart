/* ============ ScholarChart · 学术图表引擎 ============ */
/* 命名空间 + 通用 DOM/SVG 工具 */

export const SC = {};

/* 创建 SVG 元素 */
export function el(name, attrs = {}, parent = null) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* 文本元素（衬线学术风） */
export function text(parent, x, y, str, attrs = {}) {
  const t = el('text', {
    x, y,
    'font-family': attrs.mono ? FONT.mono : FONT.stack(),
    'font-size': attrs.size ?? 2.6,
    fill: attrs.fill ?? INK.base,
    'text-anchor': attrs.anchor ?? 'start',
    'dominant-baseline': attrs.baseline ?? 'auto',
    ...attrs.extra || {}
  }, parent);
  t.textContent = str;
  return t;
}

/* 字体与墨色系统（单位 mm）
 * 内置子集字体（OFL 思源宋体/黑体，按常用字裁剪）置于字栈首位，
 * 系统缺失时逐级回退；转曲导出与所见渲染保持同一字形来源。 */
export const FONT = {
  serif: "'ScholarChart Serif','Noto Serif SC','Source Han Serif SC','Songti SC','SimSun',Georgia,serif",
  sans: "'ScholarChart Sans',Arial,'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',sans-serif",
  mono: "Georgia,'Times New Roman',serif",
  cur: (function () { try { return localStorage.getItem('scFont') === 'sans' ? 'sans' : 'serif'; } catch (e) { return 'serif'; } })(),
  stack() { return this[this.cur]; }
};
export function setFont(f) {
  FONT.cur = f === 'sans' ? 'sans' : 'serif';
  try { localStorage.setItem('scFont', FONT.cur); } catch (e) {}
}
export const INK = {
  base: '#2A2A28',      // 正文墨
  soft: '#8A8A85',      // 次要信息
  hair: '#E8E8E2',      // 发丝网格线
  axis: '#B9B9B2',      // 轴线
  bg: '#FFFFFF'
};

/* 淡雅学术配色（奥卡贝-伊藤色盲安全系 · 柔化版） */
export const PALETTES = {
  danli: ['#7B98B8', '#9EB388', '#D2A97E', '#C08E8E', '#9D90B5', '#89B4B0', '#C4A0B0', '#A3A39B'],
  qing: ['#6E93A8', '#9CBABF', '#C4D3C0', '#E3D9A8', '#D9BCA0', '#C7CBE3', '#B7C8C9', '#D8C4C4'],
  mono: ['#5A6B78', '#8291A0', '#A9B5BE', '#C4CCD2', '#DCE1E5', '#98A8B6', '#7E93A3', '#B4C3CF'],
  nuan: ['#C09785', '#9BA97F', '#C9B27E', '#9C8FA3', '#B08E97', '#A29B8B', '#D2B48E', '#8FA5A5']
};
export const PAL = { name: 'danli' };
export function colors() { return PALETTES[PAL.name] || PALETTES.danli; }

/* 序列色（热力图用，单色渐进淡雅） */
export const SEQUENTIAL = {
  sage:  ['#F5F7F2', '#DCE5D5', '#B9CCA8', '#93AE85', '#6E8F63', '#517047', '#3A5333'],
  blue:  ['#F4F7F9', '#DCE7ED', '#B4CBD8', '#89AEC1', '#6E93A8', '#4F7085', '#38515F'],
  clay:  ['#F9F5F2', '#EDDCCC', '#DDBFA5', '#C89E7E', '#A87E60', '#85604A', '#61452F']
};
