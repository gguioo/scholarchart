/* ============ 主题河流图（Theme River / Streamgraph） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261114d';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114d';
import { tip, tipHide } from '../core/tip.js?v=20261114d';

/*
 * data = {
 *   years: [1990, 1991, ...],
 *   series: [ { name:'敦煌文献整理', values:[12, 15, ...] }, ... ]  // 与 years 对齐
 * }
 * o = { legend: 'top' }   // 图例固定在绘图区上方独立一行，不压图
 *
 * 中心对称堆叠（silhouette 基线）+ Catmull-Rom 平滑；
 * 图例独立成行，避免遮挡河流本体。
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const cs = colors();

  const years = data.years || [];
  const S = (data.series || []).map(s => ({ name: s.name, values: s.values.map(v => +v || 0) }));
  if (!years.length || !S.length) return;
  const nY = years.length;

  const top = caption(svg, o);

  /* ---- 图例：绘图区上方独立一行（可换行），不与河流重叠 ---- */
  const footH = figureNote(svg, o);
  const boxX = 8, boxW = W - 16;
  const plotBottom = H - footH - 6;
  const sw = 1.8, gap = 2.2, itemPad = 4;
  let lx = boxX, ly = top + 3;
  const legendRows = [];
  let rowItems = [];
  for (let i = 0; i < S.length; i++) {
    const wItem = sw + 1.2 + S[i].name.length * 2.5 + itemPad;
    if (lx + wItem > boxX + boxW && rowItems.length) { legendRows.push({ y: ly, items: rowItems }); rowItems = []; lx = boxX; ly += 4.6; }
    rowItems.push({ i, x: lx, w: wItem });
    lx += wItem;
  }
  if (rowItems.length) legendRows.push({ y: ly, items: rowItems });
  const legendH = legendRows.length * 4.6 + 1.5;
  for (const row of legendRows) for (const it of row.items) {
    el('rect', { x: it.x, y: row.y, width: sw, height: sw, fill: cs[it.i % cs.length], 'fill-opacity': .9 }, svg);
    text(svg, it.x + sw + 1.2, row.y + sw - .25, S[it.i].name, { size: 2.4 });
  }

  /* ---- 绘图区 ---- */
  const box = { x: boxX, y: ly + legendH, w: boxW, h: plotBottom - ly - legendH - 4 };
  if (box.h < 10) box.h = 10;

  /* 堆叠（中心对称基线） */
  const totals = years.map((_, j) => S.reduce((a, s) => a + s.values[j], 0));
  const stack = S.map(() => new Float64Array(nY));
  const cum = new Float64Array(nY);
  for (let i = 0; i < S.length; i++) {
    for (let j = 0; j < nY; j++) { stack[i][j] = cum[j]; cum[j] += S[i].values[j]; }
  }
  const halfMax = Math.max(...cum) / 2;
  const yv = v => box.y + box.h * (1 - (v + halfMax) / (halfMax * 2 * 1.06));
  const xv = j => box.x + box.w * (nY === 1 ? .5 : j / (nY - 1));

  /* Catmull-Rom → 三次贝塞尔平滑路径 */
  const smoothPath = (vals, base) => {
    const pts = Array.from(vals, (v, j) => [xv(j), yv(v)]);
    const bpts = base ? Array.from(base, (v, j) => [xv(j), yv(v)]) : null;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let j = 0; j < nY - 1; j++) {
      const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(nY - 1, j + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    if (bpts) {
      for (let j = nY - 1; j > 0; j--) {
        const p0 = bpts[Math.min(nY - 1, j + 1)], p1 = bpts[j], p2 = bpts[j - 1], p3 = bpts[Math.max(0, j - 2)];
        const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += `L${p1[0]},${p1[1]}C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
      }
      d += `L${bpts[0][0]},${bpts[0][1]}`;
    }
    return d + 'Z';
  };

  /* ---- 河流层（中心对称：基线 = -总高/2） ---- */
  const gR = el('g', {}, svg);
  S.forEach((s, i) => {
    const topV = stack[i].map((v, j) => v + s.values[j] - totals[j] / 2);
    const base = stack[i].map((v, j) => v - totals[j] / 2);
    const p = el('path', {
      d: smoothPath(topV, base),
      fill: cs[i % cs.length], 'fill-opacity': .88, cursor: 'pointer'
    }, gR);
    const total = s.values.reduce((a, b) => a + b, 0);
    const peak = years[s.values.indexOf(Math.max(...s.values))];
    const msg = `<b>${s.name}</b><br>累计：${fmt(total)}<br>峰值年：${peak}（${fmt(Math.max(...s.values))}）`;
    p.addEventListener('pointerenter', ev => tip(msg, ev));
    p.addEventListener('pointermove', ev => tip(msg, ev));
    p.addEventListener('pointerleave', tipHide);
  });

  /* ---- 年份刻度（底部，独立于河流） ---- */
  const step = Math.max(1, Math.round(nY / 7));
  for (let j = 0; j < nY; j += step) {
    const x = xv(j);
    el('line', { x1: x, x2: x, y1: box.y + box.h, y2: box.y + box.h + 1.2, stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, x, box.y + box.h + 3.6, String(years[j]), { size: 2.5, anchor: 'middle', fill: INK.soft });
  }
}
