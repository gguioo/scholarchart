/* ============ 估计图（Gardner-Altman：效应量 + bootstrap CI） ============ */
/* estimation statistics 运动：不报 p 值，直接画效应大小与不确定性 */

import { el, text, INK, colors } from '../core/svg.js?v=20261114f';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114f';
import { niceTicks, linear, kde, mulberry32 } from '../core/scale.js?v=20261114f';
import { tip, tipHide } from '../core/tip.js?v=20261114f';

/*
 * data = {
 *   groups: [ { name:'传统教法', values:[..] }, { name:'沉浸式教法', values:[..] } ],  // 恰好两组
 *   y: { label:'结业测验成绩 / 分' }
 * }
 * o = { B:3000 }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const [A, B] = data.groups;
  const cs = colors();
  const footH = 32;

  const B_ = o.B ?? 3000;
  const mA = A.values.reduce((a, b) => a + b, 0) / A.values.length;
  const mB = B.values.reduce((a, b) => a + b, 0) / B.values.length;
  const delta = mB - mA;

  /* bootstrap（确定性种子，导出可复现） */
  const rnd = mulberry32(20261110);
  const boots = [];
  for (let b = 0; b < B_; b++) {
    let sa = 0, sb = 0;
    for (let i = 0; i < A.values.length; i++) sa += A.values[(rnd() * A.values.length) | 0];
    for (let i = 0; i < B.values.length; i++) sb += B.values[(rnd() * B.values.length) | 0];
    boots.push(sb / B.values.length - sa / A.values.length);
  }
  boots.sort((a, b) => a - b);
  const ci = [boots[Math.floor(B_ * .025)], boots[Math.floor(B_ * .975)]];

  /* 布局：原始数据与差值轴同属一个区块（差值轴紧邻 B 组云，共享 y 轴），
     整个区块在幅面内水平居中，内部相对间距保持不变 */
  const all = A.values.concat(B.values);
  const Y = niceTicks(Math.min(0, ...all, ci[0]), Math.max(...all, ci[1]) + .001, 5);
  const footY = H - footH;
  const plotH = footY - top - 14;
  const val = linear(Y.lo, Y.hi, footY - 2, top + 14);
  const halfW = Math.min(10.5, W * .12);           // 每组点云半宽
  const ax0 = 38, bx0 = ax0 + 26;                  // 两组中心（相对间距固定）
  const dax0 = bx0 + halfW + 12;                   // 差值轴紧邻 B 组云
  const leftEdge = 6, rightEdge = dax0 + 9;        // 区块左右缘（含刻度标签）
  const dx = (W - (rightEdge - leftEdge)) / 2 - leftEdge;
  const ax = ax0 + dx, bx = bx0 + dx, dax = dax0 + dx;

  /* Y 轴刻度（区块左缘，随区块整体平移） */
  for (const t of Y.ticks) {
    el('line', { x1: 14 + dx, x2: 15.2 + dx, y1: val(t), y2: val(t), stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, 13 + dx, val(t) + .9, fmt(t), { size: 2.4, anchor: 'end', fill: INK.soft });
    el('line', { x1: 15.2 + dx, x2: bx + halfW + 3, y1: val(t), y2: val(t), stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  if (data.y?.label) {
    const t = text(svg, 0, 0, data.y.label, { size: 2.8, anchor: 'middle', fill: INK.base });
    t.setAttribute('transform', `translate(${6 + dx} ${top + 14 + plotH / 2}) rotate(-90)`);
  }

  /* 两组：抖动散点 + 均值须（无跨云连线，Gardner-Altman 期刊版） */
  const drawGroup = (g, gx, color, ii) => {
    g.values.forEach((v, i) => {
      const jit = ((i * 2654435761) % 997) / 997 - .5;
      const p = el('circle', { cx: (gx + jit * halfW).toFixed(2), cy: val(v).toFixed(2), r: .62, fill: color, 'fill-opacity': .55, cursor: 'pointer' }, svg);
      p.addEventListener('pointerenter', ev => tip(`<b>${g.name}</b><br>观测 ${ii ? 'B' : 'A'}${i + 1}：${fmt(v)}`, ev));
      p.addEventListener('pointermove', ev => tip(`<b>${g.name}</b><br>观测 ${ii ? 'B' : 'A'}${i + 1}：${fmt(v)}`, ev));
      p.addEventListener('pointerleave', tipHide);
    });
    const m = ii ? mB : mA;
    el('line', { x1: gx - halfW * .78, x2: gx + halfW * .78, y1: val(m), y2: val(m), stroke: color, 'stroke-width': .9 }, svg);
    text(svg, gx, footY + 3.4, g.name, { size: 2.5, anchor: 'middle', fill: INK.base });
    return m;
  };
  drawGroup(A, ax, cs[0], 0);
  drawGroup(B, bx, cs[3], 1);

  /* 右面板：差值轴 + bootstrap 分布云 + CI 括号 */
  const x0 = dax - 6, x1 = dax + 6;
  el('line', { x1: dax, x2: dax, y1: val(Y.hi), y2: val(Y.lo) + 1, stroke: INK.axis, 'stroke-width': .3 }, svg);
  for (const t of Y.ticks) {
    el('line', { x1: dax - 1.2, x2: dax, y1: val(t), y2: val(t), stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, dax + 2.4, val(t) + .9, fmt(t), { size: 2.2, anchor: 'start', fill: INK.soft });
  }
  const grid = Array.from({ length: 64 }, (_, i) => Y.lo + (Y.hi - Y.lo) * i / 63);
  const dens = kde(boots, grid);
  const dMax = Math.max(...dens, 1e-9);
  const inBand = grid.map((t, i) => ci[0] <= t && t <= ci[1] ? dens[i] : 0);
  const cloud = (arr, fill, op) => {
    const up = arr.map((d, i) => [dax - d / dMax * 5.5, val(grid[i])]);
    const dn = arr.map((d, i) => [dax + d / dMax * 5.5, val(grid[i])]).reverse();
    const d = 'M' + up.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L')
      + 'L' + dn.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z';
    el('path', { d, fill, 'fill-opacity': op }, svg);
  };
  cloud(dens, cs[2], .18);
  cloud(inBand, cs[2], .42);

  /* 差值点 + CI 括号 */
  const dy = val(delta);
  el('line', { x1: x0 + 3.2, x2: x1 - 1, y1: dy, y2: dy, stroke: INK.base, 'stroke-width': .5 }, svg);
  const cdp = el('circle', { cx: dax, cy: dy, r: 1.25, fill: INK.base, cursor: 'pointer' }, svg);
  const br = el('path', { d: `M${x0 + 1.4} ${val(ci[0])}H${x0 + 2.6}M${x0 + 2.6} ${val(ci[0])}V${val(ci[1])}M${x0 + 2.6} ${val(ci[1])}H${x0 + 1.4}`, fill: 'none', stroke: INK.base, 'stroke-width': .4, cursor: 'pointer' }, svg);
  const dMsg = `<b>差值（B − A）</b><br>${fmt(+delta.toFixed(2))} · 95% CI [${fmt(+ci[0].toFixed(2))}, ${fmt(+ci[1].toFixed(2))}]<br>bootstrap B = ${B_}（百分位法）<br>CI 含 0 → 尚不能下方向结论`;
  [cdp, br].forEach(n => {
    n.addEventListener('pointerenter', ev => tip(dMsg, ev));
    n.addEventListener('pointermove', ev => tip(dMsg, ev));
    n.addEventListener('pointerleave', tipHide);
  });
  text(svg, dax, footY + 3.4, '差值（B − A）', { size: 2.5, anchor: 'middle', fill: INK.base });

  /* 底部效应摘要 */
  text(svg, 16 + dx, H - 20.5, `效应量：Δ = ${delta >= 0 ? '+' : ''}${fmt(+delta.toFixed(2))} 分，95% CI [${fmt(+ci[0].toFixed(2))}, ${fmt(+ci[1].toFixed(2))}]（n = ${A.values.length}/${B.values.length}，B = ${B_}）`, { size: 2.3, fill: INK.soft });

  figureNote(svg, o);
  return svg;
}
