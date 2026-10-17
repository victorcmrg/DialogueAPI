'use strict';
/* NotEnoughDialogues - editor web de diálogos (grafo de balões). Sem dependências. */

// ============================================================
//  BÁSICO
// ============================================================
// token: do link (/ned web-editor) ou digitado na tela de entrada (fica só nesta aba)
let TOKEN = new URLSearchParams(location.search).get('s') || sessionStorage.getItem('ned-token') || '';
const apiUrl = (p) => '../api/' + p + (p.includes('?') ? '&' : '?') + 's=' + encodeURIComponent(TOKEN);
const $ = (s, root = document) => root.querySelector(s);
const NODE_W = 300, PORT_Y = 17, START_W = 170;

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') {
      // variáveis CSS (--hc) só funcionam com setProperty
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) e.style.setProperty(sk, sv);
        else e.style[sk] = sv;
      }
    }
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'disabled' || k === 'selected') e[k] = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  if (value !== undefined) e.value = value;
  return e;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ============================================================
//  CORES / TIPOS
// ============================================================
const OUT = {
  generic: { l: 'Genérico', c: '#3fbf6f', d: 'Vai direto para o próximo balão' },
  choice: { l: 'Escolha', c: '#e0473d', d: 'O jogador escolhe uma das opções' },
  random: { l: 'Aleatório', c: '#e8c33a', d: 'Sorteia um dos balões ligados' },
  end: { l: 'Fim', c: '#6b7280', d: 'Termina o diálogo' },
  dialogue: { l: 'Outro diálogo', c: '#a06bff', d: 'Termina e começa outro diálogo' },
};
const OPS = [['==', '='], ['!=', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['contains', 'contém']];
const REQ = {
  item: { l: 'Item necessário', c: '#ff9f43', f: [['material', 'text', 'apple', 'Material'], ['amount', 'num', 1, 'Quantidade'],
    ['custom-model-data', 'text', '', 'Custom model'], ['itemsadder', 'text', '', 'ItemsAdder id'], ['name', 'text', '', 'Nome contém'],
    ['where', 'sel', [['inventory', 'Inventário'], ['hand', 'Mão principal'], ['offhand', 'Mão secundária']], 'Onde'],
    ['take', 'chk', false, 'Remover os itens']] },
  level: { l: 'Nível mínimo', c: '#3ec7e0', f: [['min', 'num', 10, 'Nível']] },
  money: { l: 'Pagar para entrar', c: '#f5c542', f: [['amount', 'num', 100, 'Valor'], ['take', 'chk', true, 'Cobrar ao entrar']] },
  permission: { l: 'Permissão', c: '#b48cff', f: [['permission', 'text', '', 'Permissão']] },
  flag: { l: 'Flag', c: '#2dd4bf', f: [['flag', 'text', '', 'Flag'], ['operator', 'sel', OPS, 'Operador'], ['value', 'text', '', 'Valor']] },
  completed: { l: 'Já completou', c: '#8bd450', f: [['dialogue', 'dlg', '', 'Diálogo']] },
  'not-completed': { l: 'Não completou', c: '#d4a050', f: [['dialogue', 'dlg', '', 'Diálogo']] },
  chance: { l: 'Chance', c: '#ff6fae', f: [['percent', 'num', 50, '% de entrar']] },
  'xp-level': { l: 'Nível de XP', c: '#7dd3fc', f: [['min', 'num', 5, 'Nível XP']] },
  world: { l: 'Mundo', c: '#94a3b8', f: [['world', 'text', 'world', 'Mundo']] },
  placeholder: { l: 'Placeholder', c: '#c084fc', f: [['placeholder', 'text', '%player_level%', 'Placeholder'], ['operator', 'sel', OPS, 'Operador'], ['value', 'text', '', 'Valor']] },
};
const ACTIONS = {
  give: { l: 'Dar item', f: ['Item', 'Qtd'], d: ['minecraft:diamond', '1'], re: /^\[give\]\s+(\S+)(?:\s+(\d+))?\s*$/i, b: (v) => `[give] ${v[0]} ${v[1] || 1}` },
  points: { l: 'Dar pontos', f: ['Pontos'], d: ['10'], re: /^\[points\]\s+(\S+)\s*$/i, b: (v) => `[points] ${v[0]}` },
  moneyGive: { l: 'Dar dinheiro', f: ['Valor'], d: ['100'], re: /^\[money\]\s+give\s+(\S+)\s*$/i, b: (v) => `[money] give ${v[0]}` },
  moneyTake: { l: 'Cobrar dinheiro', f: ['Valor'], d: ['100'], re: /^\[money\]\s+take\s+(\S+)\s*$/i, b: (v) => `[money] take ${v[0]}` },
  flagSet: { l: 'Definir flag', f: ['Flag', 'Valor'], d: ['', 'true'], re: /^\[flag\]\s+set\s+(\S+)\s*(.*)$/i, b: (v) => `[flag] set ${v[0]} ${v[1] || 'true'}` },
  flagAdd: { l: 'Somar flag', f: ['Flag', 'Quanto'], d: ['', '1'], re: /^\[flag\]\s+add\s+(\S+)\s*(.*)$/i, b: (v) => `[flag] add ${v[0]} ${v[1] || 1}` },
  flagDel: { l: 'Apagar flag', f: ['Flag'], d: [''], re: /^\[flag\]\s+remove\s+(\S+)\s*$/i, b: (v) => `[flag] remove ${v[0]}` },
  sound: { l: 'Tocar som', f: ['Som', 'Volume', 'Tom'], d: ['minecraft:entity.player.levelup', '1', '1'], re: /^\[sound\]\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?\s*$/i, b: (v) => `[sound] ${v[0]} ${v[1] || 1} ${v[2] || 1}` },
  message: { l: 'Mensagem no chat', f: ['Texto'], d: [''], re: /^\[message\]\s*(.*)$/i, b: (v) => `[message] ${v[0]}` },
  player: { l: 'Comando do jogador', f: ['Comando'], d: [''], re: /^\[player\]\s*(.*)$/i, b: (v) => `[player] ${v[0]}` },
  console: { l: 'Comando do console', f: ['Comando'], d: [''], re: /^(?:\[console\]\s*)?(.*)$/i, b: (v) => v[0] },
};
const ACTION_ORDER = ['give', 'points', 'moneyGive', 'moneyTake', 'flagSet', 'flagAdd', 'flagDel', 'sound', 'message', 'player', 'console'];

function parseAction(str) {
  for (const k of ACTION_ORDER) {
    const m = ACTIONS[k].re.exec(str || '');
    if (m) return { k, v: m.slice(1).map((x) => x || '') };
  }
  return { k: 'console', v: [str || ''] };
}

// ============================================================
//  CÓDIGOS DE COR (&a, &l, &#RRGGBB)
// ============================================================
const MC = { 0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA', 4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA',
  8: '#555555', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };
// Efeitos do core shader do pack: <shake>texto</shake> e <wave>texto</wave> (letras brancas animadas)
const FX_TAGS = { '<shake>': 'shake', '</shake>': null, '<wave>': 'wave', '</wave>': null };
function mcHtml(text, base = '#FFFFFF') {
  let out = '', buf = '', color = base, bold = false, italic = false, under = false, strike = false, fx = null, fxIndex = 0;
  const flush = () => {
    if (!buf) return;
    const deco = (under ? 'underline ' : '') + (strike ? 'line-through' : '');
    let inner = esc(buf);
    if (fx) {
      // uma <span> por letra: cada uma com seu atraso (onda em "S") ou seu tremor
      inner = [...buf].map((ch) => {
        const i = fxIndex++;
        const delay = fx === 'wave' ? -(1 - ((i * 0.09) % 1)) : -((i * 0.137) % 0.3); // onda: cada letra um pouco atrás da anterior
        return ch === ' ' ? ' ' : `<span class="fx-${fx}${fx === 'shake' ? ' s' + (i % 4) : ''}" style="animation-delay:${delay.toFixed(2)}s">${esc(ch)}</span>`;
      }).join('');
    }
    out += `<span style="color:${fx ? '#FFFFFF' : color};${bold ? 'font-weight:700;' : ''}${italic ? 'font-style:italic;' : ''}${deco ? 'text-decoration:' + deco + ';' : ''}">${inner}</span>`;
    buf = '';
  };
  const t = String(text || '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '<') {
      const tag = Object.keys(FX_TAGS).find((k) => t.substr(i, k.length).toLowerCase() === k);
      if (tag) { flush(); fx = FX_TAGS[tag]; i += tag.length - 1; continue; }
    }
    if ((c === '&' || c === '§') && i + 1 < t.length) {
      const n = t[i + 1].toLowerCase();
      if (n === '#' && /^[0-9a-f]{6}$/i.test(t.substr(i + 2, 6))) { flush(); color = '#' + t.substr(i + 2, 6); bold = italic = under = strike = false; i += 7; continue; }
      if (MC[n]) { flush(); color = MC[n]; bold = italic = under = strike = false; i++; continue; }
      if ('lonmkr'.includes(n)) {
        flush();
        if (n === 'l') bold = true; else if (n === 'o') italic = true; else if (n === 'n') under = true;
        else if (n === 'm') strike = true; else if (n === 'r') { color = base; fx = null; bold = italic = under = strike = false; }
        i++; continue;
      }
    }
    buf += c;
  }
  flush();
  return out || '<span style="color:#555">(vazio)</span>';
}

