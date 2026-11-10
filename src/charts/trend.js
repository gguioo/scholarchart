/* ============ 趋势图（多序列 · 平滑可选 · 置信带） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261111g';
import { axisFrame, caption, figureNote, legend, fmt } from '../core/axis.js?v=20261111g';
import { smoothPath } from '../core/scale.js?v=20261111g';
import { tip, tipMove, tipHide, hoverable } from '../core/tip.js?v=20261111g';

/*
 * data = {
 *   x: { categories:['2019',...], label:'年份' },
 *   y: { label:'发文量 / 篇' },
 *   series: [ { name:'庄子', values:[..], lo:[..], hi:[..], smooth:true, dashed:false } ]
 * }
 * o = { smooth, markers, confidence, grid, yDomain, ...标题图注 }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const box = { x: 17, y: top + 9, w: W - 26, h: H - top - (o.note || o.figLabel ? 31 : 18) };

  const S = data.series;
  const all = S.flatMap(s => s.values).concat(S.flatMap(s => s.hi || []), S.flatMap(s => s.lo || []));
  const yMin = o.yDomain?.[0] ?? Math.min(0, ...all);
  const yMax = o.yDomain?.[1] ?? Math.max(...all) * 1.06 + .001;

  const cat = data.x.categories;
  const af = axisFrame(svg, {
    box, xDomain: [0, cat.length - 1], yDomain: [yMin, yMax],
    xLabel: data.x.label || '', yLabel: data.y?.label || '', grid: o.grid || 'y',
    hideXTicks: true
  });
  /* 类目轴：数字刻度换成类目标签 */
  const cs = colors();
  const hl = el('g', {}, svg);

  S.forEach((s, si) => {
    const color = s.color || cs[si % cs.length];
    const pts = s.values.map((v, i) => [af.x(i), af.y(v)]);

    if (s.lo && s.hi && o.confidence !== false) {
      const up = s.hi.map((v, i) => `${af.x(i)} ${af.y(v)}`).join('L');
      const dn = s.lo.map((v, i) => `${af.x(i)} ${af.y(v)}`).reverse().join('L');
      el('path', { d: `M${up}L${dn}Z`, fill: color, 'fill-opacity': .10 }, svg);
    }

    const d = (o.smooth ?? s.smooth) ? smoothPath(pts) : 'M' + pts.map(p => p.join(' ')).join('L');
    el('path', {
      d, fill: 'none', stroke: color, 'stroke-width': .8,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      ...(s.dashed ? { 'stroke-dasharray': '2.4 1.8' } : {})
    }, svg);

    if (o.markers !== false) pts.forEach(p =>
      el('circle', { cx: p[0], cy: p[1], r: 1.05, fill: '#fff', stroke: color, 'stroke-width': .55 }, svg));
  });

  /* 类目标签覆盖数字刻度 */
  cat.forEach((c, i) =>
    text(svg, af.x(i), box.y + box.h + 3.2, c, { size: 2.5, anchor: 'middle', fill: INK.soft }));

  /* 悬浮捕获：竖带 + 十字线 + 各序列数值 */
  const zoneG = el('g', {}, svg);
  cat.forEach((c, i) => {
    const w = box.w / cat.length;
    const zone = el('rect', { x: af.x(i) - w / 2, y: box.y, width: w, height: box.h, fill: 'transparent' }, zoneG);
    const render = ev => {
      hl.innerHTML = '';
      el('line', { x1: af.x(i), x2: af.x(i), y1: box.y, y2: box.y + box.h, stroke: INK.axis, 'stroke-width': .3, 'stroke-dasharray': '1 1' }, hl);
      S.forEach((s, j) => el('circle', { cx: af.x(i), cy: af.y(s.values[i]), r: 1.7, fill: s.color || cs[j % cs.length], stroke: '#fff', 'stroke-width': .5 }, hl));
      tip(`<b>${c}</b><br>` + S.map((s, j) =>
        `<span style="color:${s.color || cs[j % cs.length]}">●</span> ${s.name}　${fmt(s.values[i])}`).join('<br>'), ev);
    };
    zone.addEventListener('pointerenter', render);
    zone.addEventListener('pointermove', render);
    zone.addEventListener('pointerleave', () => { hl.innerHTML = ''; tipHide(); });
  });

  if (S.length > 1 && o.legend !== false)
    legend(svg, S.map((s, i) => ({ type: 'line', color: s.color || cs[i % cs.length], label: s.name })), { pos: 'top', x: 17, y: top + 2.5 });

  figureNote(svg, o);
  return svg;
}
