/* ============ 关联网络图（力导向 · 聚类环布局 · 弧形发丝边 · 可拖拽） ============ */
/* 边不用粗细编码：深浅 = 共现强度，弧度 = 关系远近；学派各自聚拢，互不挤压 */

import { el, text, INK, colors } from '../core/svg.js';
import { caption, figureNote, legend } from '../core/axis.js';
import { tip, tipHide } from '../core/tip.js';

/*
 * data = {
 *   nodes: [ { id:'庄子', group:0 } ],                    // size 可省（按度自动）
 *   edges: [ { a:'庄子', b:'道', w: 9 } ],
 *   groups: ['道家','儒家','墨家','法家']                 // 组名（图例用，可选）
 * }
 * o = { drag:true }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const footH = o.note || o.figLabel ? 26 : 15;
  const cs = colors();
  const gnames = data.groups || [];

  const plot = { x0: 12, x1: W - 12, y0: top + 9, y1: H - footH - 5 };
  const cx = (plot.x0 + plot.x1) / 2, cy = (plot.y0 + plot.y1) / 2;

  /* 度数（关联数）自动定节点大小 */
  const deg = {};
  data.edges.forEach(e => { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });

  /* 学派质心：圆环分布（1 组时居中） */
  const gset = [...new Set(data.nodes.map(n => n.group ?? 0))].sort((a, b) => a - b);
  const nG = gset.length;
  const R = Math.min(plot.x1 - plot.x0, plot.y1 - plot.y0) * (nG > 1 ? .3 : 0);
  const GC = {};
  gset.forEach((g, i) => {
    const th = (i / nG) * Math.PI * 2 - Math.PI / 2;
    GC[g] = { x: cx + R * Math.cos(th), y: cy + R * Math.sin(th) };
  });

  /* 节点：初始位置撒在自家质心附近（收敛快、分布稳） */
  const N = data.nodes.map(n => {
    const g = GC[n.group ?? 0] || { x: cx, y: cy };
    return {
      ...n,
      size: n.size ?? (2.3 + Math.min(3.6, (deg[n.id] || 1) * .55)),
      x: g.x + (Math.random() - .5) * 16,
      y: g.y + (Math.random() - .5) * 16,
      vx: 0, vy: 0, fixed: false, rx: 3
    };
  });
  const byId = Object.fromEntries(N.map(n => [n.id, n]));
  const E = data.edges.map((e, i) => ({ ...e, i, A: byId[e.a], B: byId[e.b] })).filter(e => e.A && e.B);
  const maxW = Math.max(...E.map(e => e.w || 1), 1);

  const gE = el('g', {}, svg), gN = el('g', {}, svg), gL = el('g', {}, svg);

  /* 弧形边：粗细恒定发丝，深浅 = 强度，弧度 = 关系远近（弱边弯得多） */
  E.forEach(e => {
    const t = (e.w || 1) / maxW;
    e.op = .13 + .5 * t;                                    // 透明度编码强度
    e.bow = .05 + .16 * (1 - t);                            // 弧度编码远近
    e.el = el('path', {
      fill: 'none', stroke: INK.axis, 'stroke-width': .32,
      'stroke-opacity': e.op, 'stroke-linecap': 'round', cursor: 'pointer'
    }, gE);
    const msg = `<b>${e.a} ↔ ${e.b}</b><br>共现强度 ${e.w || 1}（最强 ${maxW}）`;
    e.el.addEventListener('pointerenter', ev => tip(msg, ev));
    e.el.addEventListener('pointermove', ev => tip(msg, ev));
    e.el.addEventListener('pointerleave', tipHide);
  });

  /* 节点 + 标签（记录标签宽，参与防叠碰撞） */
  N.forEach(n => {
    n.el = el('circle', {
      r: n.size, fill: cs[n.group % cs.length], fillOpacity: .9,
      stroke: '#fff', 'stroke-width': .5, cursor: 'grab'
    }, gN);
    n.lbl = text(gL, 0, 0, n.id, {
      size: Math.max(2.2, n.size * .72), anchor: 'middle', fill: INK.base,
      extra: { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': .7, 'stroke-linejoin': 'round' }
    });
    n.lbl.setAttribute('pointer-events', 'none');
    try { n.rx = n.lbl.getComputedTextLength() / 2 + 1; } catch (e) { n.rx = n.size + 2; }
  });

  /* 图例（学派色 + 节点数） */
  if (gnames.length || nG > 1) {
    legend(svg, gset.map(g => ({
      label: `${gnames[g] ?? '组 ' + (g + 1)} · ${data.nodes.filter(n => (n.group ?? 0) === g).length}`,
      color: cs[g % cs.length]
    })), { y: top + 6 });
  }

  /* 力导向：斥力 + 聚类重力 + 权重弹簧（弱边长、强边短） + 标签防叠（边界给图例/统计行让位） */
  const hasLegend = gnames.length || nG > 1;
  const simBounds = { x0: plot.x0, x1: hasLegend ? W - 34 : plot.x1, y0: plot.y0, y1: H - footH - 16 };
  const sim = d3like(N, E, {
    charge: -640,
    linkRest: e => {
      const base = Math.min(plot.x1 - plot.x0, plot.y1 - plot.y0) * .16 + 14;
      return base * (.7 + .55 * (1 - (e.w || 1) / maxW));   // 弱关联拉远 → 学派分开
    },
    cluster: .014,
    GC,
    bounds: simBounds
  });

  function edgePath(e) {
    const dx = e.B.x - e.A.x, dy = e.B.y - e.A.y;
    const d = Math.hypot(dx, dy) || .01;
    const s = e.i % 2 ? 1 : -1;                             // 交替弯向，扇形展开
    const kx = (-dy / d) * d * e.bow * s, ky = (dx / d) * d * e.bow * s;
    const mx = (e.A.x + e.B.x) / 2 + kx, my = (e.A.y + e.B.y) / 2 + ky;
    return `M${e.A.x.toFixed(2)} ${e.A.y.toFixed(2)}Q${mx.toFixed(2)} ${my.toFixed(2)} ${e.B.x.toFixed(2)} ${e.B.y.toFixed(2)}`;
  }
  function render() {
    E.forEach(e => e.el.setAttribute('d', edgePath(e)));
    N.forEach(n => {
      n.el.setAttribute('cx', n.x.toFixed(2)); n.el.setAttribute('cy', n.y.toFixed(2));
      n.lbl.setAttribute('x', n.x.toFixed(2)); n.lbl.setAttribute('y', (n.y + n.size + 2.5).toFixed(2));
    });
  }
  sim.onTick(render);
  render();

  /* 悬浮聚焦：点亮的边用学派色，其余整体退后 */
  N.forEach(n => {
    const rel = E.filter(e => e.A === n || e.B === n);
    const nbr = new Set(rel.flatMap(e => [e.A, e.B]));
    const gcol = cs[n.group % cs.length];
    const show = ev => {
      N.forEach(m => {
        const dim = !nbr.has(m) && m !== n;
        m.el.setAttribute('fill-opacity', dim ? .15 : 1);
        m.lbl.setAttribute('fill', dim ? INK.hair : INK.base);
      });
      E.forEach(e => {
        const on = rel.includes(e);
        e.el.setAttribute('stroke', on ? gcol : INK.axis);
        e.el.setAttribute('stroke-opacity', on ? .95 : .04);
        e.el.setAttribute('stroke-width', on ? .55 : .32);
      });
    };
    n.el.addEventListener('pointerenter', ev => { show(ev); tipEnter(n, rel, ev); });
    n.el.addEventListener('pointermove', ev => tipEnter(n, rel, ev));
    n.el.addEventListener('pointerleave', () => {
      N.forEach(m => { m.el.setAttribute('fill-opacity', .9); m.lbl.setAttribute('fill', INK.base); });
      E.forEach(e => { e.el.setAttribute('stroke', INK.axis); e.el.setAttribute('stroke-opacity', e.op); e.el.setAttribute('stroke-width', .32); });
      tipHide();
    });
    function tipEnter(n, rel, ev) {
      const wsum = rel.reduce((a, e) => a + (e.w || 1), 0);
      const top = rel.slice().sort((x, y) => y.w - x.w).slice(0, 3).map(e => `${e.a === n.id ? e.b : e.a}(${e.w})`).join(' · ');
      tip(`<b>${n.id}</b> · ${gnames[n.group ?? 0] ?? ''}<br>关联 ${rel.length} 项 · 总强度 ${wsum}<br>最强关联：${top || '—'}`, ev);
    }

    if (o.drag !== false) {
      n.el.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        n.fixed = true; n.el.setAttribute('cursor', 'grabbing');
        const move = ev2 => {
          const pt = toSvg(svg, ev2);
          n.x = pt.x; n.y = pt.y; n.vx = n.vy = 0;
          render(); sim.kick();
        };
        const up = () => {
          n.fixed = false; n.el.setAttribute('cursor', 'grab');
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      });
    }
  });

  /* 底部统计行（细节加成：密度 / 平均度） */
  const n = N.length, m = E.length;
  const density = n > 1 ? (2 * m / (n * (n - 1))) : 0;
  text(svg, 12, H - footH - 3.5, `${n} 个概念 · ${m} 条关联 · 网络密度 ${density.toFixed(2)} · 平均度 ${(2 * m / n).toFixed(1)} · 边深浅 = 共现强度`, { size: 2.2, fill: INK.soft });

  figureNote(svg, o);
  return { svg, sim, nodes: N };
}