// ============================================================
//  ESTADO
// ============================================================
const S = {
  dialogues: [], speakers: {}, skins: [], animations: [], deleted: [], defaultPitch: 1,
  cur: null,            // diálogo aberto {id, oldId, file, data}
  sel: null,            // {k:'node',id} | {k:'link',from,i} | {k:'start'}
  dirty: false,
  views: {},            // id -> {x,y,z}
};
const view = { x: 200, y: 200, z: 1 };

function markDirty() {
  if (!S.dirty) { S.dirty = true; renderSidebar(); }
  setStatus('Alterações não salvas', 'dirty');
}
function setStatus(text, cls = '') {
  const s = $('#status');
  s.textContent = text;
  s.className = 'status ' + cls;
}

const nodes = () => S.cur.data.nodes || (S.cur.data.nodes = {});
const isGated = (n) => !!(n && n.input && Array.isArray(n.input.requirements) && n.input.requirements.length);
const outType = (n) => (n.output && n.output.type) || 'end';
function links(n) {
  if (!n.output) n.output = { type: 'end', links: [] };
  if (!Array.isArray(n.output.links)) n.output.links = [];
  return n.output.links;
}

// ============================================================
//  ROSTO DAS SKINS
// ============================================================
const faceCache = {};
function defaultFace() {
  if (faceCache.__default) return faceCache.__default;
  // rosto genérico 8x8 (cabelo, pele, olhos)
  const rows = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'SSSSSSSS', 'SWBSSBWS', 'SSSssSSS', 'SSMMMMSS', 'SsSSSSsS'];
  const pal = { H: '#3b2a1a', S: '#c49a72', s: '#a87d5a', W: '#f2f2f2', B: '#3b5aa8', M: '#7a4a3a' };
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }));
  return (faceCache.__default = c.toDataURL());
}
/** Rosto 8x8 (cara + chapéu). Em skins antigas 64x32 o chapéu todo opaco é ignorado, como no Minecraft. */
function drawFace(img, g) {
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
  if (img.height === 32) {
    const t = document.createElement('canvas'); t.width = 32; t.height = 16;
    const tg = t.getContext('2d');
    tg.drawImage(img, 32, 0, 32, 16, 0, 0, 32, 16);
    const px = tg.getImageData(0, 0, 32, 16).data;
    let transparent = false;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 128) { transparent = true; break; }
    if (!transparent) return;
  }
  g.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
}
/** Skin "player": a de quem está vendo o diálogo (cada jogador vê a própria). Rosto genérico com "?". */
const PLAYER_SKIN = 'player';
function playerFace() {
  if (faceCache.__player) return faceCache.__player;
  const rows = ['GGGGGGGG', 'GDDDDDDG', 'GDDWWDDG', 'GDDDDWDG', 'GDDDWDDG', 'GDDDDDDG', 'GDDDWDDG', 'GGGGGGGG'];
  const pal = { G: '#3a6df0', D: '#1b2a55', W: '#ffffff' };
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }));
  return (faceCache.__player = c.toDataURL());
}
function skinLabel(name) {
  if (!name) return '';
  if (String(name).toLowerCase() === PLAYER_SKIN) return 'player (quem vê o diálogo)';
  return name + (isSavedSkin(name) ? '' : ' (nick/link)');
}
function loadFace(name) {
  if (!name) return Promise.resolve(defaultFace());
  if (String(name).toLowerCase() === PLAYER_SKIN) return Promise.resolve(playerFace());
  if (faceCache[name]) return faceCache[name];
  faceCache[name] = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 8;
      drawFace(img, c.getContext('2d'));
      resolve(c.toDataURL());
    };
    img.onerror = () => resolve(defaultFace());
    img.src = apiUrl('skin?name=' + encodeURIComponent(name));
  });
  return faceCache[name];
}
function faceEl(name, cls = 'face', onclick) {
  const img = el('img', { alt: '' });
  img.src = defaultFace();
  loadFace(name).then((src) => { img.src = src; });
  return el('div', { class: cls, title: skinLabel(name) || 'Skin padrão (clique para escolher)', onclick }, img);
}
function isSavedSkin(name) {
  return !!name && S.skins.some((s) => s.name === String(name).toLowerCase());
}
function effectiveSkin(node) {
  if (node.skin) return node.skin;
  const sp = node.speaker || S.cur.data.speaker;
  if (sp && S.speakers[sp] && S.speakers[sp].skin) return S.speakers[sp].skin;
  if (sp === PLAYER_SKIN) return PLAYER_SKIN; // speaker "player" usa a skin de quem vê
  return '';
}

// ============================================================
//  CARREGAR / SALVAR
// ============================================================
/** Lê a resposta da API; se não vier JSON (erro da hospedagem, proxy...), mostra o texto que veio. */
async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(`o servidor não respondeu em JSON (HTTP ${res.status})${clean ? ': ' + clean : ''}`);
  }
}

async function loadState(keepId) {
  setStatus('Carregando...');
  const res = await fetch(apiUrl('state'));
  const json = await readJson(res);
  if (!res.ok || json.ok === false) throw new Error(json.error || res.status);
  S.dialogues = json.dialogues.map((d) => ({ id: d.id, oldId: d.id, file: d.file, data: d.data }));
  S.speakers = json.speakers || {};
  S.skins = json.skins || [];
  S.animations = json.animations || [];
  S.defaultPitch = json.defaultPitch || 1;
  S.deleted = [];
  S.dirty = false;
  for (const k of Object.keys(faceCache)) if (!k.startsWith('__')) delete faceCache[k];
  renderSidebar();
  const again = keepId && S.dialogues.find((d) => d.id === keepId);
  if (again) openDialogue(again, true);
  else if (S.dialogues.length && !S.cur) openDialogue(S.dialogues[0]);
  else if (!S.dialogues.length) { S.cur = null; renderAll(); }
  setStatus('Tudo salvo', 'ok');
}

function cleanForSave(v) {
  if (Array.isArray(v)) return v.map(cleanForSave);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('_') || val === undefined || val === null || val === '') continue;
      if (Array.isArray(val) && !val.length && k !== 'links') continue;
      o[k] = cleanForSave(val);
    }
    return o;
  }
  return v;
}

