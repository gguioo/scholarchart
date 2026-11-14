/* ============ 克利夫兰点图（位置编码 > 长度编码：分组柱状图的更优替身） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261114b';
import { caption, figureNote, legend, fmt } from '../core/axis.js?v=20261114b';
import { niceTicks, linear } from '../core/scale.js?v=20261114b';
import { tip, tipHide } from '../core/tip.js?v=20261114b';

/*
 * data = {
 *   categories: ['逍遥游','齐物论',...],
 *   series: [ { name:'2015', values:[..] } ],
 *   x: { label:'篇均被引 / 次' }
 * }
 * o = { valueLabels:true }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const S = data.series, C = data.categories;
  const cs = colors();
  const footH = o.note || o.figLabel ? 28 : 16;

  const all = S.flatMap(s => s.values);
  const X = niceTicks(0, Math.max(...all) * 1.08 + .001, 5);
  const box = { x: 24, y: top + 9, w: W - 32, h: H - top - 9 - footH };
  const val = linear(X.lo, X.hi, box.x, box.x + box.w);
  const rowStep = box.h / C.length;

  /* 轴：左（类目）+ 下（数值） */
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of X.ticks) {
    el('line', { x1: val(t), x2: val(t), y1: box.y + box.h, y2: box.y + box.h + 1.2 }, tk);
    text(svg, val(t), box.y + box.h + 3.4, fmt(t), { size: 2.5, anchor: 'middle', fill: INK.soft });
    if (t !== X.lo) el('line', { x1: val(t), x2: val(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7.2, data.x.label, { size: 2.8, anchor: 'middle' });

  C.forEach((c, i) => {
    const cy = box.y + (i + .5) * rowStep;
    text(svg, box.x - 1.8, cy + .9, c, { size: 2.6, anchor: 'end' });
    /* 行引导线（发丝） */
    el('line', { x1: box.x, x2: box.x + box.w, y1: cy, y2: cy, stroke: INK.hair, 'stroke-width': .18 }, svg);
  });

  /* 点层：多系列上下微错位，单系列居中 */
  const off = S.length > 1 ? 1.15 : 0;
  S.forEach((s, si) => {
    const color = s.color || cs[si % cs.length];
    C.forEach((c, ci) => {
      const v = s.values[ci];
      const cy = box.y + (ci + .5) * rowStep + (S.length > 1 ? (si - (S.length - 1) / 2) * off : 0);
      const p = el('circle', { cx: val(v), cy, r: S.length > 1 ? 1 : 1.15, fill: color, fillOpacity: .92, cursor: 'pointer' }, svg);
      if (o.valueLabels !== false && S.length === 1)
        text(svg, val(v) + 1.6, cy + .8, fmt(v), {
          size: 2.2, fill: INK.base,
          extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .5 }
        });
      const msg = `<b>${c}</b><br><span style="color:${color}">●</span> ${s.name}　${fmt(v)}`;
      p.addEventListener('pointerenter', ev => tip(msg, ev));
      p.addEventListener('pointermove', ev => tip(msg, ev));
      p.addEventListener('pointerleave', tipHide);
    });
  });

  if (S.length > 1 && o.legend !== false)
    legend(svg, S.map((s, i) => ({ type: 'rect', color: s.color || cs[i % cs.length], label: s.name })), { pos: 'top', x: 24, y: top + 2.5 });

  figureNote(svg, o);
  return svg;
}
