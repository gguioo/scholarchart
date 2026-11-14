/* ============ 共现网络图（Co-occurrence Network，VOSviewer 式） ============ */

import { el, text, INK, colors } from '../core/svg.js?v=20261114f';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114f';
import { tip, tipHide } from '../core/tip.js?v=20261114f';

/*
 * data = {
 *   nodes: [ { name:'数字人文', weight:210 }, ... ],
 *   edges: [ [0, 1, 12], ... ]            // [源索引, 目标索引, 共现强度]
 *                                          // 也兼容 { source, target, strength } 对象
 * }
 * o = {
 *   labels: 30,          // 只给权重最大的 N 个节点标标签（0 = 全不标）
 *   edgeOpacity: .1,     // 边透明度（0 = 隐藏；节点多时建议 .06–.15）
 *   iterations: 260      // 力模拟迭代数
 * }
 *
 * 布局：Fruchterman–Reingold 力模拟（网格加速斥力）；
 * 着色：标签传播算法自动划分社区，社区数多于色板时向最连通邻社区合并；
 * 半径：面积 ∝ 权重（sqrt 标度）；标签：按权重降序取前 N，贪心避让。
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const footH = figureNote(svg, o);           // 先探图注占位，再算绘图区
  const cs = colors();

  const nodes = (data.nodes || []).map(n => ({ name: n.name, w: +n.weight || 1 }));
  const E = (data.edges || []).map(e => Array.isArray(e) ? e : [e.source, e.target, e.strength ?? 1]);
  if (!nodes.length) return;

  /* ---- 邻接表 ---- */
  const adj = nodes.map(() => []);
  E.forEach(([s, t, w]) => {
    if (s === t || s < 0 || t < 0 || s >= nodes.length || t >= nodes.length) return;
    const ww = +w || 1;
    adj[s].push([t, ww]); adj[t].push([s, ww]);
  });

  /* ---- 社区检测：标签传播 ---- */
  const lab = nodes.map((_, i) => i);
  const K = 24;                                // 传播轮数
  for (let it = 0; it < K; it++) {
    let changed = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (!adj[i].length) continue;
      const cnt = new Map();
      for (const [j, w] of adj[i]) cnt.set(lab[j], (cnt.get(lab[j]) || 0) + w);
      let best = lab[i], bv = -1;
      for (const [l, v] of cnt) if (v > bv || (v === bv && l < best)) { best = l; bv = v; }
      if (best !== lab[i]) { lab[i] = best; changed++; }
    }
    if (!changed) break;
  }
  /* 归一化标签 + 限制社区数 ≤ 色板长度：最小社区并入最连通邻社区 */
  const renumber = () => {
    const m = new Map(); nodes.forEach((_, i) => { if (!m.has(lab[i])) m.set(lab[i], m.size); lab[i] = m.get(lab[i]); });
    return m.size;
  };
  let nC = renumber();
  const MAXC = cs.length;
  while (nC > MAXC) {
    const size = Array(nC).fill(0), link = Array.from({ length: nC }, () => new Map());
    nodes.forEach((_, i) => size[lab[i]]++);
    for (let i = 0; i < nodes.length; i++) for (const [j] of adj[i]) {
      const a = lab[i], b = lab[j];
      if (a !== b) link[a].set(b, (link[a].get(b) || 0) + 1);
    }
    let s = -1;
    for (let c = 0; c < nC; c++) if (s < 0 || size[c] < size[s]) s = c;
    let t = -1, tv = -1;
    for (const [c, v] of link[s]) if (v > tv) { t = c; tv = v; }
    if (t < 0) t = (s + 1) % nC;
    nodes.forEach((_, i) => { if (lab[i] === s) lab[i] = t; });
    nC = renumber();
  }
  const cOrder = [...new Set(lab)].sort((a, b) =>
    nodes.filter((_, i) => lab[i] === b).length - nodes.filter((_, i) => lab[i] === a).length);
  const colOf = c => cs[cOrder.indexOf(c) % cs.length];

  /* ---- 力模拟布局（虚拟坐标，mm） ---- */
  const n = nodes.length;
  const cx0 = W / 2, cy0 = (top + H - footH) / 2;
  const R0 = Math.min(W, H - top - footH) * .3;
  const px = new Float64Array(n), py = new Float64Array(n);
  const cAngle = new Map(); cOrder.forEach((c, i) => cAngle.set(c, i * 2 * Math.PI / cOrder.length - Math.PI / 2));
  nodes.forEach((nd, i) => {
    const a = cAngle.get(lab[i]) + (Math.random() - .5) * 1.6;
    const r = R0 * (.4 + .6 * Math.random());
    px[i] = cx0 + r * Math.cos(a); py[i] = cy0 + r * Math.sin(a);
  });

  const L = Math.max(2.2, Math.sqrt((W * (H - top - footH)) / n) * .85);   // 理想边长
  const cutoff = L * 2.6, cell = cutoff;
  const iters = o.iterations ?? 260;
  for (let it = 0; it < iters; it++) {
    const temp = 2.2 * Math.pow(1 - it / iters, 1.5) + .08;
    const fx = new Float64Array(n), fy = new Float64Array(n);

    /* 斥力：均匀网格，只查 3×3 邻域 */
    const gx = new Map();
    for (let i = 0; i < n; i++) {
      const k = ((px[i] / cell) | 0) + ',' + ((py[i] / cell) | 0);
      (gx.get(k) || gx.set(k, []).get(k)).push(i);
    }
    for (let i = 0; i < n; i++) {
      const cxi = (px[i] / cell) | 0, cyi = (py[i] / cell) | 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const bucket = gx.get((cxi + a) + ',' + (cyi + b));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          let dx = px[i] - px[j], dy = py[i] - py[j];
          let d2 = dx * dx + dy * dy;
          if (d2 < 1e-6) { dx = (Math.random() - .5); dy = (Math.random() - .5); d2 = dx * dx + dy * dy; }
          const d = Math.sqrt(d2);
          if (d > cutoff) continue;
          const f = (L * L) / d;
          const ux = dx / d, uy = dy / d;
          fx[i] += ux * f; fy[i] += uy * f;
          fx[j] -= ux * f; fy[j] -= uy * f;
        }
      }
    }

    /* 引力：边弹簧 + 向心 */
    for (const [s, t] of E) {
      if (s < 0 || t < 0 || s >= n || t >= n || s === t) continue;
      const dx = px[t] - px[s], dy = py[t] - py[s];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const f = (d - L) * .08;
      const ux = dx / d, uy = dy / d;
      fx[s] += ux * f * d * .1; fy[s] += uy * f * d * .1;
      fx[t] -= ux * f * d * .1; fy[t] -= uy * f * d * .1;
    }
    for (let i = 0; i < n; i++) {
      fx[i] += (cx0 - px[i]) * .012; fy[i] += (cy0 - py[i]) * .012;
      const d = Math.hypot(fx[i], fy[i]) || 1e-6;
      const mv = Math.min(d, temp);
      px[i] += fx[i] / d * mv; py[i] += fy[i] / d * mv;
    }
  }

  /* ---- 归一化到绘图区 ---- */
  const bx = 6, by = top + 4, bw = W - 12, bh = H - top - footH - 8;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]);
    y0 = Math.min(y0, py[i]); y1 = Math.max(y1, py[i]);
  }
  const sc = Math.min(bw / (x1 - x0 || 1), bh / (y1 - y0 || 1)) * .96;
  const ox = bx + (bw - (x1 - x0) * sc) / 2, oy = by + (bh - (y1 - y0) * sc) / 2;
  for (let i = 0; i < n; i++) {
    px[i] = ox + (px[i] - x0) * sc;
    py[i] = oy + (py[i] - y0) * sc;
  }

  /* ---- 半径：面积 ∝ 权重 ---- */
  const wmax = Math.max(...nodes.map(nd => nd.w));
  const rMax = n > 400 ? 3.6 : n > 150 ? 4.4 : 5.2;
  const rOf = w => .45 + (rMax - .45) * Math.sqrt(w / wmax);

  /* ---- 边（淡线保留结构感，透明度可用 opts.edgeOpacity 调） ---- */
  const eOp = o.edgeOpacity ?? .1;
  const gE = el('g', {}, svg);
  for (const [s, t, w] of E) {
    if (s < 0 || t < 0 || s >= n || t >= n || s === t) continue;
    const sw = Math.min(.5, .08 + .3 * ((+w || 1) / (E.length ? Math.max(...E.map(e => +e[2] || 1)) : 1)));
    el('line', {
      x1: px[s], y1: py[s], x2: px[t], y2: py[t],
      stroke: INK.base, 'stroke-width': sw, 'stroke-opacity': eOp, 'stroke-linecap': 'round'
    }, gE);
  }

  /* ---- 节点（无描边，半透明叠色） ---- */
  const gN = el('g', {}, svg);
  nodes.forEach((nd, i) => {
    const c = el('circle', {
      cx: px[i], cy: py[i], r: rOf(nd.w),
      fill: colOf(lab[i]), fillOpacity: .82, cursor: 'pointer'
    }, gN);
    const deg = adj[i].reduce((a, x) => a + x[1], 0);
    const msg = `<b>${nd.name}</b><br>权重：${fmt(nd.w)}<br>共现强度合计：${fmt(deg)}<br>社区：${cOrder.indexOf(lab[i]) + 1}`;
    c.addEventListener('pointerenter', ev => tip(msg, ev));
    c.addEventListener('pointermove', ev => tip(msg, ev));
    c.addEventListener('pointerleave', tipHide);
  });

  /* ---- 标签：只标权重前 N，贪心避让 ---- */
  const nLab = o.labels ?? 30;
  if (nLab > 0) {
    const order = nodes.map((nd, i) => i).sort((a, b) => nodes[b].w - nodes[a].w).slice(0, nLab);
    const placed = [];
    const gT = el('g', {}, svg);
    for (const i of order) {
      const r = rOf(nodes[i].w);
      const size = 2 + 1.1 * (nodes[i].w / wmax);
      /* 中文全角字符宽 ≈ 字号；拉丁字符按 0.55 估算 */
      const wTxt = [...nodes[i].name].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? size : size * .55), 0);
      const box = { x: px[i] - wTxt / 2, y: py[i] - size * .75, w: wTxt, h: size * 1.3 };
      if (placed.some(p => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y)) continue;
      placed.push(box);
      text(gT, px[i], py[i] + size * .35, nodes[i].name, {
        size, anchor: 'middle',
        extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .55, 'stroke-opacity': .8, 'font-weight': 600 }
      });
    }
  }
}
