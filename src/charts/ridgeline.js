/* ============ 山脊图（多分布错层叠放：分布随类别/时间的漂移） ============ */
/* ridgeline / joyplot —— 20 个小直方图的优雅替身 */

import { el, text, INK, colors } from '../core/svg.js?v=20261111g';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261111g';
import { niceTicks, linear, kde, smoothPath } from '../core/scale.js?v=20261111g';
import { tip, tipHide } from '../core/tip.js?v=20261111g';

/*
 * data = {
 *   rows: [ { name:'2015', values:[..] } ],   // 自下而上绘制（首行在最底）
 *   x: { label:'年发文量 / 篇' }
 * }
 * o = { overlap:.62 }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const R = data.rows, cs = colors();
  const footH = o.note || o.figLabel ? 26 : 15;

  const all = R.flatMap(r => r.values);
  const X = niceTicks(Math.min(...all), Math.max(...all) * 1.02 + .001, 5);
  const box = { x: 18, y: top + 8, w: W - 25, h: H - top - 8 - footH };
  const val = linear(X.lo, X.hi, box.x, box.x + box.w);
  const overlap = o.overlap ?? .62;                // 行间重叠率
  const rowStep = box.h / ((R.length - 1) + .95 / (1 - overlap));
  const crest = rowStep / (1 - overlap) * .95;     // 每条山脊的最大高度

  /* 底轴 */
  for (const t of X.ticks) {
    el('line', { x1: val(t), x2: val(t), y1: box.y + box.h, y2: box.y + box.h + 1.2, stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, val(t), box.y + box.h + 3.5, fmt(t), { size: 2.4, anchor: 'middle', fill: INK.soft });
    if (t !== X.lo) el('line', { x1: val(t), x2: val(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  el('path', { d: `M${box.x} ${box.y + box.h}V${box.y}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7.2, data.x.label, { size: 2.8, anchor: 'middle' });

  /* 山脊：首行在底，逐行向上后画覆盖前者 */
  const grid = Array.from({ length: 72 }, (_, i) => X.lo + (X.hi - X.lo) * i / 71);
  R.forEach((r, i) => {
    const base = box.y + box.h - i * rowStep;      // 该行基线 y
    const dens = kde(r.values, grid);
    const dMax = Math.max(...dens, 1e-9);
    const pts = dens.map((d, j) => [val(grid[j]), base - d / dMax * crest]);
    const d = smoothPath(pts) + `L${val(X.hi).toFixed(2)} ${base.toFixed(2)}L${val(X.lo).toFixed(2)} ${base.toFixed(2)}Z`;
    const color = cs[i % cs.length];
    el('path', { d, fill: color, 'fill-opacity': .5, stroke: color, 'stroke-width': .5, cursor: 'pointer' }, svg);
    el('line', { x1: box.x, x2: box.x + box.w, y1: base, y2: base, stroke: INK.hair, 'stroke-width': .2 }, svg);
    text(svg, box.x - 2.5, base + .9, r.name, { size: 2.3, anchor: 'end', fill: INK.soft });
    const m = r.values.reduce((a, b) => a + b, 0) / r.values.length;
    const msg = `<b>${r.name}</b><br>n = ${r.values.length} · 均值 ${fmt(+m.toFixed(1))}<br>峰值密度位于 ${fmt(Math.round(grid[dens.indexOf(dMax)]))}`;
    const hit = el('rect', { x: box.x, y: base - crest, width: box.w, height: crest + .5, fill: 'transparent', cursor: 'pointer' }, svg);
    [hit].forEach(n => {
      n.addEventListener('pointerenter', ev => tip(msg, ev));
      n.addEventListener('pointermove', ev => tip(msg, ev));
      n.addEventListener('pointerleave', tipHide);
    });
  });

  figureNote(svg, o);
  return svg;
}