/* 指针坐标 → SVG 用户坐标（mm） */
function toSvg(svg, ev) {
  const r = svg.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * +svg.getAttribute('width'), y: (ev.clientY - r.top) / r.height * +svg.getAttribute('height') };
}

/* 迷你力导向（零依赖：斥力 + 聚类重力 + 权重弹簧 + 向心 + alpha 衰减 + 标签防叠硬分离） */
function d3like(N, E, { charge, linkRest, cluster, GC, bounds }) {
  let alpha = 1, running = true, raf = null, stopT = null;
  const center = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
  function step() {
    if (!running) return;
    const a = alpha;
    for (let i = 0; i < N.length; i++) {
      const A = N[i];
      for (let j = i + 1; j < N.length; j++) {
        const B = N[j];
        let dx = B.x - A.x, dy = B.y - A.y;
        let d2 = dx * dx + dy * dy || .01;
        if (d2 > 3600) continue;
        const f = Math.min(-charge / d2, 2.6) * a;
        const d = Math.sqrt(d2), ux = dx / d, uy = dy / d;
        A.vx -= f * ux; A.vy -= f * uy;
        B.vx += f * ux; B.vy += f * uy;
      }
    }
    for (const e of E) {
      const dx = e.B.x - e.A.x, dy = e.B.y - e.A.y;
      const d = Math.hypot(dx, dy) || .01;
      const rest = linkRest(e);
      const f = (d - rest) * .05 * a;
      const ux = dx / d, uy = dy / d;
      if (!e.A.fixed) { e.A.vx += f * ux; e.A.vy += f * uy; }
      if (!e.B.fixed) { e.B.vx -= f * ux; e.B.vy -= f * uy; }
    }
    let energy = 0;
    for (const n of N) {
      const g = GC[n.group ?? 0];
      if (g) { n.vx += (g.x - n.x) * cluster * a; n.vy += (g.y - n.y) * cluster * a; }
      n.vx += (center.x - n.x) * .002 * a; n.vy += (center.y - n.y) * .002 * a;
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx *= .82; n.vy *= .82;
      n.vx = Math.max(-4, Math.min(4, n.vx));
      n.vy = Math.max(-4, Math.min(4, n.vy));
      n.x = Math.min(bounds.x1, Math.max(bounds.x0, n.x + n.vx));
      n.y = Math.min(bounds.y1, Math.max(bounds.y0, n.y + n.vy));
      energy += n.vx * n.vx + n.vy * n.vy;
    }
    /* 硬分离：碰撞半径含标签宽（防叠字），每帧最多推 1.2mm */
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const A = N[i], B = N[j];
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || .01;
      const need = A.size + B.size + 2 + (A.rx + B.rx) * .55;
      if (d < need) {
        const push = Math.min((need - d) / 2, 1.2), ux = dx / d, uy = dy / d;
        if (!A.fixed) { A.x -= push * ux; A.y -= push * uy; }
        if (!B.fixed) { B.x += push * ux; B.y += push * uy; }
      }
    }
    alpha *= .97;
    if (alpha < .03 && energy < 3) { running = false; onTick && onTick(); return; }
    onTick && onTick();
    raf = requestAnimationFrame(step);
  }
  let onTick = null;
  stopT = setTimeout(() => { running = false; cancelAnimationFrame(raf); }, 8000);
  raf = requestAnimationFrame(step);
  return {
    onTick(fn) { onTick = fn; },
    kick() { alpha = Math.max(alpha, .55); running = true; clearTimeout(stopT); stopT = setTimeout(() => { running = false; }, 4000); raf = requestAnimationFrame(step); }
  };
}
