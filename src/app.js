/* ============ 应用外壳：图表切换 / 尺寸预设 / 配色 / 数据编辑 / 导出 ============ */

import { PAL, PALETTES } from './core/svg.js';
import { draw as trend } from './charts/trend.js';
import { draw as bars } from './charts/bars.js';
import { draw as heatmap } from './charts/heatmap.js';
import { draw as radar } from './charts/radar.js';
import { draw as network } from './charts/network.js';
import { draw as raincloud } from './charts/raincloud.js';
import { draw as upset } from './charts/upset.js';
import { draw as slope } from './charts/slope.js';
import { draw as thematic } from './charts/thematic.js';
import { draw as dotplot } from './charts/dotplot.js';
import { draw as forest } from './charts/forest.js';
import { draw as estimation } from './charts/estimation.js';
import { draw as ridgeline } from './charts/ridgeline.js';
import { draw as blandaltman } from './charts/blandaltman.js';
import { draw as kaplanmeier } from './charts/kaplanmeier.js';
import { draw as roc } from './charts/roc.js';
import { draw as qq } from './charts/qq.js';
import { draw as stl } from './charts/stl.js';
import { exportSVG, exportPNG, exportPDF } from './export.js';

const CHARTS = {
  trend: { name: '趋势图', mod: trend },
  bars: { name: '柱状图', mod: bars },
  heatmap: { name: '热力图', mod: heatmap },
  radar: { name: '雷达图', mod: radar },
  network: { name: '关联图', mod: network },
  raincloud: { name: '雨云图', mod: raincloud },
  upset: { name: 'UpSet 图', mod: upset },
  slope: { name: '坡度图', mod: slope },
  thematic: { name: '战略坐标图', mod: thematic },
  dotplot: { name: '点图', mod: dotplot },
  forest: { name: '森林图', mod: forest },
  estimation: { name: '估计图', mod: estimation },
  ridgeline: { name: '山脊图', mod: ridgeline },
  blandaltman: { name: '一致性图', mod: blandaltman },
  kaplanmeier: { name: '生存曲线', mod: kaplanmeier },
  roc: { name: 'ROC 曲线', mod: roc },
  qq: { name: 'Q-Q 图', mod: qq },
  stl: { name: '时序分解', mod: stl }
};

const SIZES = [
  { key: '85x70', w: 85, h: 70, label: '单栏 85×70mm' },
  { key: '130x90', w: 130, h: 90, label: '1.5 栏 130×90mm' },
  { key: '170x110', w: 170, h: 110, label: '全栏 170×110mm' },
  { key: '170x170', w: 170, h: 170, label: '全栏方形 170×170mm' }
];

const state = {
  type: 'trend',
  size: SIZES[2],
  data: null,
  meta: {}
};

const $ = s => document.querySelector(s);

async function loadSamples() {
  const list = await (await fetch('./samples/index.json')).json();
  const sel = $('#sampleSel');
  sel.innerHTML = '';
  for (const s of list) {
    const o = document.createElement('option');
    o.value = s.file; o.textContent = s.name; o.dataset.type = s.type;
    sel.appendChild(o);
  }
  sel.value = list.find(s => s.type === state.type)?.file || list[0].file;
  state.sample = sel.value;
  sel.onchange = () => { state.sample = sel.value; loadSample(sel.value, sel.selectedOptions[0].dataset.type, true); };
  await loadSample(sel.value, sel.selectedOptions[0].dataset.type, true);
}

async function loadSample(file, type, resetType) {
  const j = await (await fetch('./samples/' + file)).json();
  if (j.type && CHARTS[j.type]) { state.type = j.type; autoSize(j.type); }
  state.data = j.data;
  state.meta = { ...j.opts };
  syncForm();
  $('#dataText').value = JSON.stringify({ ...j, opts: j.opts }, null, 2);
  render();
}

