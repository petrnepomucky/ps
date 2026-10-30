// Prohlížeč výkresů – poznámky do výkresu (kreslení, šipky, tvary, textové rámečky).
// Poznámky se neukládají; jdou jen vytisknout nebo stáhnout jako PDF / obrázek aktuálního zobrazení.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const viewer = $('viewer');
  const btn = $('annotBtn');
  if (!viewer || !btn) return;

  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = [['#E03131', 'Červená'], ['#F27D00', 'Oranžová'], ['#1971C2', 'Modrá'], ['#2F9E44', 'Zelená'], ['#111111', 'Černá']];
  const WIDTHS = [[2, 14, 'Tenká'], [4, 18, 'Střední'], [7, 24, 'Silná']];
  const TOOLS = [
    ['pan', 'Ovládání výkresu (bez kreslení)', '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V13m0-5a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4.6 15a1.5 1.5 0 0 1 2.4-1.8L8 14.5"/>'],
    ['pen', 'Pero', '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/>'],
    ['line', 'Čára', '<path d="M5 19 19 5"/>'],
    ['arrow', 'Šipka', '<path d="M5 19 19 5M10 5h9v9"/>'],
    ['rect', 'Obdélník', '<rect x="4" y="6" width="16" height="12" rx="1"/>'],
    ['ellipse', 'Elipsa', '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>'],
    ['text', 'Text', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
    ['erase', 'Guma', '<path d="M7 20h11M5.5 14.5l7-7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 19H8.5l-3-3a1.1 1.1 0 0 1 0-1.5z"/>']
  ];

  let shapes = [];         // {type, pts:[{x,y}] (svět), color, w, fs, text}
  let tool = 'pen', color = COLORS[0][0], wIdx = 1;
  let draft = null, dragging = false, raf = 0, open = false, editor = null;

  // ---------- vzhled ----------
  const css = document.createElement('style');
  css.textContent = `
  .annot-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
  #viewer.drawing canvas{cursor:crosshair!important}
  #viewer.drawing.erasing canvas{cursor:cell!important}
  #viewer.drawing{touch-action:none}
  .annot-bar{position:absolute;top:12px;left:12px;z-index:5;display:none;flex-wrap:wrap;align-items:center;gap:4px;max-width:calc(100% - 24px);background:#fff;border:1px solid var(--line);border-radius:12px;padding:6px;box-shadow:0 6px 20px #0000002e;font-size:13px}
  .annot-bar.on{display:flex}
  .annot-bar .ab{appearance:none;width:34px;height:34px;border-radius:8px;border:1px solid transparent;background:transparent;display:grid;place-items:center;cursor:pointer;color:var(--ink);padding:0}
  .annot-bar .ab:hover{background:#f0f8f3}
  .annot-bar .ab.on{background:#f0f8f3;border-color:var(--psas-orange);color:var(--psas-orange-dark)}
  .annot-bar .ab svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .annot-bar .sep{width:1px;height:24px;background:var(--line);margin:0 3px}
  .annot-bar .sw{width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #0003;cursor:pointer;padding:0}
  .annot-bar .sw.on{box-shadow:0 0 0 2px var(--ink)}
  .annot-bar .wd{appearance:none;width:30px;height:34px;border-radius:8px;border:1px solid transparent;background:transparent;cursor:pointer;display:grid;place-items:center;padding:0}
  .annot-bar .wd i{display:block;width:16px;border-radius:9px;background:var(--ink)}
  .annot-bar .wd.on{background:#f0f8f3;border-color:var(--psas-orange)}
  .annot-bar .tx{appearance:none;height:34px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;padding:0 10px;font:inherit;font-weight:600;color:var(--ink);display:inline-flex;align-items:center;gap:5px}
  .annot-bar .tx:hover{background:#f0f8f3}
  .annot-bar .tx.pri{background:var(--psas-orange);border-color:var(--psas-orange);color:#fff}
  .annot-bar .tx.pri:hover{background:var(--psas-orange-dark)}
  .annot-edit{position:absolute;z-index:6;min-width:140px;min-height:34px;padding:5px 7px;border:2px solid;border-radius:4px;background:#fffffff2;font:inherit;line-height:1.25;resize:both;outline:none;box-shadow:0 4px 14px #0003}
  #annotPrint{display:none}
  @media print{body>*:not(#annotPrint){display:none!important}#annotPrint{display:block!important}#annotPrint img{width:100%;height:auto;display:block}@page{margin:10mm}}
  @media (width<=700px){.annot-bar{top:8px;left:8px;max-width:calc(100% - 16px)}}`;
  document.head.appendChild(css);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'annot-svg');
  viewer.appendChild(svg);

  const bar = document.createElement('div');
  bar.className = 'annot-bar';
  bar.innerHTML =
    TOOLS.map(([k, n, p]) => `<button class="ab" data-tool="${k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24">${p}</svg></button>`).join('') +
    '<span class="sep"></span>' +
    COLORS.map(([c, n]) => `<button class="sw" data-color="${c}" title="${n}" aria-label="${n}" style="background:${c}"></button>`).join('') +
    '<span class="sep"></span>' +
    WIDTHS.map(([w, , n], i) => `<button class="wd" data-w="${i}" title="${n}" aria-label="${n}"><i style="height:${w}px"></i></button>`).join('') +
    '<span class="sep"></span>' +
    '<button class="ab" data-act="undo" title="Zpět (Ctrl+Z)" aria-label="Zpět"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg></button>' +
    '<button class="ab" data-act="clear" title="Smazat všechny poznámky" aria-label="Smazat vše"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>' +
    '<span class="sep"></span>' +
    '<button class="tx" data-act="print" title="Vytisknout aktuální zobrazení">🖨 Tisk</button>' +
    '<button class="tx" data-act="pdf" title="Stáhnout aktuální zobrazení jako PDF">⬇ PDF</button>' +
    '<button class="tx pri" data-act="img" title="Stáhnout aktuální zobrazení jako obrázek PNG">⬇ Obrázek</button>';
  viewer.appendChild(bar);

  const printBox = document.createElement('div');
  printBox.id = 'annotPrint';
  document.body.appendChild(printBox);

  // ---------- převody souřadnic ----------
  const view = () => { const m = window.__cadMgr && window.__cadMgr(); return m && m.curView; };
  const rect = () => (viewer.querySelector('canvas') || viewer).getBoundingClientRect();
  function toWorld(ev) {
    const v = view(); if (!v) return null;
    const r = rect(), p = v.screenToWorld({ x: ev.clientX - r.left, y: ev.clientY - r.top });
    return { x: p.x, y: p.y };
  }
  function toScreen(p) { const v = view(); if (!v) return { x: 0, y: 0 }; const s = v.worldToScreen(p); return { x: s.x, y: s.y }; }

  // ---------- vykreslení ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mctx = document.createElement('canvas').getContext('2d');
  const FONT = 'Segoe UI,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif';
  function textBox(s) {
    const p = toScreen(s.pts[0]), lines = (s.text || '').split('\n');
    mctx.font = `600 ${s.fs}px ${FONT}`;
    const lh = Math.round(s.fs * 1.25), pad = Math.round(s.fs * 0.45);
    const w = Math.max(...lines.map(l => mctx.measureText(l).width)) + pad * 2;
    return { x: p.x, y: p.y, w, h: lines.length * lh + pad * 2, lh, pad, lines };
  }
  function geom(s) {
    const P = s.pts.map(toScreen);
    if (s.type === 'pen' || s.type === 'line' || s.type === 'arrow') return P;
    if (s.type === 'rect' && P.length > 1) {
      const x = Math.min(P[0].x, P[1].x), y = Math.min(P[0].y, P[1].y), X = Math.max(P[0].x, P[1].x), Y = Math.max(P[0].y, P[1].y);
      return [{ x, y }, { x: X, y }, { x: X, y: Y }, { x, y: Y }, { x, y }];
    }
    if (s.type === 'ellipse' && P.length > 1) {
      const cx = (P[0].x + P[1].x) / 2, cy = (P[0].y + P[1].y) / 2, rx = Math.abs(P[1].x - P[0].x) / 2, ry = Math.abs(P[1].y - P[0].y) / 2, o = [];
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; o.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); }
      return o;
    }
    if (s.type === 'text') { const b = textBox(s); return [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }, { x: b.x, y: b.y }]; }
    return P;
  }
  function shapeSvg(s) {
    const st = `stroke="${s.color}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    if (s.type === 'text') {
      const b = textBox(s);
      let t = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="#ffffff" fill-opacity="0.93" stroke="${s.color}" stroke-width="2"/>`;
      b.lines.forEach((l, i) => { t += `<text x="${b.x + b.pad}" y="${b.y + b.pad + (i + 1) * b.lh - b.lh * 0.25}" fill="${s.color}" font-family="${FONT}" font-size="${s.fs}" font-weight="600" xml:space="preserve">${esc(l)}</text>`; });
      return t;
    }
    const P = geom(s);
    if (P.length < 2) return P.length ? `<circle cx="${P[0].x}" cy="${P[0].y}" r="${s.w / 2}" fill="${s.color}"/>` : '';
    const d = P.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    let out = `<path d="${d}" ${st}/>`;
    if (s.type === 'arrow') {
      const a = P[P.length - 2], b = P[P.length - 1], ang = Math.atan2(b.y - a.y, b.x - a.x), L = 10 + s.w * 3;
      const p1 = { x: b.x - L * Math.cos(ang - 0.45), y: b.y - L * Math.sin(ang - 0.45) }, p2 = { x: b.x - L * Math.cos(ang + 0.45), y: b.y - L * Math.sin(ang + 0.45) };
      out += `<path d="M${p1.x} ${p1.y} L${b.x} ${b.y} L${p2.x} ${p2.y} Z" fill="${s.color}" stroke="${s.color}" stroke-width="${s.w}" stroke-linejoin="round"/>`;
    }
    return out;
  }
  function render() { svg.innerHTML = shapes.concat(draft ? [draft] : []).map(shapeSvg).join(''); }
  function loop() { render(); raf = (shapes.length || draft) ? requestAnimationFrame(loop) : 0; }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); render(); updateBtn(); }
  function updateBtn() { btn.textContent = shapes.length ? `✏ Poznámky (${shapes.length})` : '✏ Poznámky'; btn.classList.toggle('on', open); }

  // ---------- nástroje ----------
  function setTool(t) {
    commitEditor();
    tool = t;
    bar.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    viewer.classList.toggle('drawing', open && t !== 'pan');
    viewer.classList.toggle('erasing', t === 'erase');
    if (open && t !== 'pan') closeMeasure();
  }
  function setColor(c) { color = c; bar.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === c)); if (editor) editor.el.style.borderColor = editor.el.style.color = c; }
  function setWidth(i) { wIdx = i; bar.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', +b.dataset.w === i)); if (editor) editor.el.style.fontSize = WIDTHS[i][1] + 'px'; }
  function closeMeasure() { ['measDistBtn', 'measAreaBtn'].forEach(id => { const b = $(id); if (b && b.classList.contains('on')) b.click(); }); }
  function toggle(on) {
    open = on === undefined ? !open : on;
    bar.classList.toggle('on', open);
    if (!open) commitEditor();
    setTool(tool);
    updateBtn();
  }
  btn.addEventListener('click', () => toggle());
  ['measDistBtn', 'measAreaBtn', 'hideLayerBtn'].forEach(id => { const b = $(id); b && b.addEventListener('click', () => { if (open && tool !== 'pan') setTool('pan'); }); });

  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.dataset.color) setColor(b.dataset.color);
    else if (b.dataset.w) setWidth(+b.dataset.w);
    else if (b.dataset.act === 'undo') undo();
    else if (b.dataset.act === 'clear') { if (shapes.length && confirm('Smazat všechny poznámky ve výkresu?')) { shapes = []; kick(); } }
    else if (b.dataset.act) exportView(b.dataset.act);
  });
  function undo() { if (editor) { cancelEditor(); return; } shapes.pop(); kick(); }

  // ---------- kreslení myší / prstem ----------
  const inUi = e => e.target.closest('.annot-bar,.annot-edit,.measure-panel,.empty');
  const active = () => open && tool !== 'pan';
  function hit(ev) {
    const r = rect(), q = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.type === 'text') { const b = textBox(s); if (q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h) return i; continue; }
      const P = geom(s), tol = Math.max(8, s.w + 4);
      if (P.length === 1 && Math.hypot(P[0].x - q.x, P[0].y - q.y) < tol) return i;
      for (let k = 1; k < P.length; k++) if (segDist(q, P[k - 1], P[k]) < tol) return i;
    }
    return -1;
  }
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function stop(e) { e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }

  viewer.addEventListener('pointerdown', e => {
    if (!active() || inUi(e) || e.button > 0) return;
    stop(e); e.preventDefault();
    const p = toWorld(e); if (!p) return;
    if (tool === 'erase') { const i = hit(e); if (i >= 0) { shapes.splice(i, 1); kick(); } dragging = 'erase'; viewer.setPointerCapture(e.pointerId); return; }
    if (tool === 'text') { commitEditor(); openEditor(p, e); return; }
    commitEditor();
    const W = WIDTHS[wIdx];
    draft = { type: tool, pts: tool === 'pen' ? [p] : [p, p], color, w: W[0], fs: W[1] };
    dragging = true;
    viewer.setPointerCapture(e.pointerId);
    kick();
  }, true);
  viewer.addEventListener('pointermove', e => {
    if (!dragging) return;
    stop(e);
    if (dragging === 'erase') { const i = hit(e); if (i >= 0) { shapes.splice(i, 1); kick(); } return; }
    const p = toWorld(e); if (!p || !draft) return;
    if (draft.type === 'pen') {
      const last = toScreen(draft.pts[draft.pts.length - 1]), r = rect();
      if (Math.hypot(e.clientX - r.left - last.x, e.clientY - r.top - last.y) >= 2) draft.pts.push(p);
    } else draft.pts[1] = p;
  }, true);
  function endDraw(e) {
    if (!dragging) return;
    stop(e);
    if (draft) {
      const P = draft.pts.map(toScreen), big = P.length > 1 && Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].y - P[0].y) > 3;
      if (draft.type === 'pen' || big) shapes.push(draft);
    }
    draft = null; dragging = false;
    try { viewer.releasePointerCapture(e.pointerId); } catch {}
    kick();
  }
  viewer.addEventListener('pointerup', endDraw, true);
  viewer.addEventListener('pointercancel', endDraw, true);
  ['click', 'dblclick', 'mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove'].forEach(t =>
    viewer.addEventListener(t, e => { if (active() && !inUi(e)) stop(e); }, true));

  // ---------- textové rámečky ----------
  function openEditor(p, ev) {
    const r = rect(), vr = viewer.getBoundingClientRect(), W = WIDTHS[wIdx];
    const el = document.createElement('textarea');
    el.className = 'annot-edit';
    el.placeholder = 'Napiš poznámku…';
    el.style.cssText = `left:${ev.clientX - vr.left}px;top:${ev.clientY - vr.top}px;border-color:${color};color:${color};font-size:${W[1]}px;font-weight:600`;
    viewer.appendChild(el);
    editor = { el, p };
    el.focus(); setTimeout(() => el.focus(), 0);
    el.addEventListener('keydown', k => {
      k.stopPropagation();
      if (k.key === 'Escape') cancelEditor();
      if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) commitEditor();
    });
    el.addEventListener('blur', () => setTimeout(commitEditor, 120));
  }
  function commitEditor() {
    if (!editor) return;
    const { el, p } = editor; editor = null;
    const t = el.value.replace(/\s+$/, '');
    el.remove();
    if (t) { shapes.push({ type: 'text', pts: [p], color: el.style.color ? rgbHex(el.style.color) : color, w: 2, fs: parseInt(el.style.fontSize) || WIDTHS[wIdx][1], text: t }); kick(); }
  }
  function cancelEditor() { if (!editor) return; editor.el.remove(); editor = null; }
  function rgbHex(c) { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : c; }

  document.addEventListener('keydown', e => {
    if (!open || editor || /input|textarea|select/i.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  // ---------- export aktuálního zobrazení ----------
  const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3200); };
  const frames = n => new Promise(r => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); });
  const fileBase = () => (($('fileName') && $('fileName').textContent) || 'vykres').replace(/\.(dwg|dxf)$/i, '').replace(/[^\wÀ-ſ.-]+/g, '_') || 'vykres';

  async function snapshot(footer) {
    commitEditor();
    const cv = viewer.querySelector('canvas');
    if (!cv || !view()) throw new Error('Nejdřív otevři výkres.');
    const r = cv.getBoundingClientRect(), sx = cv.width / r.width;
    const out = document.createElement('canvas');
    const fh = footer ? Math.round(34 * sx) : 0;
    out.width = cv.width; out.height = cv.height + fh;
    const g = out.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
    await frames(2);
    g.drawImage(cv, 0, 0);
    render();
    const s = svg.cloneNode(true);
    s.setAttribute('xmlns', NS); s.setAttribute('width', r.width); s.setAttribute('height', r.height); s.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s)); });
    g.drawImage(img, 0, 0, cv.width, cv.height);
    if (footer) {
      g.fillStyle = '#f0f8f3'; g.fillRect(0, cv.height, out.width, fh);
      g.fillStyle = '#1F1E1D'; g.font = `600 ${Math.round(13 * sx)}px ${FONT}`; g.textBaseline = 'middle';
      g.fillText(($('fileName') && $('fileName').textContent) || 'Výkres', 12 * sx, cv.height + fh / 2);
      const d = new Date().toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' });
      g.textAlign = 'right'; g.fillStyle = '#6B6862'; g.font = `${Math.round(12 * sx)}px ${FONT}`;
      g.fillText('Výřez výkresu s poznámkami · ' + d, out.width - 12 * sx, cv.height + fh / 2);
    }
    return out;
  }
  async function withLightBg(fn) {
    const dark = !viewer.classList.contains('light'), bg = $('bgBtn');
    if (dark && bg) { bg.click(); await frames(3); await new Promise(r => setTimeout(r, 120)); }
    try { return await fn(); } finally { if (dark && bg) bg.click(); }
  }
  function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  // pdf-lib je součástí prohlížeče (vykresy-assets), takže PDF jde i bez internetu
  const loadPdfLib = () => import('./vykresy-assets/es-D6cRSv4A.js').catch(() => { throw new Error('Knihovnu pro PDF se nepodařilo načíst.'); });

  async function exportView(kind) {
    try {
      if (kind === 'img') {
        const c = await snapshot(false);
        download(c.toDataURL('image/png'), fileBase() + '_poznamky.png');
        toast('Obrázek uložen do Stažených souborů.');
      } else if (kind === 'pdf') {
        const [lib, c] = await Promise.all([loadPdfLib(), withLightBg(() => snapshot(true))]);
        const doc = await lib.PDFDocument.create();
        const A4 = [841.89, 595.28], land = c.width >= c.height, pw = land ? A4[0] : A4[1], ph = land ? A4[1] : A4[0], m = 28;
        const jpg = await doc.embedJpg(await (await fetch(c.toDataURL('image/jpeg', 0.92))).arrayBuffer());
        const k = Math.min((pw - 2 * m) / c.width, (ph - 2 * m) / c.height), w = c.width * k, h = c.height * k;
        doc.addPage([pw, ph]).drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        doc.setTitle(fileBase() + ' – poznámky'); doc.setCreator('Prohlížeč výkresů');
        const url = URL.createObjectURL(new Blob([await doc.save()], { type: 'application/pdf' }));
        download(url, fileBase() + '_poznamky.pdf'); setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast('PDF uloženo do Stažených souborů.');
      } else if (kind === 'print') {
        const c = await withLightBg(() => snapshot(true));
        printBox.innerHTML = '';
        const im = new Image(); im.src = c.toDataURL('image/png'); im.alt = '';
        printBox.appendChild(im);
        await new Promise(r => (im.complete ? r() : (im.onload = r)));
        window.print();
      }
    } catch (err) { console.error(err); toast(err.message || 'Export se nepodařil.'); }
  }

  // ---------- napojení na zbytek prohlížeče ----------
  const fit = $('fitBtn');
  const sync = () => { btn.disabled = fit.disabled; if (fit.disabled && open) toggle(false); };
  new MutationObserver(sync).observe(fit, { attributes: true, attributeFilter: ['disabled'] });
  sync();
  const fn = $('fileName');
  if (fn) new MutationObserver(() => { shapes = []; draft = null; cancelEditor(); kick(); }).observe(fn, { childList: true, characterData: true, subtree: true });

  setColor(color); setWidth(wIdx); setTool(tool); updateBtn();
})();
