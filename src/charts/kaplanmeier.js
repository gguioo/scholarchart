/* ============ Kaplan-Meier 生存曲线（时间到事件 + 删失 + log-rank + 风险表） ============ */
/* Kaplan & Meier 1958 —— 生存分析的标准图， Greenwood CI · Mantel-Haenszel log-rank */

import { el, text, INK, colors } from '../core/svg.js?v=20261114c';
import { caption, figureNote, fmt } from '../core/axis.js?v=20261114c';
import { niceTicks, linear } from '../core/scale.js?v=20261114c';
import { tip, tipHide } from '../core/tip.js?v=20261114c';

/* 误差函数补（log-rank p 值用， A&S 7.1.26） */
const erfc = x => {
  const z = Math.abs(x), t = 2 / (2 + z * 0.3275911);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 1 - y : y - 1;
};

/* 单组 KM 估计 + Greenwood CI（返回各事件时刻的 S / lo / hi / 风险数） */
function kmEstimate(g) {
  const obs = g.times.map((t, i) => ({ t, e: +g.events[i] })).sort((a, b) => a.t - b.t);
  const uniq = [...new Set(obs.map(p => p.t))].sort((a, b) => a - b);
  let S = 1, varLog = 0;
  const steps = [{ t: 0, S, lo: 1, hi: 1, nr: obs.length, d: 0, cens: 0 }];
  for (const t of uniq) {
    const at = obs.filter(p => p.t >= t);
    const nr = at.length, d = at.filter(p => p.e === 1 && p.t === t).length;
    const nc = at.filter(p => p.e !== 1 && p.t === t).length;
    if (d > 0) {
      S *= 1 - d / nr;
      if (nr - d > 0) varLog += d / (nr * (nr - d));
      const se = Math.sqrt(varLog);
      steps.push({ t, S, lo: Math.exp(Math.log(S) - 1.959964 * se), hi: Math.exp(Math.log(S) + 1.959964 * se), nr, d, cens: nc });
    } else {
      const last = steps[steps.length - 1];
      steps.push({ t, S: last.S, lo: last.lo, hi: last.hi, nr, d: 0, cens: nc });
    }
  }
  return { steps, maxT: Math.max(...g.times, 0), n0: obs.length, events: obs.filter(p => p.e === 1).length };
}

/* log-rank（两组 Mantel-Cox） */
function logrank(g1, g2) {
  const ts = [...new Set([...g1.times, ...g2.times].filter((_, i) => (g1.events[i] ?? 0) === 1 || true))].sort((a, b) => a - b)
    .filter(t => g1.times.some((x, i) => x === t && +g1.events[i] === 1) || g2.times.some((x, i) => x === t && +g2.events[i] === 1));
  let O1 = 0, E1 = 0, V1 = 0;
  for (const t of ts) {
    const n1 = g1.times.filter((x, i) => x >= t).length;
    const n2 = g2.times.filter((x, i) => x >= t).length;
    const n = n1 + n2; if (!n) continue;
    const d = g1.times.filter((x, i) => x === t && +g1.events[i] === 1).length + g2.times.filter((x, i) => x === t && +g2.events[i] === 1).length;
    if (!d) continue;
    O1 += g1.times.filter((x, i) => x === t && +g1.events[i] === 1).length;
    E1 += d * n1 / n;
    if (n > 1) V1 += d * (n1 * n2 / (n * n)) * ((n - d) / (n - 1));
  }
  const chi2 = V1 > 0 ? (O1 - E1) ** 2 / V1 : 0;
  return { chi2, O1, E1, p: erfc(Math.sqrt(chi2 / 2)) };
}

/*
 * data = { groups: [ { name, times:[..], events:[0/1..] }, { ... } ],  // 两组
 *          t: { label:'周' } }
 */
