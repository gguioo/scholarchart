/* ============ 柱状图（分组 · 横向可选 · 误差棒 · 数值标注） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261111h';
import { caption, figureNote, legend, fmt } from '../core/axis.js?v=20261111h';
import { niceTicks, linear } from '../core/scale.js?v=20261111h';
import { tip, tipHide } from '../core/tip.js?v=20261111h';

/*
 * data = {
 *   categories: ['庄子','墨子',...],
 *   series: [ { name:'2024', values:[..], err:[..] } ],
 *   y: { label:'被引量 / 次' }
 * }
 * o = { horizontal, valueLabels, grid }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const S = data.series, C = data.categories;
  const horiz = !!o.horizontal;
  const footH = o.note || o.figLabel ? 31 : 18;

  const all = S.flatMap(s => s.values).concat(S.flatMap(s => (s.err || []).flatMap((e, i) => [s.values[i] + e, s.values[i] - e])));
  const yMax = o.yDomain?.[1] ?? Math.max(...all, 0) * 1.12 + .001;
  const yMin = 0;
  const Y = niceTicks(yMin, yMax, 5);

  /* 布局：竖向 → box；横向 → 交换 */
  const box = horiz
    ? { x: 24, y: top + 8, w: W - 32, h: H - top - footH - 2 }
    : { x: 17, y: top + 9, w: W - 26, h: H - top - footH - 2 };

  const val = linear(Y.lo, Y.hi, horiz ? box.x : box.y + box.h, horiz ? box.x + box.w : box.y);
  const cs = colors();
  const catStep = (horiz ? box.h : box.w) / C.length;
  const inner = catStep * .72;
  const barW = inner / S.length;

  /* 轴刺 + 网格 */
  if (o.grid !== false) {
    const g = el('g', {}, svg);
    for (const t of Y.ticks) {
      if (horiz) el('line', { x1: val(t), x2: val(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, g);
      else el('line', { x1: box.x, x2: box.x + box.w, y1: val(t), y2: val(t), stroke: INK.hair, 'stroke-width': .2 }, g);
    }
  }
  el('path', {
    d: horiz
      ? `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`
      : `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`,
    fill: 'none', stroke: INK.axis, 'stroke-width': .35
  }, svg);

  /* 数值轴刻度 */
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of Y.ticks) {
    if (horiz) {
      el('line', { x1: val(t), x2: val(t), y1: box.y + box.h, y2: box.y + box.h - 1.2 }, tk);
      text(svg, val(t), box.y + box.h + 3.2, fmt(t), { size: 2.5, anchor: 'middle', fill: INK.soft });
    } else {
      el('line', { x1: box.x, x2: box.x + 1.2, y1: val(t), y2: val(t) }, tk);
      text(svg, box.x - 1.6, val(t) + .85, fmt(t), { size: 2.5, anchor: 'end', fill: INK.soft });
    }
  }

  /* 类目标签 */
  C.forEach((c, i) => {
    const cPos = (i + .5) * catStep;
    if (horiz) text(svg, box.x - 1.6, box.y + cPos + .9, c, { size: 2.6, anchor: 'end' });
    else {
      const label = String(c);
      if (label.length > 4 && C.length > 6) {
        const t = text(svg, box.x + cPos, box.y + box.h + 3.4, label.slice(0, 4) + '…', { size: 2.5, anchor: 'middle', fill: INK.soft });
        t.addEventListener('pointerenter', ev => tip(`<b>${label}</b>`, ev));
        t.addEventListener('pointerleave', tipHide);
      } else text(svg, box.x + cPos, box.y + box.h + 3.4, label, { size: 2.5, anchor: 'middle', fill: INK.soft });
    }
  });

  /* 轴标题 */
  const yLab = data.y?.label || '';
  if (yLab) {
    if (horiz) text(svg, box.x + box.w / 2, box.y + box.h + 8, yLab, { size: 2.9, anchor: 'middle' });
    else {
      const t = text(svg, 0, 0, yLab, { size: 2.9, anchor: 'middle' });
      t.setAttribute('transform', `translate(${box.x - 8.5} ${box.y + box.h / 2}) rotate(-90)`);
    }
  }

  /* 柱体 */
  const hoverG = el('g', {}, svg);
  C.forEach((c, ci) => {
    S.forEach((s, si) => {
      const v = s.values[ci], e = s.err?.[ci];
      const color = s.color || cs[si % cs.length];
      const g = el('g', { class: 'sc-bar' }, svg);
      let bx, by, bw, bh;
      if (horiz) {
        bh = barW * .86;
        by = box.y + ci * catStep + catStep * .14 + si * barW;
        bx = val(Math.min(0, v)); bw = Math.abs(val(v) - val(0));
        el('rect', { x: bx, y: by, width: bw, height: bh, fill: color, 'fill-opacity': .88 }, g);
        if (e) el('line', { x1: val(v + e), x2: val(v + e), y1: by - .6, y2: by + bh + .6, stroke: INK.base, 'stroke-width': .35 }, g);
      } else {
        bw = barW * .86;
        bx = box.x + ci * catStep + catStep * .14 + si * barW;
        by = val(v); bh = (val(0) ?? box.y + box.h) - val(v);
        el('rect', { x: bx, y: by, width: bw, height: bh, fill: color, 'fill-opacity': .88 }, g);
        if (e) {
          el('line', { x1: bx + bw / 2, x2: bx + bw / 2, y1: val(v + e), y2: val(v - e), stroke: INK.base, 'stroke-width': .35 }, g);
          el('line', { x1: bx + bw / 2 - .9, x2: bx + bw / 2 + .9, y1: val(v + e), y2: val(v + e), stroke: INK.base, 'stroke-width': .35 }, g);
          el('line', { x1: bx + bw / 2 - .9, x2: bx + bw / 2 + .9, y1: val(v - e), y2: val(v - e), stroke: INK.base, 'stroke-width': .35 }, g);
        }
        if (o.valueLabels) {
          /* 有误差棒 → 标签抬到误差棒顶端上方；顶出画布则退回柱内 */
          const topY = e != null ? val(v + e) : by;
          if (topY - 3.8 >= box.y) {
            text(svg, bx + bw / 2, topY - 1.5, fmt(v), {
              size: 2.2, anchor: 'middle', fill: INK.base,
              extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .6 }
            });
          } else {
            text(svg, bx + bw / 2, by + 3.6, fmt(v), {
              size: 2.2, anchor: 'middle', fill: INK.base,
              extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .7 }
            });
          }
        }
      }
      g.addEventListener('pointerenter', ev => {
        g.querySelector('rect').setAttribute('fill-opacity', 1);
        tip(`<b>${c}</b><br><span style="color:${color}">■</span> ${s.name}　${fmt(v)}${e != null ? ' ± ' + fmt(e) : ''}`, ev);
      });
      g.addEventListener('pointermove', ev => tip(`<b>${c}</b><br><span style="color:${color}">■</span> ${s.name}　${fmt(v)}${e != null ? ' ± ' + fmt(e) : ''}`, ev));
      g.addEventListener('pointerleave', () => { g.querySelector('rect').setAttribute('fill-opacity', .88); tipHide(); });
    });
  });

  if (S.length > 1 && o.legend !== false)
    legend(svg, S.map((s, i) => ({ type: 'rect', color: s.color || cs[i % cs.length], label: s.name })), { pos: 'top', x: 17, y: top + 2.5 });

  figureNote(svg, o);
  return svg;
}