async function saveAll() {
  setStatus('Salvando...');
  const payload = {
    dialogues: S.dialogues.map((d) => ({ id: d.id, oldId: d.oldId, data: cleanForSave(d.data) })),
    deleted: S.deleted,
    speakers: cleanForSave(S.speakers),
  };
  try {
    const res = await fetch(apiUrl('save'), { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(json.error || res.status);
    const keep = S.cur && S.cur.id;
    S.cur = null;
    await loadState(keep);
    setStatus(`Salvo! ${json.saved} diálogos gravados e recarregados no servidor`, 'ok');
  } catch (e) {
    setStatus('Erro ao salvar: ' + e.message, 'err');
  }
}

// ============================================================
//  BARRA LATERAL
// ============================================================
function renderSidebar() {
  const q = $('#dialogue-search').value.toLowerCase();
  const list = $('#dialogue-list');
  list.innerHTML = '';
  for (const d of S.dialogues) {
    if (q && !d.id.toLowerCase().includes(q)) continue;
    const count = Object.keys(d.data.nodes || {}).length;
    list.append(el('li', { class: S.cur === d ? 'active' : '', onclick: () => openDialogue(d) },
      el('span', { class: 'dot', style: { background: d.data.once ? '#e8c33a' : '#3e90ff' } }),
      el('div', {}, el('div', {}, d.id), el('div', { class: 'file' }, d.file || 'novo')),
      el('span', { class: 'count' }, count)));
  }
  renderSkinTab();
  renderSpeakerTab();
}

function renderSkinTab() {
  const grid = $('#skin-grid');
  grid.innerHTML = '';
  for (const s of S.skins) {
    grid.append(el('div', { class: 'skin-cell', title: s.name },
      faceEl(s.name),
      el('span', {}, s.name + (s.slim ? ' (fino)' : '')),
      el('button', { class: 'del', title: 'Apagar skin', onclick: (e) => { e.stopPropagation(); deleteSkin(s.name); } }, '✕')));
  }
  grid.append(el('div', { class: 'skin-cell add', onclick: () => openUpload() }, el('div', { class: 'face' }, '+'), el('span', {}, 'Adicionar')));
}

async function deleteSkin(name) {
  if (!confirm(`Apagar a skin "${name}" do servidor?`)) return;
  await fetch(apiUrl('skin-delete'), { method: 'POST', body: JSON.stringify({ name }) });
  S.skins = S.skins.filter((s) => s.name !== name);
  delete faceCache[name];
  renderSkinTab();
  if (S.cur) renderGraph();
}

function speakerOptions(includeDefault, defLabel) {
  const opts = [];
  if (includeDefault) opts.push(['', defLabel || '(padrão do diálogo)']);
  for (const id of Object.keys(S.speakers)) opts.push([id, id]);
  opts.push(['player', 'player (o jogador)']);
  return opts;
}

function renderSpeakerTab() {
  const box = $('#speaker-list');
  box.innerHTML = '';
  for (const [id, sp] of Object.entries(S.speakers)) {
    const card = el('div', { class: 'speaker-card' });
    const preview = el('div', { class: 'preview', html: mcHtml(sp.name || id) });
    card.append(
      el('div', { class: 'top' },
        faceEl(sp.skin, 'face', (e) => openSkinDrawer(e.currentTarget, sp.skin, (name) => { sp.skin = name || undefined; markDirty(); renderSpeakerTab(); if (S.cur) renderGraph(); })),
        el('strong', { style: { flex: 1 } }, id),
        el('button', { class: 'btn ghost small', title: 'Apagar speaker', onclick: () => { if (confirm(`Apagar o speaker "${id}"?`)) { delete S.speakers[id]; markDirty(); renderSpeakerTab(); } } }, '🗑')),
      field('Nome', inputText(sp, 'name', { placeholder: id, oninput: () => { preview.innerHTML = mcHtml(sp.name || id); } })),
      preview,
      field('Tom', pitchControl(sp, 'voice-pitch')),
      field('Animação', selectBound(sp, 'animation', [['', '(padrão)'], ...S.animations.map((a) => [a, a])])),
      field('Skin', el('div', { class: 'muted' }, sp.skin ? skinLabel(sp.skin) : 'nenhuma (sem modelo)')));
    box.append(card);
  }
}

// ============================================================
//  CANVAS: VISTA, PAN, ZOOM
// ============================================================
const canvas = $('#canvas'), world = $('#world'), wires = $('#wires'), nodesBox = $('#nodes');

function applyView() {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  const big = 160 * view.z, small = 32 * view.z;
  canvas.style.backgroundSize = `${big}px ${big}px, ${big}px ${big}px, ${small}px ${small}px, ${small}px ${small}px`;
  canvas.style.backgroundPosition = Array(4).fill(`${view.x}px ${view.y}px`).join(', ');
  $('#zoom-badge').textContent = Math.round(view.z * 100) + '%';
  if (S.cur) S.views[S.cur.id] = { ...view };
}
function toWorld(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return [(cx - r.left - view.x) / view.z, (cy - r.top - view.y) / view.z];
}
function isBackground(t) {
  return t === canvas || t === world || t === nodesBox || t === wires || t.id === 'empty';
}

let drag = null; // {k:'pan'|'node'|'link', ...}

canvas.addEventListener('mousedown', (e) => {
  closeFloating();
  if (e.button === 1 || (e.button === 0 && isBackground(e.target))) {
    drag = { k: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    canvas.classList.add('panning');
    e.preventDefault();
  }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const z = Math.min(2, Math.max(0.2, view.z * Math.exp(-e.deltaY * 0.0015)));
  view.x = mx - (mx - view.x) * (z / view.z);
  view.y = my - (my - view.y) * (z / view.z);
  view.z = z;
  applyView();
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!S.cur) return;
  const nodeEl = e.target.closest('.node');
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  if (nodeEl && nodeEl.dataset.id !== '__start') {
    const id = nodeEl.dataset.id;
    contextMenu(e.clientX, e.clientY, [
      ['Duplicar balão', () => duplicateNode(id)],
      ['Ligar o Início neste balão', () => { S.cur.data.start.next = id; markDirty(); drawWires(); }],
      ['Excluir balão', () => deleteNode(id)],
    ]);
  } else {
    contextMenu(e.clientX, e.clientY, [
      ['＋ Novo balão aqui', () => addNode(wx, wy)],
      ['⌖ Centralizar', () => centerView()],
    ]);
  }
});

window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  if (drag.k === 'pan') {
    view.x = drag.vx + e.clientX - drag.sx;
    view.y = drag.vy + e.clientY - drag.sy;
    drag.moved = drag.moved || Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3;
    applyView();
  } else if (drag.k === 'node') {
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const x = Math.round((wx - drag.ox) / 8) * 8, y = Math.round((wy - drag.oy) / 8) * 8;
    drag.target.pos = [x, y];
    drag.el.style.left = x + 'px';
    drag.el.style.top = y + 'px';
    drag.moved = true;
    scheduleWires();
  } else if (drag.k === 'link') {
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    drag.mx = wx; drag.my = wy;
    drawTemp();
  }
});
window.addEventListener('mouseup', (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  canvas.classList.remove('panning');
  if (d.k === 'pan' && !d.moved && isBackground(e.target)) select(null);
  if (d.k === 'node' && d.moved) markDirty();
  if (d.k === 'link') {
    $('#temp-wire')?.remove();
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = target && target.closest && target.closest('.node');
    if (nodeEl && nodeEl.dataset.id !== '__start' && nodeEl.dataset.id !== d.from) {
      connect(d.from, nodeEl.dataset.id);
    } else if (target && isBackground(target)) {
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      const id = addNode(wx, wy - PORT_Y, true);
      connect(d.from, id);
    }
  }
});

