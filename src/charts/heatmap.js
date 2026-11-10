/* ============ 矩阵热力图（共现矩阵 · 序列色 · 色标） ============ */

import { el, text, INK, SEQUENTIAL } from '../core/svg.js?v=20261111c';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261111c';
import { tip, tipHide } from '../core/tip.js?v=20261111c';

/*
 * data = {
 *   rows: ['庄子','墨子',...], cols: [...],
 *   values: [[..],[..],...],          // 行 x 列
 *   label: '共现频次'
 * }
 * o = { seq:'sage'|'blue'|'clay', showValues, diagEmphasize }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const seq = SEQUENTIAL[o.seq || 'sage'];

  const R = data.rows, C = data.cols, V = data.values;
  const labW = 20;                        // 左侧标签区
  const topH = 15;                         // 顶部标签区（斜排）
  const footH = o.note || o.figLabel ? 26 : 16;
  const cbSpace = 11;                      // 右侧色标区（刻度 + 轴题）
  const plotW = Math.min(W - labW - cbSpace - 8, 120), plotH = Math.min(H - top - topH - footH, 120);
  const ox = labW + (W - labW - cbSpace - 8 - plotW) / 2, oy = top + topH;

  const cw = plotW / C.length, ch = plotH / R.length;

  const vmax = o.vmax ?? Math.max(...V.flat());
  const vmin = o.vmin ?? 0;
  const color = v => {
    const t = Math.min(1, Math.max(0, (v - vmin) / (vmax - vmin || 1)));
    return seq[Math.min(seq.length - 1, Math.floor(t * seq.length))];
  };

  /* 单元格 */
  R.forEach((r, i) => {
    C.forEach((c, j) => {
      const v = V[i][j];
      const rect = el('rect', {
        x: ox + j * cw, y: oy + i * ch, width: cw + .12, height: ch + .12,
        fill: color(v), stroke: '#fff', 'stroke-width': .5
      }, svg);
      if (o.showValues && cw > 7 && ch > 5) {
        const t = (v - vmin) / (vmax - vmin || 1);
        text(svg, ox + j * cw + cw / 2, oy + i * ch + ch / 2 + .95, fmt(v), {
          size: 2.1, anchor: 'middle',
          fill: t > .5 ? '#FFFFFF' : INK.base,
          extra: { 'paint-order': 'stroke', stroke: t > .5 ? 'none' : '#FFFFFF', 'stroke-width': .5 }
        });
      }
      rect.addEventListener('pointerenter', ev => {
        rect.setAttribute('stroke', INK.base); rect.setAttribute('stroke-width', .7);
        tip(`<b>${r} × ${c}</b>　${fmt(v)}`, ev);
      });
      rect.addEventListener('pointermove', ev => tip(`<b>${r} × ${c}</b>　${fmt(v)}`, ev));
      rect.addEventListener('pointerleave', () => { rect.setAttribute('stroke', '#fff'); rect.setAttribute('stroke-width', .5); tipHide(); });
    });
  });

  /* 行标签（右侧，对齐格子） */
  R.forEach((r, i) => text(svg, ox + plotW + 1.6, oy + i * ch + ch / 2 + .9, r, { size: 2.5, fill: INK.base }));

  /* 列标签（顶部斜排 45°） */
  C.forEach((c, j) => {
    const t = text(svg, 0, 0, c, { size: 2.5, anchor: 'end', fill: INK.base });
    t.setAttribute('transform', `translate(${ox + j * cw + cw / 2 + 1} ${oy - 1.2}) rotate(-45)`);
  });

  /* 色标（右侧竖条：刻度在外，轴题再外，互不压盖） */
  const cbW = 2.6, cbH = plotH * .6, cbx = W - 4.5, cby = oy + 4;
  const cbG = el('g', {}, svg);
  const n = seq.length;
  seq.forEach((col, k) => {
    const v1 = vmin + (vmax - vmin) * (1 - (k + 1) / n);
    el('rect', { x: cbx, y: cby + k * (cbH / n), width: cbW, height: cbH / n + .05, fill: col }, cbG);
    if (k === 0 || k === Math.floor(n / 2) || k === n - 1)
      text(svg, cbx - 1.5, cby + k * (cbH / n) + 1, fmt(Math.round(v1)), { size: 2, anchor: 'end', fill: INK.soft });
  });
  el('rect', { x: cbx, y: cby, width: cbW, height: cbH, fill: 'none', stroke: INK.axis, 'stroke-width': .25 }, cbG);
  if (data.label) {
    const t = text(svg, 0, 0, data.label, { size: 2.2, anchor: 'middle', fill: INK.soft });
    t.setAttribute('transform', `translate(${cbx - 7} ${cby + cbH / 2}) rotate(-90)`);
  }

  figureNote(svg, o);
  return svg;
}