function render() {
  const svg = $('#canvas');
  const { w, h } = state.size;
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.maxWidth = '100%';
  svg.style.aspectRatio = `${w}/${h}`;
  window.__scSize = state.size.key;
  const opts = { ...state.meta, title: $('#fTitle').value, subtitle: $('#fSub').value, figLabel: $('#fFig').value, figTitle: $('#fFigTitle').value, note: $('#fNote').value };
  CHARTS[state.type].mod(svg, state.data, opts);
}

/* 雷达图吃方形画布：横幅自动切 170×170；离开时还原 170×110（用户手动选过尺寸则不干预） */
function autoSize(type) {
  if (state.userSized) return;
  const wantSquare = type === 'radar';
  const isSquare = state.size.h === state.size.w;
  if (wantSquare !== isSquare) {
    state.size = SIZES.find(s => s.key === (wantSquare ? '170x170' : '170x110'));
    $('#sizeSel').value = state.size.key;
  }
}

function syncForm() {
  const m = state.meta;
  $('#fTitle').value = m.title || '';
  $('#fSub').value = m.subtitle || '';
  $('#fFig').value = m.figLabel || '';
  $('#fFigTitle').value = m.figTitle || '';
  $('#fNote').value = m.note || '';
}

function buildUI() {
  /* 图表类型 */
  const nav = $('#chartNav');
  for (const k in CHARTS) {
    const b = document.createElement('button');
    b.className = 'nav-btn'; b.textContent = CHARTS[k].name;
    b.onclick = () => {
      state.type = k;
      autoSize(k);
      document.querySelectorAll('.nav-btn').forEach(x => x.classList.toggle('on', x === b));
      const sel = $('#sampleSel');
      const opt = [...sel.options].find(o => o.dataset.type === k);
      if (opt) { sel.value = opt.value; loadSample(opt.value, k, false); }
      else render();
    };
    nav.appendChild(b);
  }
  nav.querySelector('.nav-btn').classList.add('on');

  /* 尺寸 */
  const szSel = $('#sizeSel');
  SIZES.forEach(s => { const o = document.createElement('option'); o.value = s.key; o.textContent = s.label; szSel.appendChild(o); });
  szSel.value = state.size.key;
  szSel.onchange = () => { state.userSized = true; state.size = SIZES.find(s => s.key === szSel.value); render(); };

  /* 配色 */
  const pSel = $('#palSel');
  for (const p in PALETTES) { const o = document.createElement('option'); o.value = p; o.textContent = { danli: '淡雅·综合', qing: '青瓷·冷调', mono: '青墨·单色系', nuan: '暖陶·低饱和' }[p]; pSel.appendChild(o); }
  pSel.onchange = () => { PAL.name = pSel.value; render(); };

  /* 标题图注实时联动 */
  ['#fTitle', '#fSub', '#fFig', '#fFigTitle', '#fNote'].forEach(id =>
    $(id).addEventListener('input', render));

  /* 数据编辑器 */
  $('#applyData').onclick = () => {
    try {
      const j = JSON.parse($('#dataText').value);
      if (!j.data) throw new Error('缺少 data 字段');
      if (j.type && CHARTS[j.type]) state.type = j.type;
      state.data = j.data;
      state.meta = { ...j.opts };
      syncForm(); render();
      $('#dataMsg').textContent = '已应用 ✓'; $('#dataMsg').style.color = '#9eb388';
    } catch (e) {
      $('#dataMsg').textContent = 'JSON 有误：' + e.message; $('#dataMsg').style.color = '#c08e8e';
    }
  };

  /* 导出 */
  $('#exSVG').onclick = () => exportSVG($('#canvas'));
  $('#exPNG').onclick = () => exportPNG($('#canvas'), +($('#pngDpi').value || 600));
  $('#exPDF').onclick = () => exportPDF($('#canvas'));
}

buildUI();
loadSamples().catch(async e => {
  /* file:// 直开时 fetch 失败 → 内嵌兜底数据 */
  console.warn(e);
  const { FALLBACK } = await import('./fallback.js');
  state.type = 'trend'; state.data = FALLBACK.data; state.meta = { ...FALLBACK.opts };
  syncForm(); render();
});