function centerView() {
  if (!S.cur) return;
  const pts = Object.values(nodes()).map((n) => n.pos || [0, 0]);
  pts.push(S.cur.data.start.pos || [0, 0]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + NODE_W, minY = Math.min(...ys), maxY = Math.max(...ys) + 240;
  const r = canvas.getBoundingClientRect();
  const z = Math.min(1.1, Math.max(0.25, Math.min(r.width / (maxX - minX + 160), r.height / (maxY - minY + 160))));
  view.z = z;
  view.x = r.width / 2 - ((minX + maxX) / 2) * z;
  view.y = r.height / 2 - ((minY + maxY) / 2) * z;
  applyView();
}

// ============================================================
//  DIÁLOGO / BALÕES
// ============================================================
function openDialogue(d, keepView) {
  S.cur = d;
  S.sel = null;
  if (!d.data.start) d.data.start = { pos: [-420, 0] };
  if (!d.data.start.pos) d.data.start.pos = [-420, 0];
  if (!d.data.nodes) d.data.nodes = {};
  renderAll();
  if (keepView && S.views[d.id]) { Object.assign(view, S.views[d.id]); applyView(); }
  else if (S.views[d.id]) { Object.assign(view, S.views[d.id]); applyView(); }
  else centerView();
}

function renderAll() {
  renderSidebar();
  renderCrumbs();
  renderGraph();
  renderInspector();
}

function renderCrumbs() {
  const c = $('#crumbs');
  c.innerHTML = '';
  if (!S.cur) return;
  const input = el('input', { type: 'text', value: S.cur.id, title: 'ID do diálogo (usado no /ned start)', size: Math.max(8, S.cur.id.length + 2) });
  input.addEventListener('change', () => renameDialogue(input.value.trim(), input));
  c.append(el('span', {}, 'Diálogos ›'), input, el('span', { class: 'muted' }, '/ned start ' + S.cur.id));
}

function renameDialogue(id, input) {
  if (!/^[A-Za-z0-9_.-]+$/.test(id) || S.dialogues.some((d) => d !== S.cur && d.id === id)) {
    alert('ID inválido ou já usado (use letras, números, _ . -)');
    input.value = S.cur.id;
    return;
  }
  delete S.views[S.cur.id];
  S.cur.id = id;
  markDirty();
  renderAll();
}

function newId() {
  const n = nodes();
  let i = Object.keys(n).length + 1;
  while (n['b' + i]) i++;
  return 'b' + i;
}

function addNode(x, y, silent) {
  if (!S.cur) return null;
  const id = newId();
  nodes()[id] = { pos: [Math.round(x / 8) * 8, Math.round(y / 8) * 8], text: '', output: { type: 'end', links: [] } };
  if (!S.cur.data.start.next) S.cur.data.start.next = id;
  markDirty();
  renderGraph();
  if (!silent) select({ k: 'node', id });
  else select({ k: 'node', id });
  return id;
}

function duplicateNode(id) {
  const src = nodes()[id];
  const copy = clone(src);
  const nid = newId();
  copy.pos = [src.pos[0] + 40, src.pos[1] + 40];
  copy.output = { ...copy.output, links: [] };
  if (copy.output.type !== 'dialogue') copy.output.type = 'end';
  nodes()[nid] = copy;
  markDirty();
  renderGraph();
  select({ k: 'node', id: nid });
}

function deleteNode(id) {
  delete nodes()[id];
  for (const n of Object.values(nodes())) {
    const ls = links(n);
    for (let i = ls.length - 1; i >= 0; i--) if (ls[i].to === id) ls.splice(i, 1);
    if (n.output.type === 'generic' && !ls.length) n.output.type = 'end';
  }
  if (S.cur.data.start.next === id) delete S.cur.data.start.next;
  S.sel = null;
  markDirty();
  renderGraph();
  renderInspector();
}

function renameNode(oldId, newIdStr, input) {
  if (!/^[A-Za-z0-9_.-]+$/.test(newIdStr) || nodes()[newIdStr]) {
    alert('ID inválido ou já usado');
    input.value = oldId;
    return;
  }
  const n = nodes();
  const rebuilt = {};
  for (const [k, v] of Object.entries(n)) rebuilt[k === oldId ? newIdStr : k] = v;
  S.cur.data.nodes = rebuilt;
  for (const v of Object.values(rebuilt)) for (const l of links(v)) if (l.to === oldId) l.to = newIdStr;
  if (S.cur.data.start.next === oldId) S.cur.data.start.next = newIdStr;
  S.sel = { k: 'node', id: newIdStr };
  markDirty();
  renderGraph();
  renderInspector();
}

function connect(from, to) {
  if (from === '__start') {
    S.cur.data.start.next = to;
  } else {
    const n = nodes()[from];
    const ls = links(n);
    const t = outType(n);
    if (t === 'end' || t === 'dialogue') n.output.type = 'generic';
    if (n.output.type === 'generic') {
      n.output.links = [{ to }];
    } else if (!ls.some((l) => l.to === to)) {
      ls.push({ to, text: '', weight: 1 });
    }
    assignPriorities();
  }
  markDirty();
  renderGraph();
  renderInspector();
}

function removeLink(from, i) {
  if (from === '__start') delete S.cur.data.start.next;
  else {
    const n = nodes()[from];
    links(n).splice(i, 1);
    if (n.output.type === 'generic' && !links(n).length) n.output.type = 'end';
  }
  S.sel = null;
  markDirty();
  renderGraph();
  renderInspector();
}

/**
 * Prioridade das entradas com requisito: quando uma saída com várias ligações tem 2+ destinos com requisito,
 * cada um desses destinos ganha uma caixa de prioridade (1 = maior). Valores faltando são preenchidos.
 */
function priorityTargets() {
  const out = new Set();
  for (const n of Object.values(nodes())) {
    const t = outType(n);
    if (t !== 'random' && t !== 'choice') continue;
    const gated = links(n).map((l) => l.to).filter((id) => isGated(nodes()[id]));
    if (gated.length >= 2) gated.forEach((id) => out.add(id));
  }
  return out;
}
function assignPriorities() {
  const targets = priorityTargets();
  let used = new Set([...targets].map((id) => nodes()[id].input.priority).filter(Boolean));
  for (const id of targets) {
    const inp = nodes()[id].input;
    if (!inp.priority) {
      let p = 1;
      while (used.has(p)) p++;
      inp.priority = p;
      used.add(p);
    }
  }
}

// ---------- desenho dos balões ----------
let nodeEls = {};
function renderGraph() {
  nodesBox.innerHTML = '';
  nodeEls = {};
  $('#empty').classList.toggle('hidden', !!S.cur);
  if (!S.cur) { wires.innerHTML = ''; return; }
  assignPriorities();
  nodesBox.append(startEl());
  for (const id of Object.keys(nodes())) nodesBox.append(nodeEl(id));
  drawWires(true);
  applyView();
}

function startEl() {
  const st = S.cur.data.start;
  const e = el('div', { class: 'node start' + (S.sel && S.sel.k === 'start' ? ' sel' : ''), 'data-id': '__start',
      style: { left: st.pos[0] + 'px', top: st.pos[1] + 'px', '--hc': 'var(--start)' } },
    el('div', { class: 'node-head' }, el('span', { class: 'id' }, '▶ Início'), el('span', { class: 'tag' }, 'start')),
    el('div', { class: 'node-body' }, st.next ? 'Liga no primeiro balão' : 'Arraste o ponto → até o primeiro balão'),
    portOut('__start', 'var(--start)'));
  hookDrag(e, st, '__start');
  nodeEls.__start = e;
  return e;
}

function portOut(id, color) {
  const p = el('div', { class: 'port out', style: { '--pc': color }, title: 'Arraste para ligar' });
  p.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    drag = { k: 'link', from: id, mx: wx, my: wy };
  });
  return p;
}

function hookDrag(e, target, id) {
  const head = e.querySelector('.node-head');
  head.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    closeFloating();
    const [wx, wy] = toWorld(ev.clientX, ev.clientY);
    drag = { k: 'node', target, el: e, ox: wx - target.pos[0], oy: wy - target.pos[1], moved: false };
  });
  e.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    if (id === '__start') select({ k: 'start' });
    else if (!S.sel || S.sel.k !== 'node' || S.sel.id !== id) select({ k: 'node', id });
  });
}

function nodeEl(id) {
  const n = nodes()[id];
  if (!n.pos) n.pos = [0, 0];
  const t = outType(n);
  const color = OUT[t].c;
  const gated = isGated(n);
  const firstReq = gated ? REQ[n.input.requirements[0].type] : null;
  const inColor = firstReq ? firstReq.c : '#9aa0aa';

  const preview = el('div', { class: 'preview', html: mcHtml(n.text) });
  const ta = el('textarea', { rows: 3, placeholder: 'Texto do balão (aceita &a, &l, &#RRGGBB)', value: n.text || '' });
  ta.addEventListener('input', () => {
    n.text = ta.value;
    preview.innerHTML = mcHtml(n.text);
    const it = $('#insp-text');
    if (it && document.activeElement !== it) it.value = n.text;
    const ip = $('#insp-preview');
    if (ip) ip.innerHTML = mcHtml(n.text);
    markDirty();
  });
  ta.addEventListener('mousedown', (e) => e.stopPropagation());

  const spSel = el('select', { title: 'Quem fala' }, speakerOptions(true, '(speaker do diálogo)').map(([v, l]) => el('option', { value: v }, l)));
  spSel.value = n.speaker || '';
  spSel.addEventListener('change', () => { n.speaker = spSel.value || undefined; markDirty(); refreshNode(id); renderInspector(); });
  spSel.addEventListener('mousedown', (e) => e.stopPropagation());

  const chips = el('div', { class: 'chips' });
  if (n.animation) chips.append(el('span', { class: 'chip' }, '🎬 ' + n.animation));
  if (n.pitch !== undefined) chips.append(el('span', { class: 'chip' }, '♪ ' + Number(n.pitch).toFixed(2)));
  if (n.speed !== undefined) chips.append(el('span', { class: 'chip' }, '⏱ ' + n.speed));
  if (n['auto-next']) chips.append(el('span', { class: 'chip' }, '⏭ ' + n['auto-next'] + 't'));
  if (gated) for (const r of n.input.requirements) {
    const def = REQ[r.type] || { l: r.type, c: '#999' };
    chips.append(el('span', { class: 'chip c', style: { background: def.c } }, def.l));
  }
  if ((n.commands || []).length) chips.append(el('span', { class: 'chip' }, '⚡ ' + n.commands.length + ' gatilho(s)'));
  if (t === 'dialogue' && n.output.dialogue) chips.append(el('span', { class: 'chip c', style: { background: OUT.dialogue.c } }, '→ ' + n.output.dialogue));

  const portIn = el('div', { class: 'port in' + (gated ? ' gated' : ''), style: { '--pc': inColor }, title: gated ? 'Entrada com requisito' : 'Entrada' });
  const e = el('div', { class: 'node' + (S.sel && S.sel.k === 'node' && S.sel.id === id ? ' sel' : ''), 'data-id': id,
      style: { left: n.pos[0] + 'px', top: n.pos[1] + 'px', '--hc': color } },
    el('div', { class: 'node-head' },
      el('span', { class: 'id' }, id + (S.cur.data.start.next === id ? '  ★' : '')),
      el('span', { class: 'tag' }, OUT[t].l)),
    el('div', { class: 'node-body' },
      el('div', { class: 'node-row' },
        faceEl(effectiveSkin(n), 'face', (ev) => {
          ev.stopPropagation();
          openSkinDrawer(ev.currentTarget, n.skin, (name) => { n.skin = name || undefined; markDirty(); refreshNode(id); renderInspector(); });
        }),
        spSel),
      ta, preview, chips.childNodes.length ? chips : null),
    portIn,
    gated ? el('div', { class: 'in-label', style: { background: inColor } }, firstReq ? firstReq.l : 'Requisito') : null,
    t !== 'end' && t !== 'dialogue' ? portOut(id, color) : portOut(id, '#6b7280'));

  if (gated && priorityTargets().has(id)) {
    const pr = el('input', { type: 'number', min: 1, value: n.input.priority || 1, title: '1 = maior prioridade' });
    pr.addEventListener('mousedown', (ev) => ev.stopPropagation());
    pr.addEventListener('input', () => { n.input.priority = Math.max(1, parseInt(pr.value || '1', 10)); markDirty(); });
    e.append(el('div', { class: 'priority', title: 'Prioridade desta entrada (1 = maior)' }, 'prio', pr));
    e.querySelector('.in-label')?.remove();
  }
  hookDrag(e, n, id);
  nodeEls[id] = e;
  return e;
}

