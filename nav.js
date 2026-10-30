// Horní menu s přepínáním mezi nástroji. Vkládá se do každého nástroje.
(function () {
  'use strict';
  if (window.self !== window.top) return;            // ne v náhledech na rozcestníku
  if (document.getElementById('ps-nav')) return;
  var TOOLS = [
    ['index.html', '⌂ Nástroje'],
    ['cp.html', 'Podací arch'],
    ['ocr.html', 'OCR a redigování'],
    ['text.html', 'Text z obrazovky'],
    ['redigovani.html', 'Ruční redigování'],
    ['sig.html', 'Podpis'],
    ['porovnani.html', 'Porovnání'],
    ['komprimace.html', 'Komprimace'],
    ['vykresy.html', 'Výkresy'],
    ['plany.html', 'Plány podlaží']
  ];
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var css = document.createElement('style');
  css.textContent =
    '#ps-nav{position:relative;z-index:1000;flex:none;background:#00532a;font:600 13px "DM Sans",Segoe UI,Arial,sans-serif;box-shadow:0 1px 0 rgba(0,0,0,.15)}' +
    '#ps-nav .in{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;padding:0 8px;-webkit-overflow-scrolling:touch}' +
    '#ps-nav .in::-webkit-scrollbar{display:none}' +
    '#ps-nav a{flex:none;color:rgba(255,255,255,.78);text-decoration:none;padding:9px 12px;border-bottom:3px solid transparent;white-space:nowrap;line-height:1.2}' +
    '#ps-nav a:hover{color:#fff;background:rgba(255,255,255,.08)}' +
    '#ps-nav a.on{color:#fff;border-bottom-color:#F27D00}' +
    '#ps-nav a.home{color:#fff}' +
    '#ps-zpet{display:none!important}' +
    '@media print{#ps-nav{display:none!important}}';
  document.head.appendChild(css);
  var nav = document.createElement('nav');
  nav.id = 'ps-nav';
  nav.setAttribute('aria-label', 'Nástroje');
  nav.innerHTML = '<div class="in">' + TOOLS.map(function (t) {
    var on = t[0] === here || (here === 'cp.html' && t[0] === 'cp.html');
    return '<a href="/' + t[0] + '"' + (on ? ' class="on" aria-current="page"' : '') + (t[0] === 'index.html' ? ' class="home"' : '') + '>' + t[1] + '</a>';
  }).join('') + '</div>';
  document.body.insertBefore(nav, document.body.firstChild);
  var on = nav.querySelector('a.on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
})();
