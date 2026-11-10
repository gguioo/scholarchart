/* ============ 和弦图（缎带共现 · 确定性圆形布局 · 零随机） ============ */
/* 外环节点弧按学派着色，内部缎带 = 两概念共现（宽窄与深浅 ∝ 权重）
 * 无力导向、无随机 —— 每次渲染布局完全一致 */

import { el, text, INK, colors } from '../core/svg.js?v=20261111e';
import { caption, figureNote, legend } from '../core/axis.js?v=20261111e';
import { tip, tipHide } from '../core/tip.js?v=20261111e';

/*
 * data = {
 *   nodes: [ { id:'庄子', group:0 } ],
 *   edges: [ { a:'庄子', b:'道', w: 9 } ],
 *   groups: ['道家','儒家','墨家','法家']       // 组名（可选，图例/悬浮用）
 * }
 */
function circDist(a, b) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const footH = o.note || o.figLabel ? 26 : 15;
  const cs = colors();
  const gnames = data.groups || [];

  /* 排序：学派成块，块内按关联强度降序 → 缎带少交叉 */
  const deg = {}, str = {};
  data.edges.forEach(e => {
    deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1;
    str[e.a] = (str[e.a] || 0) + (e.w || 1); str[e.b] = (str[e.b] || 0) + (e.w || 1);
  });
  const order = [...data.nodes].sort((a, b) =>
    (a.group ?? 0) - (b.group ?? 0) || (str[b.id] || 0) - (str[a.id] || 0));
  const n = order.length;
  const byId = Object.fromEntries(order.map(nd => [nd.id, nd]));
  const E = data.edges.map(e => ({ ...e, A: byId[e.a], B: byId[e.b] })).filter(e => e.A && e.B);
  const m = E.length;
  const maxW = Math.max(...E.map(e => e.w || 1), 1);
  const S = order.reduce((a, nd) => a + (str[nd.id] || 0), 0) || 1;

  /* 角度分配：节点弧 ∝ 强度，组间留大缝、节点间留发丝缝 */
  const PAD = .008, GPAD = .028;
  const gbounds = [];
  for (let i = 0; i < n; i++) {
    const g = order[i].group ?? 0;
    if (!gbounds.length || gbounds[gbounds.length - 1].g !== g) gbounds.push({ g, i0: i, i1: i });
    else gbounds[gbounds.length - 1].i1 = i;
  }
  const padTotal = PAD * (n - gbounds.length) + GPAD * gbounds.length;
  const avail = Math.PI * 2 - padTotal;
  const arcs = [];
  let t = 0;
  order.forEach((nd, i) => {
    const a0 = t + (i === 0 ? 0 : (arcs[arcs.length - 1].g !== (nd.group ?? 0) ? GPAD : PAD));
    const a = avail * ((str[nd.id] || 1) / S);
    arcs.push({ node: nd, a0, a1: a0 + a, g: nd.group ?? 0 });
    t = a0 + a;
  });

  /* 画布几何 */
  const plot = { x0: 12, x1: W - 12, y0: top + 9, y1: H - footH - 10 };
  const cx = (plot.x0 + W - 40) / 2 + 8, cy = (plot.y0 + plot.y1) / 2;
  const R = Math.min(plot.x1 - plot.x0 - 10, plot.y1 - plot.y0) * .5 - 4.5;
  const P = (ang, r) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];

  /* 缎带：每条边两端各占本节点弧内一段（按对方节点序分配，避免交叉） */
  const gR = el('g', { 'fill-rule': 'evenodd' }, svg), gL = el('g', {}, svg), gT = el('g', {}, svg);
  const alloc = {};   // alloc[node] = 累计偏移
  const ribbons = [];
  for (const e of E) {
    const sa = arcs[order.indexOf(e.A)], sb = arcs[order.indexOf(e.B)];
    if (!sa || !sb) continue;
    const ai = Math.max(sa.a1 - sa.a0, .001) * ((e.w || 1) / (str[e.A.id] || 1));
    const bi = Math.max(sb.a1 - sb.a0, .001) * ((e.w || 1) / (str[e.B.id] || 1));
    alloc[e.A.id] = alloc[e.A.id] || 0;
    alloc[e.B.id] = alloc[e.B.id] || 0;
    const a0 = sa.a0 + alloc[e.A.id], a1 = a0 + ai;
    const b0 = sb.a0 + alloc[e.B.id], b1 = b0 + bi;
    alloc[e.A.id] += ai; alloc[e.B.id] += bi;
    const largeA = a1 - a0 > Math.PI ? 1 : 0, largeB = b1 - b0 > Math.PI ? 1 : 0;
    const [x0, y0] = P(a0, R), [x1, y1] = P(a1, R), [x2, y2] = P(b1, R), [x3, y3] = P(b0, R);
    const d = `M${x0} ${y0}A${R} ${R} 0 ${largeA} 1 ${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}A${R} ${R} 0 ${largeB} 0 ${x3} ${y3}Q${cx} ${cy} ${x0} ${y0}Z`;
    const gc = cs[(e.A.group ?? 0) % cs.length];
    const rib = el('path', {
      d, fill: gc, 'fill-opacity': .1 + .5 * (e.w || 1) / maxW,
      stroke: gc, 'stroke-opacity': .45, 'stroke-width': .18
    }, gR);
    rib.style.cursor = 'pointer';
    rib.addEventListener('pointerenter', ev => {
      tip(svg, ev, `${e.a} ↔ ${e.b} · 共现 ${e.w || 1} 次`);
      ribbons.forEach(r => { if (r.rib !== rib) r.rib.setAttribute('fill-opacity', .03); });
      rib.setAttribute('fill-opacity', .9);
    });
    rib.addEventListener('pointerleave', () => {
      ribbons.forEach(r => r.rib.setAttribute('fill-opacity', .1 + .5 * (r.e.w || 1) / maxW));
      tipHide(svg);
    });
    ribbons.push({ rib, e });
  }

  /* 标签三环（错位防叠） */
  const rings = [R + 3.4, R + 6.6, R + 9.8];
  const lastAng = [-9, -9, -9];

  /* 外环节点弧（学派色）+ 悬浮聚焦（视觉楔形不挡鼠标，命中区是外圈窄环带） */
  for (const a of arcs) {
    const [x0, y0] = P(a.a0, R), [x1, y1] = P(a.a1, R);
    const large = a.a1 - a.a0 > Math.PI ? 1 : 0;
    el('path', {
      d: `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${cx} ${cy}Z`,
      fill: cs[a.g % cs.length], 'fill-opacity': .16, 'pointer-events': 'none'
    }, gR);
    el('path', { d: `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}`, fill: 'none', stroke: cs[a.g % cs.length], 'stroke-width': .5, 'pointer-events': 'none' }, gT);
    const ri = R - 1.6;
    const [u0, v0] = P(a.a0, ri), [u1, v1] = P(a.a1, ri);
    const seg = el('path', {
      d: `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${u1} ${v1}A${ri} ${ri} 0 ${large} 0 ${u0} ${v0}Z`,
      fill: 'transparent'
    }, gT);
    seg.style.cursor = 'pointer';
    seg.addEventListener('pointerenter', ev => {
      tip(svg, ev, `${a.node.id} · ${gnames[a.g] || '组 ' + (a.g + 1)} · ${deg[a.node.id] || 0} 条关联`);
      ribbons.forEach(r => {
        const hit = r.e.a === a.node.id || r.e.b === a.node.id;
        r.rib.setAttribute('fill-opacity', hit ? .85 : .03);
      });
    });
    seg.addEventListener('pointerleave', () => {
      ribbons.forEach(r => r.rib.setAttribute('fill-opacity', .1 + .5 * (r.e.w || 1) / maxW));
      tipHide(svg);
    });
    /* 概念标签：水平文字 + 三环错位（角度不够就外移一环，贪心防叠） */
    const mid = (a.a0 + a.a1) / 2;
    const wl = a.node.id.length * 2.2 + .8;
    let ring = rings.length - 1;
    for (let k = 0; k < rings.length; k++) {
      const gap = circDist(mid, lastAng[k]);
      if (gap > (wl + 2.4) / rings[k] + .012) { ring = k; break; }
    }
    lastAng[ring] = mid;
    const [lx, ly] = P(mid, rings[ring]);
    const c = Math.cos(mid), si = Math.sin(mid);
    const anchor = Math.abs(c) < .2 ? 'middle' : (c > 0 ? 'start' : 'end');
    const dy = si > 0 ? 1.4 : -.6;
    text(gL, lx, ly + dy, a.node.id, { size: 2.2, fill: INK.base, anchor });
  }

  /* 图例（学派色 + 概念数） */
  if (gnames.length) {
    const items = [...new Set(order.map(nd => nd.group ?? 0))].sort((a, b) => a - b)
      .map(g => ({ label: `${gnames[g]} · ${order.filter(nd => (nd.group ?? 0) === g).length}`, color: cs[g % cs.length] }));
    legend(svg, items, { y: top + 6 });
  }

  /* 底部统计行 */
  const density = n > 1 ? (2 * m / (n * (n - 1))) : 0;
  text(svg, 12, H - footH - 3.5, `${n} 个概念 · ${m} 条关联 · 网络密度 ${density.toFixed(2)} · 平均度 ${(2 * m / n).toFixed(1)} · 缎带深浅宽窄 = 共现强度`, { size: 2.2, fill: INK.soft });

  figureNote(svg, o);
  return { svg };
}