function refreshNode(id) {
  const old = nodeEls[id];
  if (!old) return;
  const fresh = id === '__start' ? startEl() : nodeEl(id);
  old.replaceWith(fresh);
  drawWires(true);
}

// ---------- linhas ----------
let wireRaf = 0;
function scheduleWires() {
  if (wireRaf) return;
  wireRaf = requestAnimationFrame(() => { wireRaf = 0; drawWires(false); });
}
function portPos(id, side) {
  if (id === '__start') {
    const p = S.cur.data.start.pos;
    return [p[0] + (side === 'out' ? START_W : 0), p[1] + PORT_Y];
  }
  const n = nodes()[id];
  if (!n) return null;
  return [n.pos[0] + (side === 'out' ? NODE_W : 0), n.pos[1] + PORT_Y];
}
function curve(a, b) {
  const dx = Math.max(70, Math.abs(b[0] - a[0]) * 0.5);
  return `M ${a[0]} ${a[1]} C ${a[0] + dx} ${a[1]}, ${b[0] - dx} ${b[1]}, ${b[0]} ${b[1]}`;
}
function allLinks() {
  const out = [];
  const st = S.cur.data.start;
  if (st.next && nodes()[st.next]) out.push({ from: '__start', i: 0, to: st.next, type: 'start', link: null });
  for (const [id, n] of Object.entries(nodes())) {
    const t = outType(n);
    if (t === 'end' || t === 'dialogue') continue;
    links(n).forEach((l, i) => { if (nodes()[l.to]) out.push({ from: id, i, to: l.to, type: t, link: l }); });
  }
  return out;
}

const labelEls = {};
function drawWires(full) {
  if (!S.cur) return;
  wires.innerHTML = '';
  const ls = allLinks();
  const keys = new Set();
  for (const w of ls) {
    const a = portPos(w.from, 'out'), b = portPos(w.to, 'in');
    if (!a || !b) continue;
    const color = w.type === 'start' ? '#3e90ff' : OUT[w.type].c;
    const sel = S.sel && S.sel.k === 'link' && S.sel.from === w.from && S.sel.i === w.i;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', curve(a, b));
    path.setAttribute('class', 'wire' + (sel ? ' sel' : ''));
    path.setAttribute('stroke', color);
    path.style.color = color;
    path.addEventListener('mousedown', (e) => { e.stopPropagation(); select({ k: 'link', from: w.from, i: w.i }); });
    wires.append(path);

    // rótulo no meio da linha
    const key = `${w.from}|${w.i}|${w.type}|${w.to}`;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const want = w.type === 'choice' || w.type === 'random' || sel;
    if (!want) continue;
    keys.add(key);
    let lab = labelEls[key];
    if (!lab || full) {
      lab?.remove();
      lab = labelFor(w, color);
      labelEls[key] = lab;
      nodesBox.append(lab);
    }
    lab.style.left = mid[0] + 'px';
    lab.style.top = mid[1] + 'px';
    if (w.type === 'random') updateRandomPct(w.from);
  }
  for (const [k, lab] of Object.entries(labelEls)) {
    if (!keys.has(k) || !lab.isConnected) { lab.remove(); delete labelEls[k]; }
  }
}

function labelFor(w, color) {
  const del = el('button', { class: 'x', title: 'Remover ligação', onclick: (e) => { e.stopPropagation(); removeLink(w.from, w.i); } }, '✕');
  const stop = (e) => e.stopPropagation();
  if (w.type === 'choice') {
    const input = el('input', { type: 'text', value: w.link.text || '', placeholder: 'Texto da opção' });
    input.addEventListener('input', () => { w.link.text = input.value; markDirty(); });
    input.addEventListener('mousedown', stop);
    return el('div', { class: 'link-label', style: { '--lc': color }, onmousedown: stop }, input, del);
  }
  if (w.type === 'random') {
    const n = nodes()[w.from];
    if (n.output.mode === 'manual') {
      const input = el('input', { type: 'number', class: 'w', min: 0, value: w.link.weight ?? 1, title: 'Peso (chance relativa)' });
      input.addEventListener('input', () => { w.link.weight = Math.max(0, parseFloat(input.value || '0')); markDirty(); updateRandomPct(w.from); });
      input.addEventListener('mousedown', stop);
      return el('div', { class: 'link-label', 'data-from': w.from, 'data-i': w.i, style: { '--lc': color }, onmousedown: stop },
        input, el('span', { class: 'pct' }, ''), del);
    }
    return el('div', { class: 'link-label auto', 'data-from': w.from, 'data-i': w.i, style: { '--lc': color }, onmousedown: stop },
      el('span', { class: 'pct' }, ''), del);
  }
  return el('div', { class: 'link-label', style: { '--lc': color }, onmousedown: stop }, el('span', { class: 'pct' }, 'ligação'), del);
}

function updateRandomPct(from) {
  const n = nodes()[from];
  const ls = links(n);
  const manual = n.output.mode === 'manual';
  const total = manual ? ls.reduce((s, l) => s + Math.max(0, l.weight ?? 1), 0) : ls.length;
  nodesBox.querySelectorAll(`.link-label[data-from="${CSS.escape(from)}"]`).forEach((lab) => {
    const l = ls[+lab.dataset.i];
    if (!l) return;
    const share = manual ? Math.max(0, l.weight ?? 1) : 1;
    const pct = total > 0 ? Math.round((share / total) * 100) : 0;
    const gated = isGated(nodes()[l.to]);
    lab.querySelector('.pct').textContent = (manual ? '' : 'auto ') + pct + '%' + (gated ? ' · prio' : '');
  });
}

function drawTemp() {
  let p = $('#temp-wire');
  if (!p) {
    p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.id = 'temp-wire';
    p.setAttribute('class', 'temp');
    wires.append(p);
  }
  const a = portPos(drag.from, 'out');
  p.setAttribute('d', curve(a, [drag.mx, drag.my]));
}

// ============================================================
//  SELEÇÃO / TECLADO
// ============================================================
function select(sel) {
  S.sel = sel;
  nodesBox.querySelectorAll('.node.sel').forEach((n) => n.classList.remove('sel'));
  if (sel && sel.k === 'node' && nodeEls[sel.id]) nodeEls[sel.id].classList.add('sel');
  if (sel && sel.k === 'start' && nodeEls.__start) nodeEls.__start.classList.add('sel');
  drawWires(false);
  renderInspector();
}

window.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveAll(); return; }
  if (e.key === 'Escape') { closeFloating(); return; }
  if (typing || !S.cur) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.sel && S.sel.k === 'node') deleteNode(S.sel.id);
    else if (S.sel && S.sel.k === 'link') removeLink(S.sel.from, S.sel.i);
  }
});
window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

