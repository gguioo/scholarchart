/* ============ 雷达图（多维对比 · 淡填充 · 同心发丝环） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261114d';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114d';
import { smoothPath } from '../core/scale.js?v=20261114d';
import { tip, tipHide } from '../core/tip.js?v=20261114d';

/*
 * data = {
 *   axes: ['理论创新','文献驾驭',...],
 *   series: [ { name:'庄子研究', values:[0-1...], full:[可选满分基数] } ]
 * }
 * o = { smooth, rings:5, fillOpacity }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const footH = o.note || o.figLabel ? 24 : 14;

  const A = data.axes, S = data.series;
  const n = A.length;
  const cx = W / 2, cy = top + (H - top - footH) / 2 + 2;
  const R = Math.min(W, H - top - footH) / 2 - 17;

  const rings = o.rings ?? 5;
  const cs = colors();
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];

  /* 同心发丝多边形（环值不标数字，靠副题说明刻度，学术惯例更干净） */
  for (let k = 1; k <= rings; k++) {
    const rr = R * k / rings;
    el('path', {
      d: 'M' + Array.from({ length: n }, (_, i) => pt(i, rr).join(' ')).join('L') + 'Z',
      fill: 'none', stroke: k === rings ? INK.axis : INK.hair, 'stroke-width': k === rings ? .35 : .2
    }, svg);
  }

  /* 轴辐条 + 维度标签 */
  for (let i = 0; i < n; i++) {
    const [ex, ey] = pt(i, R);
    el('line', { x1: cx, y1: cy, x2: ex, y2: ey, stroke: INK.hair, 'stroke-width': .2 }, svg);
    const [lx, ly] = pt(i, R + 5);
    const anchor = Math.abs(lx - cx) < 2 ? 'middle' : (lx > cx ? 'start' : 'end');
    text(svg, lx, ly + .8, A[i], { size: 2.7, anchor, fill: INK.base });
  }

  /* 序列多边形 */
  S.forEach((s, si) => {
    const color = s.color || cs[si % cs.length];
    const P = s.values.map((v, i) => pt(i, R * Math.max(0, Math.min(1, v))));
    const d = (o.smooth ?? true) && n > 4 ? smoothPath(P.concat([P[0]])) : 'M' + P.concat([P[0]]).map(p => p.join(' ')).join('L');
    el('path', { d, fill: color, 'fill-opacity': o.fillOpacity ?? .14, stroke: color, 'stroke-width': .8, 'stroke-linejoin': 'round' }, svg);
    P.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 1, fill: color, stroke: '#fff', 'stroke-width': .4 }, svg));
    P.forEach((p, i) => {
      const c = el('circle', { cx: p[0], cy: p[1], r: 2.6, fill: 'transparent' }, svg);
      const h = ev => { tip(`<b>${A[i]}</b><br><span style="color:${color}">●</span> ${s.name}　${fmt(s.values[i])}`, ev); };
      c.addEventListener('pointerenter', h); c.addEventListener('pointermove', h);
      c.addEventListener('pointerleave', tipHide);
    });
  });

  /* 图例（底部横排） */
  const lg = el('g', {}, svg);
  let lx = W / 2 - S.reduce((a, s) => a + s.name.length * 3.4 + 8, 0) / 2 + 4;
  S.forEach((s, si) => {
    const color = s.color || cs[si % cs.length];
    el('rect', { x: lx, y: H - footH + 1.5, width: 1.8, height: 1.8, fill: color }, lg);
    text(svg, lx + 3, H - footH + 4.4, s.name, { size: 2.5 });
    lx += 3 + s.name.length * 3.4 + 8;
  });

  figureNote(svg, o);
  return svg;
}
