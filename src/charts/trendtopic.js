/* ============ 主题趋势图（Trend Topic：文献计量关键词年度跨度） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261114e';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114e';
import { niceTicks, linear } from '../core/scale.js?v=20261114e';
import { tip, tipHide } from '../core/tip.js?v=20261114e';

/*
 * data = {
 *   terms: [ { name:'外泌体', span:[2013, 2024], peak:2022, freq:210 }, ... ],
 *   x: { label:'年份' }
 * }
 * o = { sizeLegend:true }
 *
 * 横线 = 关键词出现的年份跨度；圆点 = 峰值年（缺省取跨度末端）；
 * 圆点面积 ∝ 词频。按峰值年自上而下降序排列（与 Biblioshiny 惯例一致）。
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const T = [...data.terms].sort((a, b) => (b.peak ?? b.span[1]) - (a.peak ?? a.span[1]));
  const cs = colors();
  const footH = o.note || o.figLabel ? 26 : 15;

  const years = T.flatMap(t => t.span);
  const X = niceTicks(Math.min(...years), Math.max(...years), 6);
  const box = { x: 30, y: top + 9, w: W - 62, h: H - top - 9 - footH };
  const val = linear(X.lo, X.hi, box.x, box.x + box.w);
  const rowStep = box.h / T.length;

  /* 词频 → 半径（面积比例，sqrt 标度） */
  const freqs = T.map(t => t.freq ?? 0);
  const fmin = Math.min(...freqs), fmax = Math.max(...freqs);
  const R = { min: .9, max: 3.1 };
  const rOf = f => R.min + (R.max - R.min) * Math.sqrt((f - fmin) / ((fmax - fmin) || 1));

  /* 轴：左（类目）+ 下（年份） */
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of X.ticks) {
    el('line', { x1: val(t), x2: val(t), y1: box.y + box.h, y2: box.y + box.h + 1.2 }, tk);
    text(svg, val(t), box.y + box.h + 3.4, fmt(t), { size: 2.5, anchor: 'middle', fill: INK.soft });
    if (t !== X.lo) el('line', { x1: val(t), x2: val(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7.2, data.x.label, { size: 2.8, anchor: 'middle' });

  /* 行：跨度线 + 峰值圆点 */
  const color = cs[0];
  T.forEach((t, i) => {
    const cy = box.y + (i + .5) * rowStep;
    text(svg, box.x - 1.8, cy + .9, t.name, { size: 2.6, anchor: 'end' });

    const x0 = val(t.span[0]), x1 = val(t.span[1]);
    if (x1 > x0)
      el('line', { x1: x0, x2: x1, y1: cy, y2: cy, stroke: color, 'stroke-width': .7, 'stroke-opacity': .8 }, svg);

    const peak = t.peak ?? t.span[1];
    const freq = t.freq ?? 0;
    const dot = el('circle', {
      cx: val(peak), cy, r: rOf(freq),
      fill: color, fillOpacity: .9, stroke: '#fff', 'stroke-width': .25, cursor: 'pointer'
    }, svg);
    const msg = `<b>${t.name}</b><br>跨度：${t.span[0]}–${t.span[1]} 年<br>峰值年：${peak}<br>词频：${fmt(freq)}`;
    dot.addEventListener('pointerenter', ev => tip(msg, ev));
    dot.addEventListener('pointermove', ev => tip(msg, ev));
    dot.addEventListener('pointerleave', tipHide);
  });

  /* 尺寸图例（右上，小→大） */
  if (o.sizeLegend !== false && fmax > fmin) {
    const lx = W - 26, ly0 = box.y + 2;
    text(svg, lx, ly0 - 1.5, '词频', { size: 2.5, anchor: 'middle', fill: INK.base });
    const lv = niceTicks(fmin, fmax, 4).ticks.filter(v => v >= fmin && v <= fmax);
    let ly = ly0 + 3;
    for (const v of lv) {
      el('circle', { cx: lx, cy: ly + rOf(v), r: rOf(v), fill: color, fillOpacity: .9, stroke: '#fff', 'stroke-width': .25 }, svg);
      text(svg, lx + R.max + 1.6, ly + rOf(v) * 2 - rOf(v) + .9, fmt(v), { size: 2.3, fill: INK.soft });
      ly += rOf(v) * 2 + 1.6;
    }
  }

  figureNote(svg, o);
  return svg;
}