// ============================================================
//  INSPECTOR
// ============================================================
function field(label, control, full) {
  return el('div', { class: 'field' + (full ? ' full' : '') }, label ? el('label', {}, label) : null, control);
}
function section(title, color, ...kids) {
  return el('div', { class: 'section' }, el('h4', {}, color ? el('span', { class: 'sw', style: { background: color } }) : null, title), ...kids);
}
function inputText(obj, key, opts = {}) {
  const i = el('input', { type: 'text', value: obj[key] ?? '', placeholder: opts.placeholder || '' });
  i.addEventListener('input', () => {
    obj[key] = i.value === '' ? undefined : i.value;
    markDirty();
    opts.oninput && opts.oninput();
  });
  return i;
}
function inputNum(obj, key, opts = {}) {
  const i = el('input', { type: 'number', value: obj[key] ?? '', placeholder: opts.placeholder || '', min: opts.min, max: opts.max, step: opts.step || 'any' });
  i.addEventListener('input', () => {
    obj[key] = i.value === '' ? undefined : Number(i.value);
    markDirty();
    opts.oninput && opts.oninput();
  });
  return i;
}
function selectBound(obj, key, options, onchange) {
  const s = el('select', {}, options.map(([v, l]) => el('option', { value: v }, l)));
  s.value = obj[key] ?? (options[0] ? options[0][0] : '');
  s.addEventListener('change', () => { obj[key] = s.value === '' ? undefined : s.value; markDirty(); onchange && onchange(); });
  return s;
}
function checkBound(obj, key, label, def, onchange) {
  const c = el('input', { type: 'checkbox', checked: obj[key] ?? def });
  c.addEventListener('change', () => { obj[key] = c.checked; markDirty(); onchange && onchange(); });
  return el('label', { class: 'inline' }, c, label);
}
/** Tom de 0 a 2 com opção "padrão" (sem valor). */
function pitchControl(obj, key, onchange) {
  const on = obj[key] !== undefined;
  const val = el('span', { class: 'range-val' }, on ? Number(obj[key]).toFixed(2) : 'padrão');
  const r = el('input', { type: 'range', min: 0, max: 2, step: 0.05, value: on ? obj[key] : 1, disabled: !on });
  const c = el('input', { type: 'checkbox', checked: on, title: 'Definir tom' });
  r.addEventListener('input', () => { obj[key] = Number(r.value); val.textContent = Number(r.value).toFixed(2); markDirty(); onchange && onchange(); });
  c.addEventListener('change', () => {
    if (c.checked) { obj[key] = Number(r.value); r.disabled = false; val.textContent = Number(r.value).toFixed(2); }
    else { delete obj[key]; r.disabled = true; val.textContent = 'padrão'; }
    markDirty(); onchange && onchange();
  });
  return el('div', { class: 'inline' }, c, r, val);
}
function segmented(options, current, onpick) {
  return el('div', { class: 'seg' }, options.map(([v, l, c]) =>
    el('button', { class: v === current ? 'on' : '', style: { '--sc': c || 'var(--accent)' }, onclick: () => onpick(v), title: l }, l)));
}

function renderInspector() {
  const box = $('#inspector');
  box.innerHTML = '';
  if (!S.cur) {
    box.append(el('div', { class: 'section muted' }, 'Nenhum diálogo aberto.'));
    return;
  }
  if (S.sel && S.sel.k === 'node' && nodes()[S.sel.id]) return inspectNode(box, S.sel.id);
  if (S.sel && S.sel.k === 'link') return inspectLink(box, S.sel);
  inspectDialogue(box);
}

function inspectDialogue(box) {
  const d = S.cur.data;
  box.append(el('div', { class: 'insp-head', style: { '--hc': 'var(--start)' } }, el('span', { class: 'bar' }), el('h3', {}, 'Diálogo: ' + S.cur.id)));
  box.append(section('Geral', '#3e90ff',
    field('Speaker', selectBound(d, 'speaker', speakerOptions(true, '(nenhum)'), () => renderGraph())),
    field('Tom da voz', pitchControl(d, 'pitch')),
    field('Velocidade', inputNum(d, 'speed', { placeholder: 'padrão (letras/tick)', min: 0, step: 0.1 })),
    field('', checkBound(d, 'once', 'Cada jogador só faz uma vez', false)),
    field('Permissão', inputText(d, 'permission', { placeholder: 'opcional' }))));
  box.append(section('Requisitos para iniciar', '#ff9f43', requirementsEditor(d, () => renderInspector()),
    field('Mensagem', inputText(d, 'deny-message', { placeholder: 'quando não cumpre' }))));
  box.append(section('Gatilhos ao iniciar', '#e8c33a', actionsEditor(d, 'start-commands')));
  box.append(section('Gatilhos ao terminar', '#3fbf6f', actionsEditor(d, 'end-commands')));
  box.append(section('Perigo', '#e0473d',
    el('button', { class: 'btn danger wide', onclick: deleteDialogue }, '🗑 Excluir este diálogo')));
}

function deleteDialogue() {
  if (!confirm(`Excluir o diálogo "${S.cur.id}"? (só é apagado de verdade ao salvar)`)) return;
  if (S.cur.file) S.deleted.push(S.cur.oldId);
  S.dialogues = S.dialogues.filter((d) => d !== S.cur);
  S.cur = null;
  markDirty();
  if (S.dialogues.length) openDialogue(S.dialogues[0]); else renderAll();
}

function inspectNode(box, id) {
  const n = nodes()[id];
  const t = outType(n);
  const idInput = el('input', { type: 'text', value: id, title: 'ID do balão' });
  idInput.addEventListener('change', () => renameNode(id, idInput.value.trim(), idInput));
  box.append(el('div', { class: 'insp-head', style: { '--hc': OUT[t].c } }, el('span', { class: 'bar' }), el('h3', {}, 'Balão'), idInput));

  // --- balão ---
  const skinName = el('span', { class: 'muted' }, n.skin ? skinLabel(n.skin) : 'do speaker');
  box.append(section('Balão', '#3e90ff',
    field('Speaker', selectBound(n, 'speaker', speakerOptions(true), () => refreshNode(id))),
    field('Skin', el('div', { class: 'inline' },
      faceEl(effectiveSkin(n), 'face', (ev) => openSkinDrawer(ev.currentTarget, n.skin, (name) => { n.skin = name || undefined; markDirty(); refreshNode(id); renderInspector(); })),
      skinName,
      n.skin ? el('button', { class: 'btn ghost small', onclick: () => { delete n.skin; markDirty(); refreshNode(id); renderInspector(); } }, 'limpar') : null)),
    field('Animação', selectBound(n, 'animation', [['', '(padrão)'], ...S.animations.map((a) => [a, a])], () => refreshNode(id)))));

  // --- texto ---
  const prev = el('div', { class: 'preview', id: 'insp-preview', html: mcHtml(n.text) });
  const ta = el('textarea', { id: 'insp-text', rows: 5, value: n.text || '', placeholder: 'Texto (aceita &a, &l, &#RRGGBB, %player_name%, <shake>, <wave>)' });
  ta.addEventListener('input', () => {
    n.text = ta.value;
    prev.innerHTML = mcHtml(n.text);
    const nt = nodeEls[id] && nodeEls[id].querySelector('textarea');
    if (nt) nt.value = n.text;
    const np = nodeEls[id] && nodeEls[id].querySelector('.preview');
    if (np) np.innerHTML = mcHtml(n.text);
    markDirty();
  });
  // botões de efeito: envolvem o trecho selecionado (ou inserem as tags no cursor)
  const wrapFx = (tag) => {
    const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
    ta.value = v.slice(0, a) + `<${tag}>` + v.slice(a, b) + `</${tag}>` + v.slice(b);
    ta.focus();
    ta.selectionStart = a + tag.length + 2;
    ta.selectionEnd = b + tag.length + 2;
    ta.dispatchEvent(new Event('input'));
  };
  const fxBar = el('div', { class: 'fx-bar' },
    el('button', { class: 'btn ghost small', title: 'Letras brancas tremendo (core shader)', onclick: () => wrapFx('shake') }, '〰 Tremer'),
    el('button', { class: 'btn ghost small', title: 'Letras brancas em onda (core shader)', onclick: () => wrapFx('wave') }, '🌊 Onda'),
    el('span', { class: 'muted' }, 'selecione o texto e clique'));
  box.append(section('Texto', '#d7dae0', ta, fxBar, prev));

  // --- leitura ---
  box.append(section('Leitura', '#7dd3fc',
    field('Tom (0-2)', pitchControl(n, 'pitch', () => refreshNode(id))),
    field('Velocidade', inputNum(n, 'speed', { placeholder: 'padrão', min: 0, step: 0.1, oninput: () => refreshNode(id) })),
    field('Auto avançar', inputNum(n, 'auto-next', { placeholder: 'ticks (0 = espera)', min: 0, step: 1, oninput: () => refreshNode(id) }))));

  // --- entrada ---
  if (!n.input) n.input = {};
  const inEditor = section('Entrada (como entrar)', isGated(n) ? REQ[n.input.requirements[0].type]?.c : '#9aa0aa',
    el('p', { class: 'hint' }, isGated(n) ? 'Só entra neste balão quem cumprir tudo abaixo. Se não cumprir, o diálogo para.' : 'Conexão normal: qualquer um entra.'),
    requirementsEditor(n.input, () => { refreshNode(id); drawWires(true); renderInspector(); }),
    isGated(n) ? field('Mensagem', inputText(n.input, 'deny-message', { placeholder: 'quando não cumpre' })) : null,
    isGated(n) ? field('Prioridade', inputNum(n.input, 'priority', { min: 1, step: 1, placeholder: '1 = maior', oninput: () => refreshNode(id) })) : null);
  box.append(inEditor);

  // --- saída ---
  const out = n.output || (n.output = { type: 'end', links: [] });
  const outBox = section('Saída (para onde vai)', OUT[t].c,
    segmented(Object.entries(OUT).map(([k, v]) => [k, v.l, v.c]), t, (v) => {
      out.type = v;
      if (v === 'generic' && links(n).length > 1) out.links = links(n).slice(0, 1);
      if (v === 'random' && !out.mode) out.mode = 'auto';
      markDirty(); refreshNode(id); drawWires(true); renderInspector();
    }),
    el('p', { class: 'hint', style: { marginTop: '6px' } }, OUT[t].d));
  if (t === 'random') {
    outBox.append(field('Chances', segmented([['auto', 'Automático', OUT.random.c], ['manual', 'Manual', OUT.random.c]], out.mode || 'auto', (v) => {
      out.mode = v; markDirty(); drawWires(true); renderInspector();
    })));
    outBox.append(el('p', { class: 'hint' }, 'Balões com requisito de entrada cumprido têm prioridade; senão sorteia entre os sem requisito.'));
  }
  if (t === 'dialogue') {
    outBox.append(field('Diálogo', selectBound(out, 'dialogue', [['', '(escolha)'], ...S.dialogues.filter((d) => d !== S.cur).map((d) => [d.id, d.id])], () => refreshNode(id))));
  }
  if (t === 'generic' || t === 'choice' || t === 'random') {
    const ls = links(n);
    if (!ls.length) outBox.append(el('p', { class: 'hint' }, 'Arraste o ponto da direita do balão até outro balão (ou até o fundo para criar um novo).'));
    ls.forEach((l, i) => {
      const card = el('div', { class: 'card', style: { '--cc': OUT[t].c } },
        el('div', { class: 'card-head' }, '→',
          selectBound(l, 'to', Object.keys(nodes()).filter((k) => k !== id).map((k) => [k, k]), () => { markDirty(); drawWires(true); }),
          el('button', { class: 'btn ghost small', onclick: () => removeLink(id, i) }, '✕')));
      if (t === 'choice') {
        card.append(field('Opção', inputText(l, 'text', { placeholder: 'texto da opção', oninput: () => drawWires(true) })));
        card.append(field('Ao escolher', actionsEditor(l, 'commands')));
      }
      if (t === 'random' && out.mode === 'manual') card.append(field('Peso', inputNum(l, 'weight', { min: 0, oninput: () => updateRandomPct(id) })));
      outBox.append(card);
    });
  }
  box.append(outBox);

  // --- gatilhos ---
  box.append(section('Gatilhos (ao entrar no balão)', '#e8c33a', actionsEditor(n, 'commands', () => refreshNode(id))));
  box.append(section('Ações', '#e0473d', el('div', { class: 'inline' },
    el('button', { class: 'btn small', onclick: () => duplicateNode(id) }, '⧉ Duplicar'),
    el('button', { class: 'btn small', onclick: () => { S.cur.data.start.next = id; markDirty(); renderGraph(); } }, '★ Primeiro balão'),
    el('button', { class: 'btn danger small', onclick: () => deleteNode(id) }, '🗑 Excluir'))));
}

