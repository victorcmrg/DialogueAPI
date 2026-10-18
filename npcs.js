'use strict';
/* NotEnoughDialogues - editor web: NPCs (cena 3D estilo Blockbench) e Quests (quadro de etapas).
 * Usa as funções do editor.js (S, el, field, section, inputText, inputNum, selectBound, checkBound, segmented,
 * requirementsEditor, actionsEditor, mcHtml, markDirty, setStatus, apiUrl, readJson, openSkinDrawer, faceEl...). */
(function () {
  const OPS_ = typeof OPS !== 'undefined' ? OPS : [['==', '='], ['!=', '≠'], ['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['contains', 'contém']];
  const NPC_TYPES = {
    player: { l: 'Player', c: '#3e90ff', i: '👤', d: 'Manequim com skin (nick original, skin salva ou value/signature)' },
    mob: { l: 'Mob', c: '#3fbf6f', i: '🐾', d: 'Qualquer mob vanilla, parado e sem IA' },
    model: { l: 'Modelo 3D', c: '#a06bff', i: '🧊', d: 'Modelo da pasta plugins/BetterModel/models' },
  };
  // tamanhos aproximados (blocos) para a prévia dos mobs vanilla
  const MOB_SIZE = {
    villager: [0.6, 1.95], wandering_trader: [0.6, 1.95], zombie: [0.6, 1.95], husk: [0.6, 1.95], drowned: [0.6, 1.95], skeleton: [0.6, 1.99],
    stray: [0.6, 1.99], creeper: [0.6, 1.7], enderman: [0.6, 2.9], witch: [0.6, 1.95], pillager: [0.6, 1.95], vindicator: [0.6, 1.95],
    evoker: [0.6, 1.95], piglin: [0.6, 1.95], piglin_brute: [0.6, 1.95], zombified_piglin: [0.6, 1.95], iron_golem: [1.4, 2.7],
    snow_golem: [0.7, 1.9], pig: [0.9, 0.9], cow: [0.9, 1.4], mooshroom: [0.9, 1.4], sheep: [0.9, 1.3], chicken: [0.4, 0.7],
    wolf: [0.6, 0.85], cat: [0.6, 0.7], ocelot: [0.6, 0.7], fox: [0.6, 0.7], horse: [1.4, 1.6], donkey: [1.4, 1.5], mule: [1.4, 1.6],
    llama: [0.9, 1.87], camel: [1.7, 2.375], panda: [1.3, 1.25], polar_bear: [1.4, 1.4], goat: [0.9, 1.3], frog: [0.5, 0.5],
    allay: [0.35, 0.6], axolotl: [0.75, 0.42], bee: [0.7, 0.6], blaze: [0.6, 1.8], spider: [1.4, 0.9], cave_spider: [0.7, 0.5],
    slime: [1.04, 1.04], magma_cube: [1.04, 1.04], warden: [0.9, 2.9], sniffer: [1.9, 1.75], armadillo: [0.7, 0.65], breeze: [0.6, 1.77],
  };
  const OBJ = {
    kill: { l: 'Matar mob', c: '#e0473d', f: [['entity', 'ent', 'zombie', 'Mob'], ['mythic', 'text', '', 'MythicMobs id'], ['amount', 'num', 10, 'Quantidade']] },
    deliver: { l: 'Entregar itens', c: '#ff9f43', f: [['material', 'text', 'iron_ingot', 'Material'], ['custom-model-data', 'text', '', 'Custom model'],
      ['itemsadder', 'text', '', 'ItemsAdder id'], ['name', 'text', '', 'Nome contém'], ['amount', 'num', 1, 'Quantidade'], ['take', 'chk', true, 'Remover ao entregar']] },
    world: { l: 'Entrar no mundo', c: '#94a3b8', f: [['world', 'world', 'world', 'Mundo']] },
    region: { l: 'Ir até região', c: '#2dd4bf', f: [['region', 'text', '', 'Região (WorldGuard)'], ['world', 'world', '', 'Mundo']] },
    location: { l: 'Ir até local', c: '#7dd3fc', pos: true, f: [['world', 'world', '', 'Mundo'], ['x', 'num', 0, 'X'], ['y', 'num', 64, 'Y'], ['z', 'num', 0, 'Z'], ['radius', 'num', 3, 'Raio']] },
    talk: { l: 'Falar com NPC', c: '#3e90ff', f: [['npc', 'npc', '', 'NPC'], ['dialogue', 'dlg', '', 'Diálogo (opcional)']] },
    level: { l: 'Chegar ao nível', c: '#3ec7e0', f: [['min', 'num', 10, 'Nível']] },
    money: { l: 'Ter dinheiro', c: '#f5c542', f: [['amount', 'num', 100, 'Valor'], ['take', 'chk', false, 'Cobrar ao entregar']] },
    break: { l: 'Quebrar blocos', c: '#b45309', f: [['material', 'text', 'stone', 'Bloco'], ['amount', 'num', 10, 'Quantidade']] },
    place: { l: 'Colocar blocos', c: '#a16207', f: [['material', 'text', 'oak_planks', 'Bloco'], ['amount', 'num', 10, 'Quantidade']] },
    fish: { l: 'Pescar', c: '#0ea5e9', f: [['material', 'text', '', 'Peixe (vazio = qualquer)'], ['amount', 'num', 3, 'Quantidade']] },
    craft: { l: 'Fabricar item', c: '#84cc16', f: [['material', 'text', 'bread', 'Item'], ['amount', 'num', 5, 'Quantidade']] },
    'xp-level': { l: 'Nível de XP', c: '#7dd3fc', f: [['min', 'num', 5, 'Nível XP']] },
    completed: { l: 'Concluir diálogo', c: '#8bd450', f: [['dialogue', 'dlg', '', 'Diálogo']] },
    flag: { l: 'Flag', c: '#2dd4bf', f: [['flag', 'text', '', 'Flag'], ['operator', 'sel', OPS_, 'Operador'], ['value', 'text', '', 'Valor']] },
    placeholder: { l: 'Placeholder', c: '#c084fc', f: [['placeholder', 'text', '%player_level%', 'Placeholder'], ['operator', 'sel', OPS_, 'Operador'], ['value', 'text', '', 'Valor']] },
    permission: { l: 'Ter permissão', c: '#b48cff', f: [['permission', 'text', '', 'Permissão']] },
  };

  let viewer = null, viewerKey = '', simTimer = null, simIndex = 0, loadingModel = null;
  const bbCache = {};
  const curNpc = () => (S.curNpc && S.npcs[S.curNpc]) || null;
  const curQuest = () => (S.curQuest && S.quests[S.curQuest]) || null;
  const anims = (n) => (n.animations && typeof n.animations === 'object' ? n.animations : (n.animations = {}));
  const list = (o, k) => (Array.isArray(o[k]) ? o[k] : (o[k] = []));
  const npcOptions = (def) => [['', def || '(nenhum)'], ...Object.keys(S.npcs).map((k) => [k, k])];
  const dlgOptions = (def) => [['', def || '(nenhum)'], ...S.dialogues.map((d) => [d.id, d.id])];

  /** Troca a chave de um objeto mantendo a ordem. */
  function renameKey(obj, from, to) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k === from ? to : k] = v;
    for (const k of Object.keys(obj)) delete obj[k];
    Object.assign(obj, out);
  }

  // ============================================================
  //  LISTAS DA BARRA LATERAL
  // ============================================================
  function renderNpcList() {
    const ul = $('#npc-list');
    if (!ul) return;
    const q = ($('#npc-search').value || '').toLowerCase();
    ul.innerHTML = '';
    for (const [id, n] of Object.entries(S.npcs)) {
      if (q && !id.toLowerCase().includes(q) && !String(n.name || '').toLowerCase().includes(q)) continue;
      const t = NPC_TYPES[n.type] || NPC_TYPES.player;
      const sub = n.type === 'model' ? (n.model || 'sem modelo') : n.type === 'mob' ? (n.entity || 'villager') : (n.skin || 'skin padrão');
      ul.append(el('li', { class: S.curNpc === id ? 'active' : '', onclick: () => selectNpc(id) },
        el('span', { class: 'type-ico', style: { background: t.c } }, t.i),
        el('div', { style: { minWidth: 0, flex: 1 } },
          el('div', { class: 'npc-name', html: mcHtml(String(n.name || id).split('\\n')[0]) }),
          el('div', { class: 'file' }, id + ' · ' + sub)),
        el('span', { class: 'live ' + (S.npcSpawned[id] ? 'on' : ''), title: S.npcSpawned[id] ? 'Aparecendo no mundo agora' : 'Não está no mundo (chunk descarregado, mundo inexistente ou ainda não salvo)' })));
    }
    if (!Object.keys(S.npcs).length) ul.append(el('p', { class: 'hint' }, 'Nenhum NPC ainda. Clique em ＋ ou use /ned npc create <id> no jogo.'));
  }

  function renderQuestList() {
    const ul = $('#quest-list');
    if (!ul) return;
    const q = ($('#quest-search').value || '').toLowerCase();
    ul.innerHTML = '';
    for (const [id, qu] of Object.entries(S.quests)) {
      if (q && !id.toLowerCase().includes(q)) continue;
      ul.append(el('li', { class: S.curQuest === id ? 'active' : '', onclick: () => selectQuest(id) },
        el('span', { class: 'dot', style: { background: '#e8c33a' } }),
        el('div', { style: { minWidth: 0, flex: 1 } }, el('div', { html: mcHtml(qu.name || id) }), el('div', { class: 'file' }, id + (qu.npc ? ' · ' + qu.npc : ''))),
        el('span', { class: 'count', title: 'etapas' }, (qu.steps || []).length)));
    }
    if (!Object.keys(S.quests).length) ul.append(el('p', { class: 'hint' }, 'Nenhuma quest ainda. Clique em ＋.'));
  }

  function selectNpc(id) {
    S.curNpc = id;
    renderNpcList();
    if (S.mode !== 'npcs') setMode('npcs');
    else { refreshViewer(true); renderCrumbs(); renderInspector(); }
  }

  function selectQuest(id) {
    S.curQuest = id;
    renderQuestList();
    if (S.mode !== 'quests') setMode('quests');
    else { renderBoard(); renderCrumbs(); renderInspector(); }
  }

  function newNpc() {
    const id = (prompt('ID do novo NPC (letras, números, _ . -):') || '').trim();
    if (!id) return;
    if (!/^[A-Za-z0-9_.-]+$/.test(id) || S.npcs[id]) { alert('ID inválido ou já usado'); return; }
    const p = S.players[0];
    S.npcs[id] = {
      type: 'player', name: '&f' + id,
      location: p ? { world: p.world, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: 0 } : { world: S.worlds[0] || 'world', x: 0.5, y: 64, z: 0.5, yaw: 0, pitch: 0 },
      scale: 1, 'look-at-player': true, 'look-range': 6, animations: { interval: 5, mode: 'random' }, dialogues: [],
    };
    markDirty();
    selectNpc(id);
    if (p) setStatus(`NPC "${id}" criado na posição de ${p.name} — salve para aparecer no mundo`, 'dirty');
  }

  function newQuest() {
    const id = (prompt('ID da nova quest (letras, números, _ . -):') || '').trim();
    if (!id) return;
    if (!/^[A-Za-z0-9_.-]+$/.test(id) || S.quests[id]) { alert('ID inválido ou já usado'); return; }
    S.quests[id] = { name: '&e' + id, npc: S.curNpc || '', begin: 'end', steps: [{ name: 'Etapa 1', objectives: [] }] };
    markDirty();
    selectQuest(id);
  }

  // ============================================================
  //  MODO
  // ============================================================
  function modeChanged(mode) {
    $('#canvas').classList.toggle('hidden', mode !== 'dialogues');
    $('#npc-view').classList.toggle('hidden', mode !== 'npcs');
    $('#quest-view').classList.toggle('hidden', mode !== 'quests');
    if (mode === 'npcs') {
      if (!S.curNpc && Object.keys(S.npcs).length) S.curNpc = Object.keys(S.npcs)[0];
      renderNpcList();
      refreshViewer(true);
    } else stopSim();
    if (mode === 'quests') {
      if (!S.curQuest && Object.keys(S.quests).length) S.curQuest = Object.keys(S.quests)[0];
      renderQuestList();
      renderBoard();
    }
  }

  function npcCrumbs(c) {
    c.innerHTML = '';
    if (S.mode === 'npcs') {
      if (!S.curNpc) return c.append(el('span', {}, 'NPCs'));
      c.append(el('span', {}, 'NPCs ›'), el('strong', {}, S.curNpc), el('span', { class: 'muted' }, ' /ned npc tp ' + S.curNpc));
    } else if (S.mode === 'quests') {
      if (!S.curQuest) return c.append(el('span', {}, 'Quests'));
      c.append(el('span', {}, 'Quests ›'), el('strong', {}, S.curQuest), el('span', { class: 'muted' }, ' /ned quest start ' + S.curQuest));
    }
  }

  // ============================================================
  //  CENA 3D
  // ============================================================
  function ensureViewer() {
    if (viewer) return viewer;
    viewer = new Viewer3D($('#npc-canvas'));
    if (!viewer.ok) {
      $('#npc-empty').textContent = 'Seu navegador não tem WebGL: a prévia 3D não funciona aqui (o resto do editor sim).';
      $('#npc-empty').classList.remove('hidden');
    }
    viewer.onframe = updateNametag;
    return viewer;
  }

  function skinUrl(n) {
    const sk = String(n.skin || '').trim();
    if (sk && S.skins.some((s) => s.name === sk.toLowerCase())) return apiUrl('skin?name=' + encodeURIComponent(sk.toLowerCase()));
    if (/^[A-Za-z0-9_]{2,16}$/.test(sk)) return 'https://mc-heads.net/skin/' + encodeURIComponent(sk);
    return 'https://mc-heads.net/skin/MHF_Steve';
  }

  function modelEntry(name) {
    const n = String(name || '').toLowerCase();
    return S.models.find((m) => m.name === n || m.file.toLowerCase() === n || m.file.toLowerCase() === n + '.bbmodel');
  }

  /** Recria a cena quando muda tipo/skin/modelo; senão só atualiza escala/hitbox. */
  async function refreshViewer(reframe) {
    const n = curNpc();
    $('#npc-empty').classList.toggle('hidden', !!n);
    if (!n) { if (viewer) viewer.setModel(null); renderTimeline(); return; }
    const v = ensureViewer();
    const type = n.type || 'player';
    const key = type + '|' + (type === 'model' ? n.model : type === 'mob' ? n.entity + (n.baby ? '*' : '') : n.skin) + '|' + S.curNpc;
    v.scale = Number(n.scale) || 1;
    const hb = n.hitbox || {};
    v.hitbox = type === 'model' ? [(Number(hb.width) || 0.8) * v.scale, (Number(hb.height) || 1.9) * v.scale] : null;
    if (key === viewerKey) { renderTimeline(); return; }
    viewerKey = key;
    stopSim();
    $('#npc-warn').textContent = '';
    if (type === 'model') {
      const entry = modelEntry(n.model);
      if (!entry) {
        v.setModel(Viewer3D.boxModel(0.8, 1.9, '#4b3a6b'));
        $('#npc-warn').textContent = n.model ? `Modelo "${n.model}" não está em plugins/BetterModel/models` : 'Escolha um modelo no painel da direita';
      } else {
        const token = (loadingModel = {});
        $('#npc-warn').textContent = 'Carregando ' + entry.file + '...';
        try {
          if (!bbCache[entry.file]) {
            const res = await fetch(apiUrl('model?name=' + encodeURIComponent(entry.file)));
            if (!res.ok) throw new Error('HTTP ' + res.status);
            bbCache[entry.file] = await res.json();
          }
          if (token !== loadingModel || viewerKey !== key) return;
          v.setModel(Viewer3D.fromBBModel(bbCache[entry.file]));
          $('#npc-warn').textContent = '';
        } catch (e) {
          if (token !== loadingModel) return;
          v.setModel(Viewer3D.boxModel(0.8, 1.9, '#6b3a3a'));
          $('#npc-warn').textContent = 'Não consegui abrir o modelo: ' + e.message;
        }
      }
    } else if (type === 'mob') {
      const e = String(n.entity || 'villager').replace('minecraft:', '').toLowerCase();
      let [w, h] = MOB_SIZE[e] || [0.6, 1.8];
      if (n.baby) { w /= 2; h /= 2; }
      v.setModel(Viewer3D.boxModel(w, h, '#2f6b45'));
      $('#npc-warn').textContent = 'Mob vanilla: a prévia mostra só o tamanho (' + e + ')';
    } else {
      const saved = S.skins.find((s) => s.name === String(n.skin || '').toLowerCase());
      const m = Viewer3D.playerModel(skinUrl(n), !!(saved && saved.slim));
      m.textures[0].onerror = () => { $('#npc-warn').textContent = 'Não consegui baixar a skin para a prévia (no jogo pode funcionar)'; };
      v.setModel(m);
    }
    if (reframe !== false) v.frame();
    renderTimeline();
    startSim();
  }

  function npcHeightPx(n) {
    if (n['name-offset']) return Number(n['name-offset']) * 16;
    const s = Number(n.scale) || 1;
    if (n.type === 'model') return ((n.hitbox && Number(n.hitbox.height)) || 1.9) * 16 * s + 4;
    if (n.type === 'mob') {
      const [, h] = MOB_SIZE[String(n.entity || 'villager').replace('minecraft:', '').toLowerCase()] || [0.6, 1.8];
      return h * (n.baby ? 0.5 : 1) * 16 * s + 4;
    }
    return 1.8 * 16 * s + 4;
  }

  function updateNametag(v) {
    const tag = $('#npc-nametag');
    const n = curNpc();
    if (!n || !n.name) { tag.style.display = 'none'; return; }
    const p = v.project([0, npcHeightPx(n), 0]);
    if (!p) { tag.style.display = 'none'; return; }
    tag.style.display = '';
    tag.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%, -100%)`;
    const html = String(n.name).split('\\n').map((l) => mcHtml(l)).join('<br>');
    if (tag._html !== html) { tag.innerHTML = html; tag._html = html; }
  }

  /** Animações que dá pra escolher para este NPC. */
  function animationChoices(n) {
    if ((n.type || 'player') === 'model') return viewer ? viewer.animations() : [];
    return S.vanillaAnimations.length ? S.vanillaAnimations : ['swing', 'swing-offhand', 'hurt', 'sneak', 'nod', 'shake'];
  }

  // ---------- simulação: idle em loop + uma aleatória a cada "interval" ----------
  let simOn = true;
  function stopSim() {
    clearInterval(simTimer);
    simTimer = null;
  }
  function startSim() {
    stopSim();
    const n = curNpc();
    if (!n || !viewer || !simOn) return;
    const a = anims(n);
    const type = n.type || 'player';
    viewer.stop();
    if (type === 'model' && a.idle) viewer.play(a.idle, { base: true, loop: true });
    if (type === 'player') viewer.play('idle', { base: true, loop: true });
    const random = list(a, 'random');
    if (!random.length) return;
    simIndex = 0;
    simTimer = setInterval(() => {
      const r = list(anims(n), 'random');
      if (!r.length) return;
      const name = anims(n).mode === 'sequence' ? r[simIndex++ % r.length] : r[Math.floor(Math.random() * r.length)];
      viewer.play(name, { loop: false });
      flashChip(name);
    }, Math.max(0.5, Number(a.interval) || 5) * 1000);
  }

  function flashChip(name) {
    const chip = [...document.querySelectorAll('#npc-timeline .anim-chip')].find((c) => c.dataset.name === name);
    if (!chip) return;
    chip.classList.add('playing');
    setTimeout(() => chip.classList.remove('playing'), 900);
  }

  function renderTimeline() {
    const box = $('#npc-timeline');
    box.innerHTML = '';
    const n = curNpc();
    if (!n || !viewer) return;
    const a = anims(n);
    const names = animationChoices(n);
    const simBtn = el('button', { class: 'btn small' + (simOn ? ' primary' : ''), title: 'Simula o servidor: idle em loop + uma aleatória a cada intervalo',
      onclick: () => { simOn = !simOn; if (simOn) startSim(); else { stopSim(); viewer.stop(); } renderTimeline(); } }, simOn ? '⏸ Simulando' : '▶ Simular');
    const chips = el('div', { class: 'anim-chips' });
    if (!names.length) chips.append(el('span', { class: 'muted' }, (n.type || 'player') === 'model' ? 'Este modelo não tem animações.' : 'Sem animações.'));
    for (const name of names) {
      const tags = [];
      if (a.idle === name) tags.push(['idle', '#3fbf6f']);
      if (list(a, 'random').includes(name)) tags.push(['aleatória', '#e8c33a']);
      if (list(a, 'interact').includes(name)) tags.push(['clique', '#3e90ff']);
      chips.append(el('button', { class: 'anim-chip', 'data-name': name, title: 'Tocar na prévia', onclick: () => { viewer.play(name, { loop: false }); flashChip(name); } },
        '▶ ' + name, ...tags.map(([t, c]) => el('span', { class: 'tag', style: { background: c } }, t))));
    }
    box.append(el('div', { class: 'tl-left' }, simBtn,
      el('button', { class: 'btn small', title: 'Parar tudo', onclick: () => { viewer.stop(); } }, '■'),
      el('span', { class: 'muted' }, `a cada ${Number(a.interval) || 5}s · ${a.mode === 'sequence' ? 'em sequência' : 'aleatório'}`)), chips);
  }

  // ============================================================
  //  INSPECTOR
  // ============================================================
  function npcInspector(box) {
    if (S.mode === 'npcs') return inspectNpc(box);
    return inspectQuest(box);
  }

  function chipList(owner, key, choices, onchange) {
    const arr = list(owner, key);
    const wrap = el('div', { class: 'chip-list' });
    arr.forEach((name, i) => wrap.append(el('span', { class: 'chip' }, name,
      el('button', { title: 'Remover', onclick: () => { arr.splice(i, 1); markDirty(); onchange(); } }, '✕'))));
    const add = el('select', {}, el('option', { value: '' }, '＋ adicionar...'),
      choices.filter((c) => !arr.includes(c)).map((c) => el('option', { value: c }, c)),
      el('option', { value: '__custom' }, 'outra (digitar)...'));
    add.addEventListener('change', () => {
      let v = add.value;
      if (v === '__custom') v = (prompt('Nome da animação:') || '').trim();
      if (!v) { add.value = ''; return; }
      arr.push(v);
      markDirty();
      onchange();
    });
    wrap.append(add);
    return wrap;
  }

  function inspectNpc(box) {
    const n = curNpc();
    if (!n) {
      box.append(el('div', { class: 'section' }, el('p', { class: 'hint' }, 'Escolha um NPC na lista, ou crie um novo.'),
        el('button', { class: 'btn primary wide', onclick: newNpc }, '＋ Novo NPC')));
      return;
    }
    const id = S.curNpc;
    const type = n.type || 'player';
    const t = NPC_TYPES[type];
    const rerender = () => { renderInspector(); renderNpcList(); };
    const idInput = el('input', { type: 'text', value: id, title: 'ID do NPC' });
    idInput.addEventListener('change', () => {
      const nid = idInput.value.trim();
      if (nid === id) return;
      if (!/^[A-Za-z0-9_.-]+$/.test(nid) || S.npcs[nid]) { alert('ID inválido ou já usado'); idInput.value = id; return; }
      renameKey(S.npcs, id, nid);
      for (const q of Object.values(S.quests)) {
        if (q.npc === id) q.npc = nid;
        for (const st of q.steps || []) {
          if (st.npc === id) st.npc = nid;
          for (const o of st.objectives || []) if (o.type === 'talk' && o.npc === id) o.npc = nid;
        }
      }
      S.curNpc = nid;
      viewerKey = '';
      markDirty(); renderCrumbs(); rerender();
    });
    box.append(el('div', { class: 'insp-head', style: { '--hc': t.c } }, el('span', { class: 'bar' }), el('h3', {}, t.i + ' NPC'), idInput));

    // --- tipo ---
    box.append(section('Tipo', t.c,
      segmented(Object.entries(NPC_TYPES).map(([k, v]) => [k, v.l, v.c]), type, (v) => { n.type = v; markDirty(); refreshViewer(); rerender(); }),
      el('p', { class: 'hint', style: { marginTop: '6px' } }, t.d)));

    // --- nome ---
    const prev = el('div', { class: 'preview', html: String(n.name || '').split('\\n').map((l) => mcHtml(l)).join('<br>') || mcHtml('') });
    box.append(section('Nome (holograma)', '#d7dae0',
      field('Nome', inputText(n, 'name', { placeholder: 'vazio = sem nome · \\n quebra linha', oninput: () => { prev.innerHTML = String(n.name || '').split('\\n').map((l) => mcHtml(l)).join('<br>'); renderNpcList(); } })),
      prev,
      field('Altura', inputNum(n, 'name-offset', { placeholder: 'automática (blocos)', step: 0.05 }))));

    // --- aparência ---
    const look = section('Aparência', '#3e90ff');
    if (type === 'player') {
      const skinName = el('span', { class: 'muted' }, n.skin ? skinLabel(n.skin) : 'padrão');
      look.append(field('Skin', el('div', { class: 'inline' },
        faceEl(n.skin || '', 'face', (ev) => openSkinDrawer(ev.currentTarget, n.skin, (name) => { n.skin = name && name !== 'player' ? name : undefined; markDirty(); refreshViewer(false); rerender(); })),
        skinName)));
      look.append(field('Nick/salva', inputText(n, 'skin', { placeholder: 'nick original ou skin salva', oninput: () => { clearTimeout(n._skinT); n._skinT = setTimeout(() => refreshViewer(false), 600); } })));
      const adv = el('details', { class: 'adv' }, el('summary', {}, 'Textura assinada (MineSkin)'),
        el('p', { class: 'hint' }, 'Opcional. Cole o value e a signature de mineskin.org — vale mais que o campo acima.'),
        field('Value', inputText(n, 'skin-value', { placeholder: 'ewogICJ0aW1l...' })),
        field('Signature', inputText(n, 'skin-signature', { placeholder: '...' })));
      look.append(adv);
      look.append(el('p', { class: 'hint' }, 'Skin enviada como imagem precisa de npcs.mineskin-api-key no config.yml para aparecer no jogo.'));
    } else if (type === 'mob') {
      look.append(field('Mob', selectBound(n, 'entity', (S.entities.length ? S.entities : Object.keys(MOB_SIZE)).map((e) => [e, e]), () => refreshViewer(false))));
      look.append(field('', checkBound(n, 'baby', 'Filhote', false, () => refreshViewer(false))));
    } else {
      if (!S.bettermodel) look.append(el('p', { class: 'warn-box' }, '⚠ O BetterModel não está ligado no servidor: o NPC não vai aparecer até instalar.'));
      look.append(modelPicker(n, rerender));
      const hb = n.hitbox && typeof n.hitbox === 'object' ? n.hitbox : (n.hitbox = {});
      look.append(el('div', { class: 'grid2' },
        field('Clique L', inputNum(hb, 'width', { placeholder: '0.8', min: 0.1, step: 0.1, oninput: () => refreshViewer(false) })),
        field('Clique A', inputNum(hb, 'height', { placeholder: '1.9', min: 0.1, step: 0.1, oninput: () => refreshViewer(false) }))));
      look.append(el('p', { class: 'hint' }, 'Caixa amarela na prévia = área de clique (largura/altura em blocos).'));
    }
    // escala
    const scaleVal = el('span', { class: 'range-val' }, (Number(n.scale) || 1).toFixed(2) + 'x');
    const range = el('input', { type: 'range', min: 0.1, max: 4, step: 0.05, value: Number(n.scale) || 1 });
    range.addEventListener('input', () => { n.scale = Number(range.value); scaleVal.textContent = n.scale.toFixed(2) + 'x'; markDirty(); refreshViewer(false); });
    look.append(field('Tamanho', el('div', { class: 'inline' }, range, scaleVal)));
    look.append(field('', checkBound(n, 'glowing', 'Brilho (glowing)', false)));
    if (type !== 'model') {
      const eq = n.equipment && typeof n.equipment === 'object' ? n.equipment : (n.equipment = {});
      look.append(el('details', { class: 'adv' }, el('summary', {}, 'Equipamento'),
        ...[['hand', 'Mão'], ['offhand', 'Mão esq.'], ['head', 'Cabeça'], ['chest', 'Peito'], ['legs', 'Calça'], ['feet', 'Botas']]
          .map(([k, l]) => field(l, inputText(eq, k, { placeholder: k === 'hand' ? 'diamond_sword ou itemsadder:ns:id' : '' })))));
    }
    box.append(look);

    // --- posição ---
    const loc = n.location && typeof n.location === 'object' ? n.location : (n.location = { world: S.worlds[0] || 'world', x: 0, y: 64, z: 0 });
    const pos = section('Posição', '#94a3b8',
      field('Mundo', selectBound(loc, 'world', [...new Set([...(loc.world ? [loc.world] : []), ...S.worlds])].map((w) => [w, w]))),
      el('div', { class: 'grid3' }, field('X', inputNum(loc, 'x', { step: 0.5 })), field('Y', inputNum(loc, 'y', { step: 0.5 })), field('Z', inputNum(loc, 'z', { step: 0.5 }))),
      el('div', { class: 'grid2' }, field('Yaw', inputNum(loc, 'yaw', { step: 1 })), field('Pitch', inputNum(loc, 'pitch', { step: 1 }))));
    if (S.players.length) {
      const who = el('select', {}, S.players.map((p) => el('option', { value: p.name }, `${p.name} (${p.world} ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)})`)));
      pos.append(field('Copiar de', el('div', { class: 'inline' }, who, el('button', { class: 'btn small', onclick: () => {
        const p = S.players.find((x) => x.name === who.value);
        if (!p) return;
        Object.assign(loc, { world: p.world, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: 0 });
        markDirty(); renderInspector();
      } }, 'Usar'))));
      pos.append(el('p', { class: 'hint' }, 'Posições de quando o editor abriu. No jogo: /ned npc move ' + id));
    } else pos.append(el('p', { class: 'hint' }, 'No jogo: /ned npc move ' + id + ' (põe o NPC onde você está).'));
    box.append(pos);

    // --- olhar ---
    box.append(section('Comportamento', '#7dd3fc',
      field('', checkBound(n, 'look-at-player', 'Olhar para o jogador mais perto', true)),
      field('Distância', inputNum(n, 'look-range', { placeholder: '6', min: 1, step: 1 }))));

    // --- animações ---
    const a = anims(n);
    const choices = animationChoices(n);
    const aBox = section('Animações', '#e8c33a');
    if (type === 'model') {
      aBox.append(field('Idle (loop)', selectBound(a, 'idle', [['', '(nenhuma)'], ...choices.map((c) => [c, c])], () => { startSim(); renderTimeline(); })));
    } else {
      aBox.append(el('p', { class: 'hint' }, 'NPC vanilla: swing, swing-offhand, hurt, sneak, nod (sim com a cabeça), shake (não com a cabeça).'));
    }
    aBox.append(field('Aleatórias', chipList(a, 'random', choices, () => { renderInspector(); renderTimeline(); startSim(); })));
    aBox.append(el('div', { class: 'grid2' },
      field('A cada (s)', inputNum(a, 'interval', { placeholder: '5', min: 0.5, step: 0.5, oninput: () => { startSim(); renderTimeline(); } })),
      field('Ordem', selectBound(a, 'mode', [['random', 'Aleatória'], ['sequence', 'Sequência']], () => { startSim(); renderTimeline(); }))));
    aBox.append(field('Ao clicar', chipList(a, 'interact', choices, () => { renderInspector(); renderTimeline(); })));
    box.append(aBox);

    // --- diálogos ---
    const dl = list(n, 'dialogues');
    const dBox = section('Diálogos (na ordem)', '#a06bff',
      el('p', { class: 'hint' }, 'Ao clicar, começa o primeiro disponível de cima para baixo. Requisitos, permissão e paywall ficam no próprio diálogo.'));
    dl.forEach((entry, i) => {
      if (typeof entry === 'string') dl[i] = entry = { id: entry };
      const move = (d) => { const j = i + d; if (j < 0 || j >= dl.length) return; [dl[i], dl[j]] = [dl[j], dl[i]]; markDirty(); renderInspector(); };
      dBox.append(el('div', { class: 'card', style: { '--cc': '#a06bff' } },
        el('div', { class: 'card-head' }, el('span', { class: 'order' }, i + 1),
          selectBound(entry, 'id', dlgOptions('(escolha)')),
          el('button', { class: 'btn ghost small', title: 'Subir', onclick: () => move(-1) }, '↑'),
          el('button', { class: 'btn ghost small', title: 'Descer', onclick: () => move(1) }, '↓'),
          el('button', { class: 'btn ghost small', title: 'Abrir no editor', onclick: () => openDialogueById(entry.id) }, '✎'),
          el('button', { class: 'btn ghost small', title: 'Remover', onclick: () => { dl.splice(i, 1); markDirty(); renderInspector(); } }, '✕')),
        field('Só depois de', selectBound(entry, 'after', dlgOptions('(sempre)'))),
        field('', checkBound(entry, 'repeat', 'Pode repetir', true))));
    });
    dBox.append(el('button', { class: 'btn small wide', onclick: () => { dl.push({ id: S.dialogues[0] ? S.dialogues[0].id : '' }); markDirty(); renderInspector(); } }, '＋ Adicionar diálogo'));
    dBox.append(field('Sem diálogo', inputText(n, 'no-dialogue-message', { placeholder: 'mensagem quando não tem nenhum disponível' })));
    box.append(dBox);

    // --- quests ---
    const related = Object.entries(S.quests).filter(([, q]) => q.npc === id || (q.steps || []).some((s) => s.npc === id || (s.objectives || []).some((o) => o.type === 'talk' && o.npc === id)));
    const qBox = section('Quests', '#e8c33a');
    if (!related.length) qBox.append(el('p', { class: 'hint' }, 'Nenhuma quest usa este NPC.'));
    for (const [qid, q] of related) {
      qBox.append(el('button', { class: 'btn small wide left', onclick: () => { activateTab('quests'); selectQuest(qid); } }, el('span', { html: '📜 ' + mcHtml(q.name || qid) }),
        el('span', { class: 'muted' }, q.npc === id ? ' · dá a quest' : ' · etapa')));
    }
    qBox.append(el('button', { class: 'btn small wide', onclick: () => { activateTab('quests'); newQuest(); } }, '＋ Nova quest com este NPC'));
    box.append(qBox);

    box.append(section('Ao clicar (gatilhos)', '#e8c33a', actionsEditor(n, 'click-commands')));
    box.append(section('Perigo', '#e0473d', el('button', { class: 'btn danger wide', onclick: () => {
      if (!confirm(`Excluir o NPC "${id}"? (some do mundo ao salvar)`)) return;
      delete S.npcs[id];
      S.curNpc = Object.keys(S.npcs)[0] || null;
      viewerKey = '';
      markDirty(); renderNpcList(); refreshViewer(true); renderCrumbs(); renderInspector();
    } }, '🗑 Excluir NPC')));
  }

  /** Lista dos .bbmodel da pasta do BetterModel, com busca. */
  function modelPicker(n, rerender) {
    const wrap = el('div', { class: 'model-picker' });
    const search = el('input', { type: 'search', placeholder: `Buscar entre ${S.models.length} modelos...` });
    const ul = el('div', { class: 'model-list' });
    const fill = () => {
      ul.innerHTML = '';
      const q = search.value.toLowerCase();
      const cur = String(n.model || '').toLowerCase();
      for (const m of S.models) {
        if (q && !m.file.toLowerCase().includes(q)) continue;
        const loaded = S.loadedModels.includes(m.name);
        ul.append(el('div', { class: 'model-row' + (cur === m.name ? ' on' : ''), title: m.file, onclick: () => { n.model = m.name; markDirty(); refreshViewer(); rerender(); } },
          el('span', { class: 'cube' }, '🧊'),
          el('div', { style: { flex: 1, minWidth: 0 } }, el('div', {}, m.name), el('div', { class: 'file' }, m.file + ' · ' + Math.max(1, Math.round(m.size / 1024)) + ' KB')),
          loaded ? el('span', { class: 'tag', style: { background: '#3fbf6f' }, title: 'Carregado no BetterModel' }, 'ok') : el('span', { class: 'tag', style: { background: '#6b7280' }, title: 'O BetterModel ainda não carregou (use /bettermodel reload)' }, '—')));
      }
      if (!ul.children.length) ul.append(el('p', { class: 'hint' }, S.models.length ? 'Nada encontrado.' : 'Nenhum .bbmodel em plugins/BetterModel/models.'));
    };
    search.addEventListener('input', fill);
    fill();
    wrap.append(search, ul);
    return wrap;
  }

  function openDialogueById(id) {
    const d = S.dialogues.find((x) => x.id === id);
    if (!d) return;
    activateTab('dialogues');
    openDialogue(d);
  }

  function activateTab(tab) {
    const b = document.querySelector(`.tab[data-tab="${tab}"]`);
    if (b) b.click();
  }

  // ============================================================
  //  QUESTS
  // ============================================================
  function objEditor(step, rerender) {
    const objs = list(step, 'objectives');
    const wrap = el('div');
    objs.forEach((o, i) => {
      const def = OBJ[o.type] || { l: o.type, c: '#999', f: [] };
      const typeSel = el('select', {}, Object.entries(OBJ).map(([k, v]) => el('option', { value: k }, v.l)));
      typeSel.value = o.type;
      typeSel.addEventListener('change', () => { objs[i] = { type: typeSel.value }; markDirty(); rerender(); });
      const card = el('div', { class: 'card', style: { '--cc': def.c } },
        el('div', { class: 'card-head' }, el('span', { style: { color: def.c } }, '◆'), typeSel,
          el('button', { class: 'btn ghost small', onclick: () => { objs.splice(i, 1); markDirty(); rerender(); } }, '✕')));
      for (const [key, kind, dflt, label] of def.f) {
        if (o[key] === undefined && kind !== 'chk' && dflt !== '') o[key] = dflt;
        let ctl;
        if (kind === 'num') ctl = inputNum(o, key);
        else if (kind === 'chk') { if (o[key] === undefined) o[key] = dflt; ctl = checkBound(o, key, label, dflt); }
        else if (kind === 'sel') ctl = selectBound(o, key, dflt);
        else if (kind === 'dlg') ctl = selectBound(o, key, dlgOptions('(nenhum)'));
        else if (kind === 'npc') ctl = selectBound(o, key, npcOptions('(escolha)'));
        else if (kind === 'world') ctl = selectBound(o, key, [['', '(qualquer)'], ...[...new Set([...(o[key] ? [o[key]] : []), ...S.worlds])].map((w) => [w, w])]);
        else if (kind === 'ent') {
          ctl = el('input', { type: 'text', value: o[key] ?? '', list: 'ned-entities', placeholder: dflt });
          ctl.addEventListener('input', () => { o[key] = ctl.value || undefined; markDirty(); });
        } else ctl = inputText(o, key, { placeholder: dflt });
        card.append(field(kind === 'chk' ? '' : label, ctl));
      }
      if (def.pos && S.players.length) {
        const who = el('select', {}, S.players.map((p) => el('option', { value: p.name }, p.name)));
        card.append(field('Copiar de', el('div', { class: 'inline' }, who, el('button', { class: 'btn small', onclick: () => {
          const p = S.players.find((x) => x.name === who.value);
          if (!p) return;
          Object.assign(o, { world: p.world, x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) });
          markDirty(); rerender();
        } }, 'Usar'))));
      }
      card.append(field('Texto', inputText(o, 'text', { placeholder: 'automático (o que o jogador vê)' })));
      wrap.append(card);
    });
    const add = el('select', {}, el('option', { value: '' }, '＋ Adicionar objetivo...'), Object.entries(OBJ).map(([k, v]) => el('option', { value: k }, v.l)));
    add.addEventListener('change', () => {
      if (!add.value) return;
      objs.push({ type: add.value });
      markDirty();
      rerender();
    });
    wrap.append(add);
    return wrap;
  }

  function renderBoard() {
    const board = $('#quest-board');
    if (!board) return;
    const keepScroll = board.scrollLeft;
    board.innerHTML = '';
    const q = curQuest();
    $('#quest-empty').classList.toggle('hidden', !!q);
    if (!q) return;
    const rerender = () => { renderBoard(); renderQuestList(); };
    const steps = list(q, 'steps');

    // início
    const namePrev = el('div', { class: 'preview', html: mcHtml(q.name || S.curQuest) });
    board.append(el('div', { class: 'qcol start' },
      el('div', { class: 'qcol-head', style: { '--hc': '#3e90ff' } }, '▶ Início'),
      field('Nome', inputText(q, 'name', { placeholder: S.curQuest, oninput: () => { namePrev.innerHTML = mcHtml(q.name || S.curQuest); renderQuestList(); } })),
      namePrev,
      field('NPC', selectBound(q, 'npc', npcOptions('(nenhum)'), rerender)),
      field('Conversa', selectBound(q, 'start-dialogue', dlgOptions('(começa direto)'))),
      field('Começa', selectBound(q, 'begin', [['end', 'ao terminar a conversa'], ['command', 'só pelo gatilho [quest] start']])),
      field('', checkBound(q, 'repeatable', 'Pode repetir depois de concluir', false)),
      el('h5', {}, 'Requisitos para receber'),
      requirementsEditor(q, rerender),
      field('Mensagem', inputText(q, 'deny-message', { placeholder: 'quando não cumpre' }))));

    steps.forEach((st, i) => {
      board.append(el('div', { class: 'qarrow' }, '➜'));
      const move = (d) => { const j = i + d; if (j < 0 || j >= steps.length) return; [steps[i], steps[j]] = [steps[j], steps[i]]; markDirty(); rerender(); };
      board.append(el('div', { class: 'qcol' },
        el('div', { class: 'qcol-head', style: { '--hc': '#e8c33a' } }, el('span', { class: 'order' }, i + 1), 'Etapa',
          el('span', { style: { flex: 1 } }),
          el('button', { class: 'btn ghost small', title: 'Mover para a esquerda', onclick: () => move(-1) }, '←'),
          el('button', { class: 'btn ghost small', title: 'Mover para a direita', onclick: () => move(1) }, '→'),
          el('button', { class: 'btn ghost small', title: 'Excluir etapa', onclick: () => { if (confirm('Excluir esta etapa?')) { steps.splice(i, 1); markDirty(); rerender(); } } }, '✕')),
        field('Nome', inputText(st, 'name', { placeholder: 'Etapa ' + (i + 1) })),
        el('h5', {}, 'Objetivos'),
        objEditor(st, rerender),
        el('h5', {}, 'Entrega'),
        field('Entregar a', selectBound(st, 'npc', npcOptions('(NPC da quest)'))),
        field('', checkBound(st, 'auto-complete', 'Concluir sozinha (sem voltar ao NPC)', false)),
        field('Esperando', selectBound(st, 'waiting-dialogue', dlgOptions('(lista do que falta no chat)'))),
        field('Ao entregar', selectBound(st, 'complete-dialogue', dlgOptions('(nenhum)'))),
        el('h5', {}, 'Recompensas da etapa'),
        actionsEditor(st, 'rewards')));
    });
    board.append(el('div', { class: 'qarrow' }, '➜'));
    board.append(el('div', { class: 'qcol add', onclick: () => { steps.push({ name: 'Etapa ' + (steps.length + 1), objectives: [] }); markDirty(); rerender(); } },
      el('div', { class: 'big' }, '＋'), 'Nova etapa'));
    board.append(el('div', { class: 'qarrow' }, '➜'));
    board.append(el('div', { class: 'qcol end' },
      el('div', { class: 'qcol-head', style: { '--hc': '#3fbf6f' } }, '✦ Fim'),
      el('p', { class: 'hint' }, 'Ao entregar a última etapa: roda as recompensas abaixo e a quest fica concluída.'),
      actionsEditor(q, 'rewards')));
    board.scrollLeft = keepScroll;
  }

  function inspectQuest(box) {
    const q = curQuest();
    if (!q) {
      box.append(el('div', { class: 'section' }, el('p', { class: 'hint' }, 'Escolha uma quest na lista, ou crie uma nova.'),
        el('button', { class: 'btn primary wide', onclick: newQuest }, '＋ Nova quest')));
      return;
    }
    const id = S.curQuest;
    const idInput = el('input', { type: 'text', value: id, title: 'ID da quest' });
    idInput.addEventListener('change', () => {
      const nid = idInput.value.trim();
      if (nid === id) return;
      if (!/^[A-Za-z0-9_.-]+$/.test(nid) || S.quests[nid]) { alert('ID inválido ou já usado'); idInput.value = id; return; }
      renameKey(S.quests, id, nid);
      S.curQuest = nid;
      markDirty(); renderCrumbs(); renderQuestList(); renderInspector();
    });
    box.append(el('div', { class: 'insp-head', style: { '--hc': '#e8c33a' } }, el('span', { class: 'bar' }), el('h3', {}, '📜 Quest'), idInput));
    const steps = list(q, 'steps');
    const objCount = steps.reduce((a, s) => a + (s.objectives || []).length, 0);
    box.append(section('Resumo', '#e8c33a',
      el('div', { class: 'stat-row' }, el('div', {}, el('strong', {}, steps.length), el('span', {}, 'etapas')), el('div', {}, el('strong', {}, objCount), el('span', {}, 'objetivos')),
        el('div', {}, el('strong', {}, q.npc || '—'), el('span', {}, 'NPC'))),
      q.npc && !S.npcs[q.npc] ? el('p', { class: 'warn-box' }, `⚠ O NPC "${q.npc}" não existe.`) : null,
      q.npc ? el('button', { class: 'btn small wide', onclick: () => { activateTab('npcs'); selectNpc(q.npc); } }, 'Abrir NPC ' + q.npc) : null));
    box.append(section('Como funciona', '#7dd3fc',
      el('ol', { class: 'howto' },
        el('li', {}, 'O jogador clica no NPC da quest e vê a conversa de início.'),
        el('li', {}, 'Ao terminar a conversa (ou pelo gatilho [quest] start), a etapa 1 começa.'),
        el('li', {}, 'Ele cumpre os objetivos e volta ao NPC de entrega: itens/dinheiro marcados são tirados e as recompensas dadas.'),
        el('li', {}, 'Repete até a última etapa.'))));
    box.append(section('Placeholders', '#c084fc',
      ...['status', 'step', 'steps', 'stepname', 'objective', 'done'].map((f) => el('code', { class: 'ph' }, `%ned_quest_${id}_${f}%`)),
      el('p', { class: 'hint' }, 'Também dá pra usar nos requisitos: flag quest.' + id + '.step (0 = primeira etapa).')));
    box.append(section('Testar', '#3fbf6f', el('code', { class: 'ph' }, '/ned quest start ' + id), el('code', { class: 'ph' }, '/ned quest complete ' + id), el('code', { class: 'ph' }, '/ned quest reset ' + id)));
    box.append(section('Perigo', '#e0473d', el('button', { class: 'btn danger wide', onclick: () => {
      if (!confirm(`Excluir a quest "${id}"? (o progresso dos jogadores fica guardado nas flags)`)) return;
      delete S.quests[id];
      S.curQuest = Object.keys(S.quests)[0] || null;
      markDirty(); renderQuestList(); renderBoard(); renderCrumbs(); renderInspector();
    } }, '🗑 Excluir quest')));
  }

  // ============================================================
  //  BOTÕES
  // ============================================================
  $('#btn-new-npc').addEventListener('click', newNpc);
  $('#btn-new-quest').addEventListener('click', newQuest);
  $('#btn-top-npc').addEventListener('click', newNpc);
  $('#btn-top-quest').addEventListener('click', newQuest);
  $('#npc-search').addEventListener('input', renderNpcList);
  $('#quest-search').addEventListener('input', renderQuestList);
  $('#btn-frame').addEventListener('click', () => viewer && viewer.frame());
  $('#btn-grid').addEventListener('click', (e) => { if (!viewer) return; viewer.grid = !viewer.grid; e.currentTarget.classList.toggle('on', viewer.grid); });
  $('#btn-front').addEventListener('click', () => { if (viewer) { viewer.cam.yaw = 0; viewer.cam.pitch = 0.1; } });
  $('#btn-side').addEventListener('click', () => { if (viewer) { viewer.cam.yaw = Math.PI / 2; viewer.cam.pitch = 0.1; } });
  // lista de mobs para os campos "Mob"
  const dl = el('datalist', { id: 'ned-entities' });
  document.body.append(dl);
  const fillEntities = () => { dl.innerHTML = ''; (S.entities.length ? S.entities : Object.keys(MOB_SIZE)).forEach((e) => dl.append(el('option', { value: e }))); };
  fillEntities();

  window.NED_NPC = {
    renderNpcList, renderQuestList, renderInspector: npcInspector, renderCrumbs: npcCrumbs,
    modeChanged: (mode) => { fillEntities(); viewerKey = ''; modeChanged(mode); },
  };
})();
