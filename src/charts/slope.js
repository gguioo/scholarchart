/* ============ 坡度图（两时间点间的排名/数值流转） ============ */

import { el, text, INK, colors } from '../core/svg.js';
import { caption, figureNote, fmt } from '../core/axis.js';
import { niceTicks, linear } from '../core/scale.js';
import { tip, tipHide } from '../core/tip.js';

/*
 * data = {
 *   times: ['2015', '2024'],
 *   series: [ { name:'庄子', values:[410, 1024] } ],
 *   y: { label:'年发文量 / 篇' }
 * }
 * o = { labels:true }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const T = data.times, S = [...data.series].sort((a, b) => b.values[0] - a.values[0]);
  const cs = colors();
  const footH = o.note || o.figLabel ? 26 : 15;

  const all = S.flatMap(s => s.values);
  const Y = niceTicks(0, Math.max(...all) * 1.06 + .001, 5);
  const box = { x: 26, y: top + 12, w: W - 48, h: H - top - 12 - footH };
  const val = linear(Y.lo, Y.hi, box.y + box.h, box.y);
  const xs = T.map((_, i) => box.x + box.w * i / (T.length - 1));

  /* 双侧刻度 */
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of Y.ticks) {
    el('line', { x1: box.x - 1.2, x2: box.x, y1: val(t), y2: val(t) }, tk);
    el('line', { x1: box.x + box.w, x2: box.x + box.w + 1.2, y1: val(t), y2: val(t) }, tk);
    text(svg, box.x - 1.9, val(t) + .85, fmt(t), { size: 2.5, anchor: 'end', fill: INK.soft });
    text(svg, box.x + box.w + 1.9, val(t) + .85, fmt(t), { size: 2.5, fill: INK.soft });
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}M${box.x + box.w} ${box.y}V${box.y + box.h}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);

  /* 时间点标签（轴顶） */
  T.forEach((t, i) => text(svg, xs[i], box.y - 2.2, t, { size: 3, anchor: 'middle' }));
  if (data.y?.label)
    text(svg, W / 2, box.y + box.h + 5.2, data.y.label, { size: 2.7, anchor: 'middle', fill: INK.soft });

  /* 端点标签防叠：按目标侧排序后强制最小间距 */
  const place = (sideIdx, anchor, tx) => {
    const items = S.map(s => ({ s, y: val(s.values[sideIdx]) })).sort((a, b) => a.y - b.y);
    const minGap = 3.4;
    items.forEach((it, k) => {
      if (k > 0 && it.y < items[k - 1].y + minGap) it.y = items[k - 1].y + minGap;
    });
    items.forEach(it => {
      text(svg, tx, it.y + .85, `${it.s.name} ${fmt(it.s.values[sideIdx])}`, {
        size: 2.5, anchor, fill: INK.base,
        extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .6 }
      });
    });
  };
  if (o.labels !== false) { place(0, 'end', box.x - 6.5); place(T.length - 1, 'start', box.x + box.w + 6.5); }

  /* 连线：升/降/平 三色 */
  S.forEach(s => {
    const up = s.values[T.length - 1] > s.values[0];
    const down = s.values[T.length - 1] < s.values[0];
    const color = up ? cs[1] : down ? cs[3] : INK.soft;
    const d = `M${xs[0]} ${val(s.values[0])}` + xs.slice(1).map((x, i) => `L${x} ${val(s.values[i + 1])}`).join('');
    const p = el('path', { d, fill: 'none', stroke: color, 'stroke-width': .55, 'stroke-opacity': .85, cursor: 'pointer' }, svg);
    xs.forEach((x, i) => el('circle', { cx: x, cy: val(s.values[i]), r: .85, fill: color, fillOpacity: .95 }, svg));
    const msg = `<b>${s.name}</b><br>${T.map((t, i) => `${t}：${fmt(s.values[i])}`).join('<br>')}<br>变化：${(s.values[T.length - 1] - s.values[0]) >= 0 ? '+' : ''}${fmt(s.values[T.length - 1] - s.values[0])}`;
    p.addEventListener('pointerenter', ev => tip(msg, ev));
    p.addEventListener('pointermove', ev => tip(msg, ev));
    p.addEventListener('pointerleave', tipHide);
  });

  figureNote(svg, o);
  return svg;
}