function inspectLink(box, sel) {
  box.append(el('div', { class: 'insp-head' }, el('span', { class: 'bar' }), el('h3', {}, 'Ligação')));
  if (sel.from === '__start') {
    box.append(section('Início', '#3e90ff', el('p', { class: 'hint' }, 'O diálogo começa no balão ' + S.cur.data.start.next + '.'),
      el('button', { class: 'btn danger small', onclick: () => removeLink('__start', 0) }, 'Remover ligação')));
    return;
  }
  const n = nodes()[sel.from];
  const l = links(n)[sel.i];
  if (!l) return inspectDialogue(box);
  box.append(section(sel.from + ' → ' + l.to, OUT[outType(n)].c,
    outType(n) === 'choice' ? field('Opção', inputText(l, 'text', { placeholder: 'texto da opção', oninput: () => drawWires(true) })) : null,
    outType(n) === 'random' && n.output.mode === 'manual' ? field('Peso', inputNum(l, 'weight', { min: 0, oninput: () => updateRandomPct(sel.from) })) : null,
    outType(n) === 'choice' ? field('Ao escolher', actionsEditor(l, 'commands')) : null,
    el('div', { class: 'inline' },
      el('button', { class: 'btn small', onclick: () => select({ k: 'node', id: sel.from }) }, 'Abrir origem'),
      el('button', { class: 'btn small', onclick: () => select({ k: 'node', id: l.to }) }, 'Abrir destino'),
      el('button', { class: 'btn danger small', onclick: () => removeLink(sel.from, sel.i) }, 'Remover'))));
}

// ---------- requisitos (entrada) ----------
function requirementsEditor(owner, onchange) {
  if (!Array.isArray(owner.requirements)) owner.requirements = [];
  const reqs = owner.requirements;
  const wrap = el('div');
  reqs.forEach((r, i) => {
    const def = REQ[r.type] || { l: r.type, c: '#999', f: [] };
    const card = el('div', { class: 'card', style: { '--cc': def.c } },
      el('div', { class: 'card-head' },
        el('span', { style: { color: def.c } }, '■'), def.l,
        el('span', { style: { flex: 1 } }),
        checkBound(r, 'negate', 'inverter', false),
        el('button', { class: 'btn ghost small', onclick: () => { reqs.splice(i, 1); markDirty(); onchange(); } }, '✕')));
    for (const [key, kind, dflt, label] of def.f) {
      if (r[key] === undefined && kind !== 'chk' && dflt !== '') r[key] = dflt;
      let ctl;
      if (kind === 'num') ctl = inputNum(r, key, { oninput: onchangeSoft });
      else if (kind === 'sel') ctl = selectBound(r, key, dflt);
      else if (kind === 'chk') ctl = checkBound(r, key, label, dflt);
      else if (kind === 'dlg') ctl = selectBound(r, key, [['', '(escolha)'], ...S.dialogues.map((d) => [d.id, d.id])]);
      else ctl = inputText(r, key, { placeholder: dflt });
      card.append(field(kind === 'chk' ? '' : label, ctl));
    }
    wrap.append(card);
  });
  const add = el('select', {}, el('option', { value: '' }, '＋ Adicionar requisito...'),
    Object.entries(REQ).map(([k, v]) => el('option', { value: k }, v.l)));
  add.addEventListener('change', () => {
    if (!add.value) return;
    const r = { type: add.value };
    if (add.value === 'money') r.take = true;
    reqs.push(r);
    markDirty();
    onchange();
  });
  wrap.append(add);
  function onchangeSoft() { /* números não mudam a estrutura */ }
  return wrap;
}

// ---------- gatilhos (comandos) ----------
function actionsEditor(owner, key, onchange) {
  if (!Array.isArray(owner[key])) owner[key] = [];
  const list = owner[key];
  const wrap = el('div');
  list.forEach((str, i) => {
    const a = parseAction(str);
    const def = ACTIONS[a.k];
    const typeSel = el('select', {}, ACTION_ORDER.map((k) => el('option', { value: k }, ACTIONS[k].l)));
    typeSel.value = a.k;
    typeSel.addEventListener('change', () => { list[i] = ACTIONS[typeSel.value].b(ACTIONS[typeSel.value].d); markDirty(); rerender(); });
    const card = el('div', { class: 'card', style: { '--cc': '#e8c33a' } },
      el('div', { class: 'card-head' }, '⚡', typeSel,
        el('button', { class: 'btn ghost small', onclick: () => { list.splice(i, 1); markDirty(); rerender(); } }, '✕')));
    def.f.forEach((label, fi) => {
      const input = el('input', { type: 'text', value: a.v[fi] ?? '', placeholder: def.d[fi] });
      input.addEventListener('input', () => {
        const vals = def.f.map((_, j) => (j === fi ? input.value : (parseAction(list[i]).v[j] ?? '')));
        list[i] = def.b(vals);
        markDirty();
      });
      card.append(field(label, input));
    });
    wrap.append(card);
  });
  const add = el('select', {}, el('option', { value: '' }, '＋ Adicionar gatilho...'), ACTION_ORDER.map((k) => el('option', { value: k }, ACTIONS[k].l)));
  add.addEventListener('change', () => {
    if (!add.value) return;
    list.push(ACTIONS[add.value].b(ACTIONS[add.value].d));
    markDirty();
    rerender();
  });
  wrap.append(add);
  function rerender() { onchange && onchange(); const fresh = actionsEditor(owner, key, onchange); wrap.replaceWith(fresh); }
  return wrap;
}

