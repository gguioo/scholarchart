/* ============ 导出：SVG（可文字转曲）/ PNG（600dpi 可调）/ 矢量 PDF（打印管线） ============ */

import { FONT } from './core/svg.js?v=20261114c';

/* 内置子集字体（与 FONT 栈首位的 @font-face 同源），转曲与所见即所得一致 */
const FONT_FILES = {
  serif: 'assets/fonts/ScholarChartSerif-subset.otf',
  sans: 'assets/fonts/ScholarChartSans-subset.otf'
};

let _libLoading = null;
function loadOutlineLib() {
  if (window.opentype) return Promise.resolve(window.opentype);
  if (_libLoading) return _libLoading;
  _libLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'assets/vendor/opentype.min.js';
    s.onload = () => window.opentype ? res(window.opentype) : rej(Object.assign(new Error('lib-load')));
    s.onerror = () => rej(Object.assign(new Error('lib-load')));
    document.head.appendChild(s);
  });
  return _libLoading;
}

/* 把 clone 中的 <text> 全部替换为 <path>（转曲）。
 * 返回缺字数；任何异常向上抛出由调用方降级处理。 */
async function convertTextToPaths(svg) {
  const ot = await loadOutlineLib();
  const buf = await (await fetch(FONT_FILES[FONT.cur])).arrayBuffer();
  const font = ot.parse(buf);
  let missing = 0;
  const texts = Array.from(svg.querySelectorAll('text'));
  for (const t of texts) {
    const str = t.textContent || '';
    const size = parseFloat(t.getAttribute('font-size') ?? 2.6) || 2.6;
    const fill = t.getAttribute('fill') || '#2A2A28';
    const anchor = t.getAttribute('text-anchor') || 'start';
    for (const ch of new Set(str))
      if (ch.trim() && font.charToGlyph(ch).index === 0) missing++;
    const w = font.getAdvanceWidth(str, size);
    let x = parseFloat(t.getAttribute('x') ?? 0) || 0;
    const y = parseFloat(t.getAttribute('y') ?? 0) || 0;
    if (anchor === 'middle') x -= w / 2;
    else if (anchor === 'end') x -= w;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', font.getPath(str, x, y, size).toPathData(3));
    path.setAttribute('fill', fill);
    const tr = t.getAttribute('transform');
    if (tr) path.setAttribute('transform', tr);
    t.replaceWith(path);
  }
  return { total: texts.length, missing };
}

export async function exportSVG(svg, outline = false) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (outline) {
    try {
      const { missing } = await convertTextToPaths(clone);
      if (missing) alert(`转曲完成，但有 ${missing} 种字符不在内置字体范围内（生僻字），对应文字显示为空心方框。可改用普通 SVG 导出。`);
    } catch (e) {
      alert(e.message === 'lib-load'
        ? '转曲组件加载失败，请检查网络后重试；本次导出为保留文字的普通 SVG。'
        : '转曲字体读取失败，本次导出为保留文字的普通 SVG。');
    }
  }
  const src = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  download(new Blob([src], { type: 'image/svg+xml' }), fileName('svg'));
}

export function exportPNG(svg, dpi = 600) {
  const mm = { w: +svg.getAttribute('width'), h: +svg.getAttribute('height') };
  const px = {
    w: Math.round(mm.w / 25.4 * dpi),
    h: Math.round(mm.h / 25.4 * dpi)
  };
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = px.w; c.height = px.h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px.w, px.h);
    ctx.drawImage(img, 0, 0, px.w, px.h);
    c.toBlob(b => download(b, fileName('png')), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
}

/* 矢量 PDF：把 SVG 按物理毫米尺寸放进打印页，浏览器"另存为 PDF"即为矢量
 * （Chrome / Edge 的打印转 PDF 完整保留路径与文字，学术投稿可用） */
export function exportPDF(svg) {
  const w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = new XMLSerializer().serializeToString(clone);
  const fw = window.open('', '_blank');
  if (!fw) { alert('PDF 预览窗口被浏览器拦截，请允许本站弹窗后重试'); return; }
  fw.document.write(`<!DOCTYPE html><html><head><title>${document.title}</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0 }
    html, body { margin: 0; padding: 0 }
    svg { width: ${w}mm; height: ${h}mm; display: block }
  </style></head><body>${src}</body></html>`);
  fw.document.close();
  fw.onload = () => setTimeout(() => { fw.focus(); fw.print(); }, 300);
}

/* 命名：图类型-尺寸-时间 */
function fileName(ext) {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  const size = (window.__scSize || '').replace(/[^0-9x]/g, '');
  return `scholarchart${size ? '-' + size : ''}-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}.${ext}`;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