export function draw(svg, data, o = {}) {
  svg.innerHTML = '';
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const top = caption(svg, o);
  const G = data.groups.slice(0, 2), cs = colors();
  const footH = 26;
  const avail = H - top - footH;
  const tabH = 15;                                  // 风险表区
  const box = { x: 16, y: top + 7, w: W - 22, h: avail - tabH - 7 };

  const maxT = Math.max(...G.flatMap(g => g.times));
  const T = niceTicks(0, maxT * 1.02 + .001, 5);
  const valT = linear(T.lo, T.hi, box.x, box.x + box.w);
  const valS = linear(0, 1, box.y + box.h, box.y);
  const ests = G.map(kmEstimate);
  const lr = logrank(G[0], G[1]);

  /* 轴 */
  for (const t of T.ticks) {
    if (t === T.lo) continue;
    el('line', { x1: valT(t), x2: valT(t), y1: box.y, y2: box.y + box.h, stroke: INK.hair, 'stroke-width': .2 }, svg);
  }
  for (const s of [0, .25, .5, .75, 1]) {
    el('line', { x1: box.x - 1.2, x2: box.x, y1: valS(s), y2: valS(s), stroke: INK.axis, 'stroke-width': .3 }, svg);
    text(svg, box.x - 2, valS(s) + .9, s.toFixed(s === 1 ? 0 : 2).replace('0.', '.'), { size: 2.3, anchor: 'end', fill: INK.soft });
  }
  el('path', { d: `M${box.x} ${box.y}V${box.y + box.h}H${box.x + box.w}`, fill: 'none', stroke: INK.axis, 'stroke-width': .35 }, svg);

  /* 阶梯曲线 + CI 带 + 删失记号 */
  ests.forEach((est, gi) => {
    const st = est.steps, color = cs[gi];
    const stepPath = (get) => 'M' + valT(0) + ' ' + valS(get(st[0])) + st.map(p => `H${valT(p.t).toFixed(2)}V${valS(get(p)).toFixed(2)}`).join('');
    /* CI 带（多边形） */
    const hi = st.map(p => [valT(p.t), valS(Math.min(1, p.hi))]);
    const lo = st.map(p => [valT(p.t), valS(Math.max(0, p.lo))]).reverse();
    const band = 'M' + hi.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'L' + lo.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z';
    el('path', { d: band, fill: color, 'fill-opacity': .08 }, svg);
    /* 主曲线 */
    const pth = el('path', { d: stepPath(p => p.S), fill: 'none', stroke: color, 'stroke-width': .8, cursor: 'pointer' }, svg);
    /* 删失刻度 */
    st.filter(p => p.cens > 0 && p.t > 0).forEach(p => {
      const lastS = st[st.indexOf(p) - 1] ? st[st.indexOf(p) - 1].S : 1;
      el('line', { x1: valT(p.t), x2: valT(p.t), y1: valS(lastS) - .9, y2: valS(lastS) + .9, stroke: color, 'stroke-width': .35 }, svg);
    });
    const medT = (() => {                              /* 中位生存时间 */
      const hit = st.find(p => p.S <= .5);
      return hit ? hit.t : Infinity;
    })();
    const msg = `<b>${G[gi].name}</b><br>n = ${est.n0} · 事件 ${est.events} · 删失 ${est.n0 - est.events}<br>中位时间 ${medT === Infinity ? '未达到' : fmt(medT) + ' ' + (data.t?.label || '')}<br>95% CI 带（Greenwood）`;
    pth.addEventListener('pointerenter', ev => tip(msg, ev));
    pth.addEventListener('pointermove', ev => tip(msg, ev));
    pth.addEventListener('pointerleave', tipHide);
    text(svg, box.x + box.w - 1, box.y + 4 + gi * 3.4, G[gi].name, { size: 2.4, anchor: 'end', fill: color });
  });

  /* 风险表（at risk numbers at ticks） */
  const ty0 = box.y + box.h + 3.4;
  text(svg, box.x - 2, ty0 + 2.6, '风险数', { size: 2.2, anchor: 'end', fill: INK.soft });
  G.forEach((g, gi) => {
    const ry = ty0 + 6.2 + gi * 4;
    for (const t of T.ticks) {
      if (t > maxT) { text(svg, valT(t), ry, '—', { size: 2.2, anchor: 'middle', fill: INK.soft }); continue; }
      const nr = g.times.filter(x => x >= t).length;
      text(svg, valT(t), ry, nr, { size: 2.2, anchor: 'middle', fill: INK.soft });
    }
    el('line', { x1: box.x - 4.5, x2: box.x - 2.5, y1: ry - .8, y2: ry - .8, stroke: cs[gi], 'stroke-width': .8 }, svg);
  });
  /* x 轴刻度标签放风险表下 */
  for (const t of T.ticks) text(svg, valT(t), ty0 + 6.2 + G.length * 4 + 1.2, fmt(t), { size: 2.3, anchor: 'middle', fill: INK.soft });
  const xl = text(svg, box.x + box.w / 2, ty0 + 6.2 + G.length * 4 + 5, data.t?.label || '时间', { size: 2.8, anchor: 'middle' });
  const yl = text(svg, 0, 0, '生存概率', { size: 2.8, anchor: 'middle', fill: INK.base });
  yl.setAttribute('transform', `translate(${box.x - 10} ${box.y + box.h / 2}) rotate(-90)`);

  /* log-rank 注释（单独一行，避开风险表与 x 轴名） */
  text(svg, 16, H - 12.5, `log-rank：χ²(1) = ${lr.chi2.toFixed(1)}（O₁ = ${lr.O1}，E₁ = ${lr.E1.toFixed(1)}），p ${lr.p < .001 ? '< 0.001' : '= ' + lr.p.toFixed(3)}`, { size: 2.3, fill: INK.soft });

  figureNote(svg, o);
  return svg;
}