// ============================================================
//  GAVETA DE SKINS (abre do ponto clicado para a direita e para baixo)
// ============================================================
let floating = [];
function closeFloating() {
  floating.forEach((f) => f.remove());
  floating = [];
}
function openSkinDrawer(anchor, current, onpick) {
  closeFloating();
  const r = anchor.getBoundingClientRect();
  const drawer = el('div', { class: 'drawer' });
  const search = el('input', { type: 'search', placeholder: 'Buscar skin...' });
  const grid = el('div', { class: 'drawer-grid' });
  const fill = () => {
    grid.innerHTML = '';
    const q = search.value.toLowerCase();
    grid.append(el('div', { class: 'skin-cell' + (!current ? ' on' : ''), onclick: () => { onpick(''); closeFloating(); } },
      faceEl('', 'face'), el('span', {}, 'padrão')));
    if (!q || PLAYER_SKIN.includes(q) || 'quem vê'.includes(q)) {
      const on = String(current || '').toLowerCase() === PLAYER_SKIN;
      grid.append(el('div', { class: 'skin-cell' + (on ? ' on' : ''), title: 'Skin de quem está vendo o diálogo', onclick: () => { onpick(PLAYER_SKIN); closeFloating(); } },
        faceEl(PLAYER_SKIN, 'face'), el('span', {}, 'player')));
    }
    for (const s of S.skins) {
      if (q && !s.name.includes(q)) continue;
      grid.append(el('div', { class: 'skin-cell' + (current === s.name ? ' on' : ''), title: s.name, onclick: () => { onpick(s.name); closeFloating(); } },
        faceEl(s.name, 'face'), el('span', {}, s.name)));
    }
    grid.append(el('div', { class: 'skin-cell add', title: 'Adicionar skin', onclick: () => { closeFloating(); openUpload((name) => onpick(name)); } },
      el('div', { class: 'face' }, '+'), el('span', {}, 'nova')));
  };
  search.addEventListener('input', fill);
  drawer.append(el('div', { class: 'drawer-head' }, '🎭 Skins', search), grid);
  fill();
  // posiciona no ponto de origem; se não couber, encosta na borda
  const W = 340, H = 300;
  drawer.style.left = Math.min(r.left, innerWidth - W - 8) + 'px';
  drawer.style.top = Math.min(r.top, innerHeight - H - 8) + 'px';
  drawer.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.append(drawer);
  floating.push(drawer);
  requestAnimationFrame(() => drawer.classList.add('open'));
  setTimeout(() => search.focus(), 120);
}
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.drawer, .ctx, .face')) closeFloating(); });

function contextMenu(x, y, items) {
  closeFloating();
  const m = el('div', { class: 'ctx', style: { left: x + 'px', top: y + 'px' } },
    items.map(([label, fn]) => el('button', { onclick: () => { closeFloating(); fn(); } }, label)));
  m.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.append(m);
  floating.push(m);
}

// ============================================================
//  POPUP: ADICIONAR SKIN (colar, arrastar ou escolher o arquivo)
// ============================================================
function openUpload(onsaved) {
  const ov = $('#overlay');
  let dataUrl = null;
  const preview = el('div', { class: 'face' }, el('img', { src: defaultFace() }));
  const dropText = el('div', {}, el('strong', {}, 'Arraste a skin aqui'), el('br'), el('span', { class: 'muted' }, 'ou clique para escolher, ou cole (Ctrl+V)'));
  const file = el('input', { type: 'file', accept: 'image/png', class: 'hidden' });
  const drop = el('div', { class: 'drop', onclick: () => file.click() }, preview, dropText, file);
  const name = el('input', { type: 'text', placeholder: 'nome (ex.: ferreiro)' });
  const slim = el('input', { type: 'checkbox' });
  const err = el('div', { style: { color: 'var(--danger)', minHeight: '16px', fontSize: '12px' } });
  const ok = el('button', { class: 'btn primary', disabled: true }, 'Salvar skin');

  const accept = (blob) => {
    if (!blob || !/png/.test(blob.type)) { err.textContent = 'Use um arquivo PNG de skin (64x64).'; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) { err.textContent = `A skin precisa ser 64x64 (essa é ${img.width}x${img.height}).`; return; }
        err.textContent = '';
        dataUrl = reader.result;
        const c = document.createElement('canvas'); c.width = c.height = 8;
        drawFace(img, c.getContext('2d'));
        preview.firstChild.src = c.toDataURL();
        if (!name.value && blob.name) name.value = blob.name.replace(/\.png$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        ok.disabled = !name.value;
        name.focus();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(blob);
  };
  file.addEventListener('change', () => accept(file.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); accept(e.dataTransfer.files[0]); });
  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) accept(item.getAsFile());
  };
  window.addEventListener('paste', onPaste);
  name.addEventListener('input', () => { ok.disabled = !(dataUrl && name.value.trim()); });

  const close = () => { ov.classList.remove('show'); ov.innerHTML = ''; window.removeEventListener('paste', onPaste); };
  ok.addEventListener('click', async () => {
    const n = name.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (n === PLAYER_SKIN) { err.textContent = '"player" é reservado (skin de quem vê o diálogo). Use outro nome.'; return; }
    ok.disabled = true;
    try {
      const res = await fetch(apiUrl('skin'), { method: 'POST', body: JSON.stringify({ name: n, slim: slim.checked, data: dataUrl }) });
      const json = await readJson(res);
      if (!res.ok || json.ok === false) throw new Error(json.error || res.status);
      S.skins = S.skins.filter((s) => s.name !== json.name).concat([{ name: json.name, slim: slim.checked }]).sort((a, b) => a.name.localeCompare(b.name));
      delete faceCache[json.name];
      close();
      renderSkinTab();
      onsaved && onsaved(json.name);
      setStatus(`Skin "${json.name}" salva no servidor`, 'ok');
    } catch (e) {
      err.textContent = 'Erro: ' + e.message;
      ok.disabled = false;
    }
  });

  ov.innerHTML = '';
  ov.append(el('div', { class: 'modal', onmousedown: (e) => e.stopPropagation() },
    el('h3', {}, 'Adicionar skin'),
    el('div', { class: 'content' }, drop, field('Nome', name), field('', el('label', { class: 'inline' }, slim, 'Braço fino (modelo Alex)')), err),
    el('div', { class: 'actions' }, el('button', { class: 'btn', onclick: close }, 'Cancelar'), ok)));
  ov.classList.add('show');
  ov.onmousedown = (e) => { if (e.target === ov) close(); };
}

// ============================================================
//  BOTÕES / ABAS / INÍCIO
// ============================================================
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab-body').forEach((x) => x.classList.toggle('hidden', x.id !== 'tab-' + b.dataset.tab));
}));
$('#dialogue-search').addEventListener('input', renderSidebar);
$('#btn-save').addEventListener('click', saveAll);
$('#btn-center').addEventListener('click', centerView);
$('#btn-add-node').addEventListener('click', () => {
  if (!S.cur) return;
  const r = canvas.getBoundingClientRect();
  const [wx, wy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
  addNode(wx - NODE_W / 2, wy - 60);
});
$('#btn-new-dialogue').addEventListener('click', () => {
  const id = (prompt('ID do novo diálogo (letras, números, _ . -):') || '').trim();
  if (!id) return;
  if (!/^[A-Za-z0-9_.-]+$/.test(id) || S.dialogues.some((d) => d.id === id)) { alert('ID inválido ou já usado'); return; }
  const d = { id, oldId: id, file: null, data: { format: 'graph', start: { pos: [-420, 0] }, nodes: {} } };
  S.dialogues.push(d);
  markDirty();
  openDialogue(d);
  addNode(0, -20);
});
$('#btn-new-speaker').addEventListener('click', () => {
  const id = (prompt('ID do novo speaker (ex.: mercador):') || '').trim().toLowerCase();
  if (!id) return;
  if (!/^[a-z0-9_-]+$/.test(id) || S.speakers[id] || id === 'player') { alert('ID inválido ou já usado'); return; }
  S.speakers[id] = { name: '&f' + id };
  markDirty();
  renderSpeakerTab();
});

applyView();
renderAll();
/** Tela de entrada: pede o token quando o link não trouxe um (ou ele expirou). */
function askToken(message) {
  const ov = $('#overlay');
  const input = el('input', { type: 'password', placeholder: 'token de acesso' });
  const go = () => {
    const t = input.value.trim();
    if (!t) return;
    TOKEN = t;
    sessionStorage.setItem('ned-token', t);
    ov.classList.remove('show');
    ov.innerHTML = '';
    start();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  ov.innerHTML = '';
  ov.append(el('div', { class: 'modal' },
    el('h3', {}, '🔒 Entrar no editor'),
    el('div', { class: 'content' },
      el('p', { class: 'hint', style: { margin: 0 } }, message || 'Use o link do /ned web-editor no jogo, ou cole o API token (web-editor.api-token do plugin).'),
      input),
    el('div', { class: 'actions' }, el('button', { class: 'btn primary', onclick: go }, 'Entrar'))));
  ov.classList.add('show');
  ov.onmousedown = null;
  setTimeout(() => input.focus(), 50);
}

function start() {
  if (!TOKEN) return askToken();
  loadState().catch((e) => {
    if (/inv[aá]lid|expir|ausente|403/i.test(e.message)) {
      sessionStorage.removeItem('ned-token');
      return askToken('Token inválido ou sessão expirada. Gere outro link com /ned web-editor ou cole o API token.');
    }
    setStatus('Erro ao carregar: ' + e.message, 'err');
  });
}
start();
