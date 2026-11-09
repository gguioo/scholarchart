/* ============ UpSet 图（集合交集：韦恩图的现代替身） ============ */
/* Lex et al. 2014, Nature Methods —— 支持任意多集合的交集规模排序 */

import { el, text, INK, colors } from '../core/svg.js';
import { caption, figureNote, fmt } from '../core/axis.js';
import { linear } from '../core/scale.js';
import { tip, tipHide } from '../core/tip.js';

/*
 * data = {
 *   sets: ['道','仁','义','礼','法','心'],
 *   setSizes: [412, 356, ...],                    // 各集合元素数（可选，缺省由 items 计算）
 *   intersections: [ { sets:[0,1], size:58 }, ... ] // 非空交集
 * }
 * o = { nCols:8 }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const S = data.sets, cs = colors();
  const footH = o.note || o.figLabel ? 26 : 15;

  const inter = (data.intersections || [])
    .map(x => ({ ...x })).sort((a, b) => b.size - a.size)
    .slice(0, o.nCols ?? 8);
  const setSizes = data.setSizes || S.map((_, i) =>
    (data.intersections || []).filter(x => x.sets.includes(i)).reduce((a, b) => a + b.size, 0));

  /* 布局：左 = 集合规模条（独立面板，不越界）；下 = 交集矩阵；上 = 交集规模条 */
  const x0 = 32;                                    // 矩阵左沿（左面板 0–29 专用）
  const topT = top + 8 + 16;                        // 上方交集条的底部基线
  const matB = H - footH - 9;                       // 矩阵底部（下方留旋转列名）
  const nS = S.length, rowH = Math.min(3.4, (matB - topT - 2) / nS);
  const nC = inter.length;
  const cw = (W - x0 - 12) / Math.max(1, nC);

  /* ① 左侧：各集合规模（条 + 右对齐数值，互不侵入矩阵） */
  const maxSet = Math.max(...setSizes, 1);
  const sVal = linear(0, maxSet, 0, 10.5);
  S.forEach((name, i) => {
    const y = topT + 2 + i * rowH + rowH / 2;
    text(svg, 2, y + .9, name, { size: 2.5 });
    el('rect', { x: 9, y: y - rowH * .26, width: Math.max(.3, sVal(setSizes[i])), height: rowH * .52, fill: cs[i % cs.length], 'fill-opacity': .85 }, svg);
    text(svg, 28.5, y + .9, fmt(setSizes[i]), { size: 2.2, anchor: 'end', fill: INK.soft });
  });

  /* ② 矩阵：圆点 + 列内连线 */
  const dotG = el('g', {}, svg);
  inter.forEach((it, c) => {
    const cx = x0 + (c + .5) * cw;
    const rows = S.map((_, i) => i);
    const on = i => it.sets.includes(i);
    const ys = rows.map(i => topT + 2 + i * rowH + rowH / 2);
    const first = it.sets[0], last = it.sets[it.sets.length - 1];
    if (it.sets.length > 1)
      el('line', { x1: cx, x2: cx, y1: ys[first], y2: ys[last], stroke: INK.base, 'stroke-width': .4 }, dotG);
    S.forEach((_, i) => {
      const is = on(i);
      el('circle', { cx, cy: ys[i], r: is ? 1 : .8, fill: is ? INK.base : '#fff', stroke: is ? 'none' : INK.axis, 'stroke-width': .3 }, dotG);
    });
  });

  /* ③ 上方：交集规模条 */
  const maxInt = Math.max(...inter.map(x => x.size), 1);
  const iVal = linear(0, maxInt, topT, topT - 13);
  inter.forEach((it, c) => {
    const cx = x0 + (c + .5) * cw;
    const bw = Math.min(cw * .55, 4.2);
    const yTop = iVal(it.size);
    const bar = el('rect', { x: cx - bw / 2, y: yTop, width: bw, height: topT - yTop, fill: cs[2 % cs.length], 'fill-opacity': .85 }, svg);
    text(svg, cx, yTop - 1.1, fmt(it.size), { size: 2.3, anchor: 'middle', fill: INK.base });
    const name = it.sets.map(i => S[i]).join('·');
    const lab = text(svg, 0, 0, name, { size: 2.3, anchor: 'end', fill: INK.soft });
    lab.setAttribute('transform', `translate(${cx + cw * .35} ${matB + 1.8}) rotate(-40)`);
    const hit = el('rect', { x: cx - cw / 2, y: topT - 15, width: cw, height: matB - topT + 17, fill: 'transparent' }, svg);
    hit.addEventListener('pointerenter', ev => tip(`<b>${name}</b><br>交集规模：${fmt(it.size)} 篇`, ev));
    hit.addEventListener('pointermove', ev => tip(`<b>${name}</b><br>交集规模：${fmt(it.size)} 篇`, ev));
    hit.addEventListener('pointerleave', tipHide);
  });

  /* 矩阵区外框细线（上下包住） */
  el('line', { x1: x0 - 1.5, x2: x0 + nC * cw + 1.5, y1: topT, y2: topT, stroke: INK.hair, 'stroke-width': .25 }, svg);
  el('line', { x1: x0 - 1.5, x2: x0 + nC * cw + 1.5, y1: matB, y2: matB, stroke: INK.hair, 'stroke-width': .25 }, svg);

  figureNote(svg, o);
  return svg;
}
