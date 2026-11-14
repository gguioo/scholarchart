/* ============ 战略坐标图（密度 × 向心性四象限：文献计量主题定位） ============ */
/* Cobo et al. 2011, bibliometrix thematic map */

import { el, text, INK, colors } from '../core/svg.js?v=20261114d';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114d';
import { niceTicks, linear } from '../core/scale.js?v=20261114d';
import { tip, tipHide } from '../core/tip.js?v=20261114d';

/*
 * data = {
 *   themes: [ { name:'心性论', x:.72, y:.81, size:412, group:0 } ],  // x=向心性, y=密度
 *   x: { label:'向心性' }, y: { label:'密度' }
 * }
 * o = { quadrants:true }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const TH = data.themes, cs = colors();
  const footH = o.note || o.figLabel ? 26 : 15;

  const pad = 1.2;                                // x/y 的数值域padding
  const xLo = Math.min(...TH.map(t => t.x)) - pad, xHi = Math.max(...TH.map(t => t.x)) + pad;
  const yLo = Math.max(0, Math.min(...TH.map(t => t.y)) - pad), yHi = Math.min(1, Math.max(...TH.map(t => t.y)) + pad);

  const box = { x: 19, y: top + 8, w: W - 24, h: H - top - 8 - footH };
  const X = linear(xLo, xHi, box.x, box.x + box.w);
  const Y = linear(yLo, yHi, box.y + box.h, box.y);

  /* 轴刻度 */
  const Xt = niceTicks(xLo, xHi, 5), Yt = niceTicks(yLo, yHi, 5);
  const tk = el('g', { stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of Xt.ticks) {
    el('line', { x1: X(t), x2: X(t) + 1.2, y1: box.y + box.h, y2: box.y + box.h }, tk);
    text(svg, X(t), box.y + box.h + 3.2, fmt(+t.toFixed(2)), { size: 2.4, anchor: 'middle', fill: INK.soft });
  }
  for (const t of Yt.ticks) {
    el('line', { x1: box.x, x2: box.x + 1.2, y1: Y(t), y2: Y(t) }, tk);
    text(svg, box.x - 1.7, Y(t) + .85, fmt(+t.toFixed(2)), { size: 2.4, anchor: 'end', fill: INK.soft });
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);
  if (data.x?.label) text(svg, box.x + box.w / 2, box.y + box.h + 7, data.x.label, { size: 2.8, anchor: 'middle', fill: INK.base });
  if (data.y?.label) {
    const t = text(svg, 0, 0, data.y.label, { size: 2.8, anchor: 'middle' });
    t.setAttribute('transform', `translate(${box.x - 8.5} ${box.y + box.h / 2}) rotate(-90)`);
  }

  /* 象限分隔（原点虚线）+ 象限名 */
  if (o.quadrants !== false) {
    const xm = X(Math.max(xLo, Math.min(xHi, 0))), ym = Y(Math.max(yLo, Math.min(yHi, 0)));
    el('line', { x1: xm, x2: xm, y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .3, 'stroke-dasharray': '1.2 1' }, svg);
    el('line', { x1: box.x, x2: box.x + box.w, y1: ym, y2: ym, stroke: INK.hair, 'stroke-width': .3, 'stroke-dasharray': '1.2 1' }, svg);
    const qs = [
      [box.x + 2.5, box.y + 3.2, 'start', '驱动主题'],
      [box.x + box.w - 2.5, box.y + 3.2, 'end', '孤立主题'],
      [box.x + 2.5, box.y + box.h - 2, 'start', '新兴 / 衰退'],
      [box.x + box.w - 2.5, box.y + box.h - 2, 'end', '基础主题']
    ];
    // 左右按向心性：右 = 高向心 → 驱动/基础；上 = 高密度
    qs[1][4] = '孤立主题'; qs[3][4] = '基础主题';
    qs.forEach(([x, y, a, s]) => text(svg, x, y, s, { size: 2.3, anchor: a, fill: INK.soft, mono: true }));
  }

  /* 气泡（r ∝ √size）+ 标签（贪心防碰撞：右→左→上→下，避开其它气泡与已放标签） */
  const g = el('g', {}, svg);
  const placed = [];                               // 已占区域 [x0,y0,x1,y1]（含气泡）
  const hit = (r) => placed.some(p => !(r[2] < p[0] || r[0] > p[2] || r[3] < p[1] || r[1] > p[3]));
  const geo = TH.map(t => {
    const r = 1.7 + Math.sqrt(t.size || 1) * .45;
    const cx = X(t.x), cy = Y(t.y);
    placed.push([cx - r - .8, cy - r - .8, cx + r + .8, cy + r + .8]);
    return { t, r, cx, cy };
  });
  geo.forEach(({ t, r, cx, cy }) => {
    const color = cs[(t.group ?? 0) % cs.length];
    const c = el('circle', { cx, cy, r, fill: color, 'fill-opacity': .82, stroke: '#fff', 'stroke-width': .45, cursor: 'pointer' }, g);
    const lw = t.name.length * 2.4 + 1, lh = 2.8;
    const cands = [
      { x: cx + r + 1.4, y: cy + .95, a: 'start' },   // 右
      { x: cx - r - 1.4, y: cy + .95, a: 'end' },     // 左
      { x: cx, y: cy - r - 2.2, a: 'middle' },        // 上
      { x: cx, y: cy + r + 3.6, a: 'middle' }         // 下
    ];
    let chosen = cands[0];
    for (const cd of cands) {
      const rect = [cd.a === 'start' ? cd.x : cd.a === 'end' ? cd.x - lw : cd.x - lw / 2, cd.y - lh,
                    cd.a === 'start' ? cd.x + lw : cd.a === 'end' ? cd.x : cd.x + lw / 2, cd.y];
      if (rect[0] >= box.x && rect[2] <= box.x + box.w && rect[1] >= box.y && rect[3] <= box.y + box.h && !hit(rect)) { chosen = cd; placed.push(rect); break; }
    }
    text(g, chosen.x, chosen.y, t.name, {
      size: 2.4, anchor: chosen.a, fill: INK.base,
      extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .6 }
    });
    const msg = `<b>${t.name}</b><br>向心性 ${fmt(+t.x.toFixed(2))} · 密度 ${fmt(+t.y.toFixed(2))}<br>规模 ${fmt(t.size)} 篇`;
    c.addEventListener('pointerenter', ev => tip(msg, ev));
    c.addEventListener('pointermove', ev => tip(msg, ev));
    c.addEventListener('pointerleave', tipHide);
  });

  figureNote(svg, o);
  return svg;
}
