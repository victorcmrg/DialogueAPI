'use strict';
/* NotEnoughDialogues - visualizador 3D dos NPCs (estilo Blockbench). WebGL puro, sem dependências.
 *
 *   const v = new Viewer3D(canvas);
 *   v.setModel(Viewer3D.fromBBModel(json)) | v.setModel(Viewer3D.playerModel(skinUrl, slim)) | v.setModel(Viewer3D.boxModel(w, h))
 *   v.play('walk', {loop: true}); v.stop();
 *
 * Unidade = pixel do Blockbench (16 = 1 bloco). Modelos olham para o norte (-Z), como no Blockbench.
 */
(function () {
  // ============================================================
  //  MATRIZES 4x4 (coluna maior, como o WebGL)
  // ============================================================
  const M = {
    id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    },
    tr: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
    sc: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
    rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
    ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    /** Rotação de Euler do Blockbench (ordem ZYX do three.js: aplica X, depois Y, depois Z). */
    euler(x, y, z) { return M.mul(M.rz(z), M.mul(M.ry(y), M.rx(x))); },
    persp(fov, asp, n, f) {
      const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
    },
    look(eye, at, up) {
      let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1];
    },
    apply(m, p) {
      const x = p[0], y = p[1], z = p[2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
    },
  };
  const RAD = Math.PI / 180;

  // ============================================================
  //  MOLANG (só o básico: números, math.*, query.anim_time)
  // ============================================================
  const molangCache = new Map();
  function molang(v, t) {
    if (typeof v === 'number') return v;
    if (v === undefined || v === null || v === '') return 0;
    const s = String(v).trim();
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
    let f = molangCache.get(s);
    if (f === undefined) {
      const expr = s.toLowerCase()
        .replace(/\b(q|query)\.(anim_time|life_time)\b/g, 't')
        .replace(/\b(v|variable|q|query|c|context|temp|t)\.[a-z_.0-9]+/g, '0')
        .replace(/\bmath\.(sin|cos)\(/g, (_, fn) => `M_${fn}(`)
        .replace(/\bmath\.(abs|floor|ceil|round|sqrt|min|max|pow|random)\b/g, 'Math.$1')
        .replace(/\bmath\.clamp\(/g, 'M_clamp(').replace(/\bmath\.lerp\(/g, 'M_lerp(').replace(/\bmath\.pi\b/g, 'Math.PI');
      f = /^[\d\s+\-*/%().,?:<>=!&|tMathPIsincoabflerqdumxwpCRDOU_]*$/.test(expr)
        ? (() => { try { return new Function('t', 'M_sin', 'M_cos', 'M_clamp', 'M_lerp', `return (${expr});`); } catch { return null; } })()
        : null;
      molangCache.set(s, f);
    }
    if (!f) return 0;
    try {
      const r = f(t, (d) => Math.sin(d * RAD), (d) => Math.cos(d * RAD), (x, a, b) => Math.min(b, Math.max(a, x)), (a, b, k) => a + (b - a) * k);
      return Number.isFinite(r) ? r : 0;
    } catch { return 0; }
  }

  // ============================================================
  //  GEOMETRIA DE UM CUBO
  // ============================================================
  /** Cantos de cada face: topo-esquerda, topo-direita, baixo-direita, baixo-esquerda (vista de fora). */
  function faceCorners(f, a, b) {
    const [x1, y1, z1] = a, [x2, y2, z2] = b;
    switch (f) {
      case 'north': return [[x2, y2, z1], [x1, y2, z1], [x1, y1, z1], [x2, y1, z1]];
      case 'south': return [[x1, y2, z2], [x2, y2, z2], [x2, y1, z2], [x1, y1, z2]];
      case 'east': return [[x2, y2, z2], [x2, y2, z1], [x2, y1, z1], [x2, y1, z2]];
      case 'west': return [[x1, y2, z1], [x1, y2, z2], [x1, y1, z2], [x1, y1, z1]];
      case 'up': return [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]];
      default: return [[x1, y1, z2], [x2, y1, z2], [x2, y1, z1], [x1, y1, z1]];
    }
  }
  const SHADE = { up: 1, down: 0.55, north: 0.8, south: 0.8, east: 0.66, west: 0.66 };
  const FACES = ['north', 'south', 'east', 'west', 'up', 'down'];

  /** UV de cada face no modo "box UV" (skins e modelos antigos). */
  function boxUv(u, v, w, h, d) {
    return {
      east: [u, v + d, u + d, v + d + h], north: [u + d, v + d, u + d + w, v + d + h],
      west: [u + d + w, v + d, u + 2 * d + w, v + d + h], south: [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
      up: [u + d + w, v + d, u + d, v], down: [u + d + 2 * w, v, u + d + w, v + d],
    };
  }

  // ============================================================
  //  MODELOS
  // ============================================================
  /**
   * Modelo genérico: { textures: [{src, w, h}], bones: [{id, name, parent, origin, rotation, elements: [...]}],
   *   animations: [{name, length, loop, animators: {boneId: {rotation:[kf], position:[kf], scale:[kf]}}}] }
   * elemento: {from, to, origin, rotation, inflate, faces: {north: {uv, texture, rotation}}}
   */
  function fromBBModel(json) {
    const res = json.resolution || { width: 16, height: 16 };
    const textures = (json.textures || []).map((t) => ({
      src: t.source || '', w: t.uv_width || res.width || 16, h: t.uv_height || res.height || 16,
    }));
    const elements = new Map((json.elements || []).map((e) => [e.uuid, e]));
    const groupsByUuid = new Map((json.groups || []).map((g) => [g.uuid, g]));
    const bones = [];
    const root = { id: '__root', name: 'root', parent: null, origin: [0, 0, 0], rotation: [0, 0, 0], elements: [] };
    bones.push(root);

    const addElement = (bone, el) => {
      if (!el || el.visibility === false || el.type === 'locator' || el.type === 'null_object') return;
      if (el.type === 'mesh') return; // malhas livres: não suportadas na prévia
      let rot = el.rotation || [0, 0, 0];
      let origin = el.origin || [0, 0, 0];
      if (!Array.isArray(rot)) { // formato antigo {angle, axis, origin}
        const r = [0, 0, 0];
        r['xyz'.indexOf(rot.axis || 'y')] = rot.angle || 0;
        origin = rot.origin || origin;
        rot = r;
      }
      const faces = {};
      let fallback = null;
      if (el.box_uv && el.uv_offset) {
        fallback = boxUv(el.uv_offset[0], el.uv_offset[1], Math.abs(el.to[0] - el.from[0]), Math.abs(el.to[1] - el.from[1]), Math.abs(el.to[2] - el.from[2]));
      }
      for (const f of FACES) {
        const fd = el.faces && el.faces[f];
        if (!fd || fd.texture === null || fd.texture === undefined || fd.texture === false) continue;
        faces[f] = { uv: fd.uv || (fallback && fallback[f]) || [0, 0, 1, 1], texture: typeof fd.texture === 'number' ? fd.texture : 0, rotation: fd.rotation || 0 };
      }
      bone.elements.push({ from: el.from, to: el.to, origin, rotation: rot, inflate: el.inflate || 0, faces });
    };

    const walk = (node, parent) => {
      if (typeof node === 'string') return addElement(parent, elements.get(node));
      if (!node || typeof node !== 'object') return;
      const g = Object.assign({}, groupsByUuid.get(node.uuid) || {}, node);
      if (g.visibility === false) return;
      const bone = { id: g.uuid, name: g.name || 'bone', parent, origin: g.origin || [0, 0, 0], rotation: g.rotation || [0, 0, 0], elements: [] };
      bones.push(bone);
      for (const c of g.children || []) walk(c, bone);
    };
    for (const n of json.outliner || []) walk(n, root);
    // sem outliner (modelo antigo): tudo no root
    if (!json.outliner) for (const e of elements.values()) addElement(root, e);

    const animations = (json.animations || []).map((a) => {
      const animators = {};
      for (const [uuid, an] of Object.entries(a.animators || {})) {
        const ch = { rotation: [], position: [], scale: [] };
        for (const k of an.keyframes || []) {
          if (!ch[k.channel]) continue;
          ch[k.channel].push({ time: Number(k.time) || 0, p: (k.data_points && k.data_points[0]) || { x: 0, y: 0, z: 0 }, interp: k.interpolation || 'linear' });
        }
        for (const list of Object.values(ch)) list.sort((x, y) => x.time - y.time);
        // por uuid; e também pelo nome do osso (BetterModel/arquivos antigos)
        animators[uuid] = ch;
        if (an.name) animators['name:' + an.name] = ch;
      }
      return { name: a.name, length: Number(a.length) || 0, loop: a.loop || 'once', animators };
    });
    return { textures, bones, animations };
  }

  /** Boneco de player com a skin (64x64). Olha para o norte, braço direito em +X. */
  function playerModel(skinUrl, slim) {
    const aw = slim ? 3 : 4;
    const part = (from, to, u, v, inflate = 0) => {
      const w = to[0] - from[0], h = to[1] - from[1], d = to[2] - from[2];
      const uv = boxUv(u, v, w, h, d);
      const faces = {};
      for (const f of FACES) faces[f] = { uv: uv[f], texture: 0, rotation: 0 };
      return { from, to, origin: [0, 0, 0], rotation: [0, 0, 0], inflate, faces };
    };
    const root = { id: '__root', name: 'root', parent: null, origin: [0, 0, 0], rotation: [0, 0, 0], elements: [] };
    const bone = (name, origin, els) => ({ id: name, name, parent: root, origin, rotation: [0, 0, 0], elements: els });
    const bones = [root,
      bone('head', [0, 24, 0], [part([-4, 24, -4], [4, 32, 4], 0, 0), part([-4, 24, -4], [4, 32, 4], 32, 0, 0.5)]),
      bone('body', [0, 24, 0], [part([-4, 12, -2], [4, 24, 2], 16, 16), part([-4, 12, -2], [4, 24, 2], 16, 32, 0.25)]),
      bone('right_arm', [5, 22, 0], [part([4, 12, -2], [4 + aw, 24, 2], 40, 16), part([4, 12, -2], [4 + aw, 24, 2], 40, 32, 0.25)]),
      bone('left_arm', [-5, 22, 0], [part([-4 - aw, 12, -2], [-4, 24, 2], 32, 48), part([-4 - aw, 12, -2], [-4, 24, 2], 48, 48, 0.25)]),
      bone('right_leg', [2, 12, 0], [part([0, 0, -2], [4, 12, 2], 0, 16), part([0, 0, -2], [4, 12, 2], 0, 32, 0.25)]),
      bone('left_leg', [-2, 12, 0], [part([-4, 0, -2], [0, 12, 2], 16, 48), part([-4, 0, -2], [0, 12, 2], 0, 48, 0.25)]),
    ];
    const anim = (name, length, loop, tracks) => {
      const animators = {};
      for (const [b, ch] of Object.entries(tracks)) {
        const out = { rotation: [], position: [], scale: [] };
        for (const [c, kfs] of Object.entries(ch)) out[c] = kfs.map(([time, x, y, z]) => ({ time, p: { x, y, z }, interp: 'linear' }));
        animators['name:' + b] = out;
      }
      return { name, length, loop, animators };
    };
    const animations = [
      anim('idle', 3, 'loop', { right_arm: { rotation: [[0, 0, 0, 3], [1.5, 0, 0, 6], [3, 0, 0, 3]] }, left_arm: { rotation: [[0, 0, 0, -3], [1.5, 0, 0, -6], [3, 0, 0, -3]] } }),
      anim('swing', 0.35, 'once', { right_arm: { rotation: [[0, 0, 0, 0], [0.15, 80, -10, 0], [0.35, 0, 0, 0]] }, body: { rotation: [[0, 0, 0, 0], [0.15, 0, -12, 0], [0.35, 0, 0, 0]] } }),
      anim('swing-offhand', 0.35, 'once', { left_arm: { rotation: [[0, 0, 0, 0], [0.15, 80, 10, 0], [0.35, 0, 0, 0]] }, body: { rotation: [[0, 0, 0, 0], [0.15, 0, 12, 0], [0.35, 0, 0, 0]] } }),
      anim('hurt', 0.4, 'once', { __root: { rotation: [[0, 0, 0, 0], [0.1, -8, 0, 0], [0.4, 0, 0, 0]] } }),
      anim('sneak', 1, 'once', { body: { rotation: [[0, 0, 0, 0], [0.1, -28, 0, 0], [0.9, -28, 0, 0], [1, 0, 0, 0]] }, head: { position: [[0, 0, 0, 0], [0.1, 0, -3, 0], [0.9, 0, -3, 0], [1, 0, 0, 0]] } }),
      anim('nod', 0.8, 'once', { head: { rotation: [[0, 0, 0, 0], [0.2, -25, 0, 0], [0.4, 0, 0, 0], [0.6, -25, 0, 0], [0.8, 0, 0, 0]] } }),
      anim('shake', 0.8, 'once', { head: { rotation: [[0, 0, 0, 0], [0.2, 0, 30, 0], [0.4, 0, -30, 0], [0.6, 0, 30, 0], [0.8, 0, 0, 0]] } }),
    ];
    for (const a of animations) { // nomes -> ids dos ossos
      for (const k of Object.keys(a.animators)) a.animators[k.replace('name:__root', '__root')] = a.animators[k];
    }
    return { textures: [{ src: skinUrl, w: 64, h: 64, prepare: normalizeSkin }], bones, animations, player: true };
  }

  /**
   * Skin antiga 64x32 -> 64x64 como o Minecraft faz: braço/perna esquerdos copiados (espelhados) do direito,
   * e o "chapéu" todo opaco é ignorado.
   */
  function normalizeSkin(img) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, 64, img.height === 32 ? 32 : 64);
    if (img.height !== 32) return c;
    const mirror = (sx, sy, w, h, dx, dy) => {
      g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(c, sx, sy, w, h, 0, 0, w, h); g.restore();
    };
    // perna (0,16) -> (16,48) e braço (40,16) -> (32,48), face por face
    for (const [sx, sy, dx, dy] of [[0, 16, 16, 48], [40, 16, 32, 48]]) {
      mirror(sx + 4, sy, 4, 4, dx + 4, dy); mirror(sx + 8, sy, 4, 4, dx + 8, dy);
      mirror(sx, sy + 4, 4, 12, dx + 8, dy + 4); mirror(sx + 4, sy + 4, 4, 12, dx + 4, dy + 4);
      mirror(sx + 8, sy + 4, 4, 12, dx, dy + 4); mirror(sx + 12, sy + 4, 4, 12, dx + 12, dy + 4);
    }
    try {
      const px = g.getImageData(32, 0, 32, 16).data;
      let transparent = false;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 128) { transparent = true; break; }
      if (!transparent) g.clearRect(32, 0, 32, 16);
    } catch { /* imagem sem CORS: deixa como está */ }
    return c;
  }

  /** Caixa simples (mob vanilla sem prévia): w x h blocos. */
  function boxModel(w, h, color) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = color || '#6b7280'; g.fillRect(0, 0, 16, 16);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 15, 15);
    const W = w * 16, H = h * 16;
    const faces = {};
    for (const f of FACES) faces[f] = { uv: [0, 0, 16, 16], texture: 0, rotation: 0 };
    const root = { id: '__root', name: 'root', parent: null, origin: [0, 0, 0], rotation: [0, 0, 0],
      elements: [{ from: [-W / 2, 0, -W / 2], to: [W / 2, H, W / 2], origin: [0, 0, 0], rotation: [0, 0, 0], inflate: 0, faces }] };
    return { textures: [{ src: c.toDataURL(), w: 16, h: 16 }], bones: [root], animations: [] };
  }

  // ============================================================
  //  RENDER
  // ============================================================
  const VS = `attribute vec3 p; attribute vec2 uv; attribute float sh; uniform mat4 mvp; varying vec2 vUv; varying float vSh;
    void main(){ vUv = uv; vSh = sh; gl_Position = mvp * vec4(p, 1.0); }`;
  const FS = `precision mediump float; uniform sampler2D tex; uniform vec4 tint; varying vec2 vUv; varying float vSh;
    void main(){ vec4 c = texture2D(tex, vUv); if (c.a < 0.1) discard; gl_FragColor = vec4(mix(c.rgb * vSh, tint.rgb, tint.a), c.a); }`;
  const LVS = `attribute vec3 p; uniform mat4 mvp; void main(){ gl_Position = mvp * vec4(p, 1.0); }`;
  const LFS = `precision mediump float; uniform vec4 color; void main(){ gl_FragColor = color; }`;

  class Viewer3D {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false });
      this.gl = gl;
      this.ok = !!gl;
      this.cam = { yaw: -35 * RAD, pitch: 18 * RAD, dist: 70, target: [0, 16, 0] };
      this.scale = 1;
      this.model = null;
      this.anim = null;     // {a, start, loop}
      this.base = null;     // animação de idle em loop
      this.hitbox = null;   // [w, h] em blocos
      this.grid = true;
      this.tintUntil = 0;
      this.onframe = null;
      if (!gl) return;
      this.prog = this._program(VS, FS);
      this.lprog = this._program(LVS, LFS);
      this._buildGrid();
      this._hook();
      const loop = () => { this._raf = requestAnimationFrame(loop); this.render(); };
      loop();
    }

    destroy() { cancelAnimationFrame(this._raf); this._unhook && this._unhook(); }

    _program(vs, fs) {
      const gl = this.gl;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      return p;
    }

    _buildGrid() {
      const pts = [];
      const N = 4, S = 16; // 9x9 blocos
      for (let i = -N; i <= N + 1; i++) {
        pts.push(i * S - S / 2, 0, -N * S - S / 2, i * S - S / 2, 0, (N + 1) * S - S / 2);
        pts.push(-N * S - S / 2, 0, i * S - S / 2, (N + 1) * S - S / 2, 0, i * S - S / 2);
      }
      this.gridBuf = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gridBuf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(pts), this.gl.STATIC_DRAW);
      this.gridCount = pts.length / 3;
      // eixo norte (azul) e leste (vermelho)
      this.axisBuf = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.axisBuf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([0, 0.05, 0, 0, 0.05, -24, 0, 0.05, 0, 24, 0.05, 0]), this.gl.STATIC_DRAW);
      this.lineBuf = this.gl.createBuffer();
    }

    _hook() {
      const c = this.canvas;
      let drag = null;
      const down = (e) => { drag = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }; e.preventDefault(); };
      const move = (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        if (drag.b === 2 || drag.b === 1 || drag.shift) {
          const k = this.cam.dist / 400;
          const cy = Math.cos(this.cam.yaw), sy = Math.sin(this.cam.yaw);
          this.cam.target[0] += (dx * cy) * k; this.cam.target[2] += (dx * sy) * k;
          this.cam.target[1] += dy * k;
        } else {
          this.cam.yaw += dx * 0.01;
          this.cam.pitch = Math.max(-1.4, Math.min(1.4, this.cam.pitch + dy * 0.01));
        }
      };
      const up = () => { drag = null; };
      const wheel = (e) => { e.preventDefault(); this.cam.dist = Math.max(8, Math.min(600, this.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); };
      const ctx = (e) => e.preventDefault();
      c.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      c.addEventListener('wheel', wheel, { passive: false }); c.addEventListener('contextmenu', ctx);
      this._unhook = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }

    /** Enquadra o modelo inteiro. */
    frame() {
      const b = this.bounds();
      const h = Math.max(8, (b.max[1] - b.min[1]) * this.scale), w = Math.max(8, Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) * this.scale);
      this.cam.target = [0, (b.min[1] + (b.max[1] - b.min[1]) / 2) * this.scale, 0];
      this.cam.dist = Math.max(h, w) * 1.9 + 10;
      this.cam.yaw = -35 * RAD; // de frente (norte) e um pouco de lado
      this.cam.pitch = 15 * RAD;
    }

    bounds() {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const b of (this.model && this.model.bones) || []) for (const e of b.elements) {
        for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], e.from[i], e.to[i]); max[i] = Math.max(max[i], e.from[i], e.to[i]); }
      }
      if (min[0] === Infinity) return { min: [-8, 0, -8], max: [8, 32, 8] };
      return { min, max };
    }

    setModel(model) {
      this.model = model;
      this.anim = null;
      this.base = null;
      if (!this.ok || !model) return;
      const gl = this.gl;
      // texturas
      model.gl = model.textures.map((t) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 200, 200, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (t.src) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (this.model !== model) return;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.prepare ? t.prepare(img) : img);
          };
          img.onerror = () => t.onerror && t.onerror();
          img.src = t.src;
        }
        return tex;
      });
      // um buffer por (osso, textura)
      for (const bone of model.bones) {
        bone.draws = [];
        const byTex = new Map();
        for (const e of bone.elements) {
          const inf = e.inflate || 0;
          const a = [Math.min(e.from[0], e.to[0]) - inf, Math.min(e.from[1], e.to[1]) - inf, Math.min(e.from[2], e.to[2]) - inf];
          const b = [Math.max(e.from[0], e.to[0]) + inf, Math.max(e.from[1], e.to[1]) + inf, Math.max(e.from[2], e.to[2]) + inf];
          const r = e.rotation || [0, 0, 0];
          const o = e.origin || [0, 0, 0];
          const rot = (r[0] || r[1] || r[2]) ? M.mul(M.tr(o[0], o[1], o[2]), M.mul(M.euler(r[0] * RAD, r[1] * RAD, r[2] * RAD), M.tr(-o[0], -o[1], -o[2]))) : null;
          for (const [f, fd] of Object.entries(e.faces)) {
            const t = model.textures[fd.texture] || model.textures[0];
            if (!t) continue;
            let list = byTex.get(fd.texture);
            if (!list) byTex.set(fd.texture, (list = []));
            const cs = faceCorners(f, a, b).map((p) => (rot ? M.apply(rot, p) : p));
            const [u1, v1, u2, v2] = fd.uv;
            let uvs = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]];
            for (let k = 0; k < ((fd.rotation || 0) / 90) % 4; k++) uvs = [uvs[3], uvs[0], uvs[1], uvs[2]];
            const sh = SHADE[f];
            const vert = (i) => list.push(cs[i][0], cs[i][1], cs[i][2], uvs[i][0] / t.w, uvs[i][1] / t.h, sh);
            [0, 1, 2, 0, 2, 3].forEach(vert);
          }
        }
        for (const [ti, list] of byTex) {
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(list), gl.STATIC_DRAW);
          bone.draws.push({ buf, count: list.length / 6, tex: ti });
        }
      }
    }

    animations() { return this.model ? this.model.animations.map((a) => a.name) : []; }

    /** Toca uma animação por cima do idle. once = volta pro idle ao terminar. */
    play(name, opts = {}) {
      const a = this.model && this.model.animations.find((x) => x.name === name);
      if (!a) return false;
      const rec = { a, start: performance.now(), loop: opts.loop !== undefined ? opts.loop : a.loop === 'loop' };
      if (opts.base) this.base = rec; else this.anim = rec;
      if (name === 'hurt' && this.model.player) this.tintUntil = performance.now() + 350;
      return true;
    }

    stop() { this.anim = null; this.base = null; }

    /** Pose de cada osso numa animação no tempo t (s). */
    _sample(ch, t) {
      if (!ch || !ch.length) return null;
      if (t <= ch[0].time || ch.length === 1) return [molang(ch[0].p.x, t), molang(ch[0].p.y, t), molang(ch[0].p.z, t)];
      const last = ch[ch.length - 1];
      if (t >= last.time) return [molang(last.p.x, t), molang(last.p.y, t), molang(last.p.z, t)];
      let i = 0;
      while (i < ch.length - 1 && ch[i + 1].time < t) i++;
      const k1 = ch[i], k2 = ch[i + 1];
      const v1 = [molang(k1.p.x, t), molang(k1.p.y, t), molang(k1.p.z, t)];
      if (k1.interp === 'step') return v1;
      const v2 = [molang(k2.p.x, t), molang(k2.p.y, t), molang(k2.p.z, t)];
      let k = (t - k1.time) / Math.max(1e-6, k2.time - k1.time);
      if (k1.interp === 'catmullrom' || k2.interp === 'catmullrom') k = k * k * (3 - 2 * k);
      return v1.map((v, j) => v + (v2[j] - v) * k);
    }

    _animTime(rec, now) {
      if (!rec) return null;
      let t = (now - rec.start) / 1000;
      const len = rec.a.length || 0;
      if (len > 0 && t > len) {
        if (rec.loop) t %= len;
        else return null;
      }
      return t;
    }

    render() {
      const gl = this.gl;
      if (!gl) return;
      const c = this.canvas;
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.floor(c.clientWidth * dpr)), H = Math.max(1, Math.floor(c.clientHeight * dpr));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const cam = this.cam;
      const eye = [cam.target[0] + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
        cam.target[1] + Math.sin(cam.pitch) * cam.dist,
        cam.target[2] - Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist];
      const vp = M.mul(M.persp(45 * RAD, W / H, 1, 4000), M.look(eye, cam.target, [0, 1, 0]));
      this.vp = vp;

      // grade
      if (this.grid) {
        gl.useProgram(this.lprog);
        const lp = gl.getAttribLocation(this.lprog, 'p');
        gl.uniformMatrix4fv(gl.getUniformLocation(this.lprog, 'mvp'), false, new Float32Array(vp));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuf);
        gl.enableVertexAttribArray(lp);
        gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4f(gl.getUniformLocation(this.lprog, 'color'), 1, 1, 1, 0.09);
        gl.drawArrays(gl.LINES, 0, this.gridCount);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.axisBuf);
        gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4f(gl.getUniformLocation(this.lprog, 'color'), 0.24, 0.56, 1, 0.9);
        gl.drawArrays(gl.LINES, 0, 2);
        gl.uniform4f(gl.getUniformLocation(this.lprog, 'color'), 0.88, 0.28, 0.24, 0.9);
        gl.drawArrays(gl.LINES, 2, 2);
      }

      const model = this.model;
      if (!model || !model.gl) return;
      const now = performance.now();
      const tA = this._animTime(this.anim, now);
      if (this.anim && tA === null) this.anim = null;
      const tB = this._animTime(this.base, now);

      // matriz de cada osso
      const world = new Map();
      const S = M.sc(this.scale, this.scale, this.scale);
      for (const bone of model.bones) {
        const parent = bone.parent ? world.get(bone.parent.id) : S;
        const o = bone.origin;
        let rx = bone.rotation[0] * RAD, ry = bone.rotation[1] * RAD, rz = bone.rotation[2] * RAD;
        let px = 0, py = 0, pz = 0, sx = 1, sy = 1, sz = 1;
        const recs = [[this.base, tB], [this.anim, tA]];
        for (const [rec, t] of recs) {
          if (!rec || t === null) continue;
          const an = rec.a.animators[bone.id] || rec.a.animators['name:' + bone.name];
          if (!an) continue;
          const r = this._sample(an.rotation, t), p = this._sample(an.position, t), s = this._sample(an.scale, t);
          // mesma conversão do Blockbench (x e y invertidos)
          if (r) { rx -= r[0] * RAD; ry -= r[1] * RAD; rz += r[2] * RAD; }
          if (p) { px -= p[0]; py += p[1]; pz += p[2]; }
          if (s) { sx *= s[0]; sy *= s[1]; sz *= s[2]; }
        }
        let local = M.tr(o[0] + px, o[1] + py, o[2] + pz);
        local = M.mul(local, M.euler(rx, ry, rz));
        if (sx !== 1 || sy !== 1 || sz !== 1) local = M.mul(local, M.sc(sx, sy, sz));
        local = M.mul(local, M.tr(-o[0], -o[1], -o[2]));
        world.set(bone.id, M.mul(parent, local));
      }

      gl.useProgram(this.prog);
      const ap = gl.getAttribLocation(this.prog, 'p'), au = gl.getAttribLocation(this.prog, 'uv'), as = gl.getAttribLocation(this.prog, 'sh');
      const umvp = gl.getUniformLocation(this.prog, 'mvp');
      const tint = now < this.tintUntil ? 0.45 : 0;
      gl.uniform4f(gl.getUniformLocation(this.prog, 'tint'), 1, 0.15, 0.15, tint);
      gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(au); gl.enableVertexAttribArray(as);
      for (const bone of model.bones) {
        if (!bone.draws || !bone.draws.length) continue;
        gl.uniformMatrix4fv(umvp, false, new Float32Array(M.mul(vp, world.get(bone.id))));
        for (const d of bone.draws) {
          gl.bindTexture(gl.TEXTURE_2D, model.gl[d.tex] || model.gl[0]);
          gl.bindBuffer(gl.ARRAY_BUFFER, d.buf);
          gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 24, 0);
          gl.vertexAttribPointer(au, 2, gl.FLOAT, false, 24, 12);
          gl.vertexAttribPointer(as, 1, gl.FLOAT, false, 24, 20);
          gl.drawArrays(gl.TRIANGLES, 0, d.count);
        }
      }
      gl.disableVertexAttribArray(au); gl.disableVertexAttribArray(as);

      // hitbox (Interaction) em arame
      if (this.hitbox) {
        const [w, h] = this.hitbox, X = w * 8, Y = h * 16;
        const v = [[-X, 0, -X], [X, 0, -X], [X, 0, X], [-X, 0, X], [-X, Y, -X], [X, Y, -X], [X, Y, X], [-X, Y, X]];
        const E = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
        const pts = [];
        for (const i of E) pts.push(...v[i]);
        gl.useProgram(this.lprog);
        const lp = gl.getAttribLocation(this.lprog, 'p');
        gl.uniformMatrix4fv(gl.getUniformLocation(this.lprog, 'mvp'), false, new Float32Array(vp));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4f(gl.getUniformLocation(this.lprog, 'color'), 0.91, 0.76, 0.23, 0.85);
        gl.drawArrays(gl.LINES, 0, pts.length / 3);
      }
      this.onframe && this.onframe(this);
    }

    /** Ponto 3D (pixels do modelo, já com escala) -> posição na tela (px CSS), ou null atrás da câmera. */
    project(p) {
      if (!this.vp) return null;
      const m = this.vp, x = p[0], y = p[1], z = p[2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0) return null;
      const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      return [(nx + 1) / 2 * this.canvas.clientWidth, (1 - ny) / 2 * this.canvas.clientHeight];
    }
  }

  Viewer3D.fromBBModel = fromBBModel;
  Viewer3D.playerModel = playerModel;
  Viewer3D.boxModel = boxModel;
  window.Viewer3D = Viewer3D;
})();
