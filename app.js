// Field is laid out in percent of a 1000 x 900 design; the page and the exported image share these numbers.
const W = 1000, H = 900;
const LOS = 46.5; // line of scrimmage, % from top

// side: D = defense, O = offense, S = special teams
const SLOTS = [
  { id: 'CB1', label: 'CB',  side: 'D', x: 7,  y: 9 },
  { id: 'FS',  label: 'FS',  side: 'D', x: 36, y: 9 },
  { id: 'SS',  label: 'SS',  side: 'D', x: 64, y: 9 },
  { id: 'CB2', label: 'CB',  side: 'D', x: 93, y: 9 },
  { id: 'WLB', label: 'WLB', side: 'D', x: 28, y: 23.5 },
  { id: 'MLB', label: 'MLB', side: 'D', x: 50, y: 23.5 },
  { id: 'SLB', label: 'SLB', side: 'D', x: 72, y: 23.5 },
  { id: 'DE1', label: 'DE',  side: 'D', x: 20, y: 38 },
  { id: 'DT1', label: 'DT',  side: 'D', x: 40, y: 38 },
  { id: 'DT2', label: 'DT',  side: 'D', x: 60, y: 38 },
  { id: 'DE2', label: 'DE',  side: 'D', x: 80, y: 38 },

  { id: 'WR1', label: 'WR',  side: 'O', x: 7,  y: 55 },
  { id: 'LT',  label: 'LT',  side: 'O', x: 30, y: 55 },
  { id: 'LG',  label: 'LG',  side: 'O', x: 40, y: 55 },
  { id: 'C',   label: 'C',   side: 'O', x: 50, y: 55 },
  { id: 'RG',  label: 'RG',  side: 'O', x: 60, y: 55 },
  { id: 'RT',  label: 'RT',  side: 'O', x: 70, y: 55 },
  { id: 'TE',  label: 'TE',  side: 'O', x: 81, y: 57 },
  { id: 'WR3', label: 'WR',  side: 'O', x: 93, y: 55 },
  { id: 'WR2', label: 'WR',  side: 'O', x: 18, y: 70.5 },
  { id: 'QB',  label: 'QB',  side: 'O', x: 50, y: 70.5 },
  { id: 'RB',  label: 'RB',  side: 'O', x: 50, y: 85.5 },

  { id: 'K',   label: 'K',   side: 'S', x: 80, y: 85 },
  { id: 'P',   label: 'P',   side: 'S', x: 92, y: 85 },
];
const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));
const SIDE_COLOR = { D: '#d64545', O: '#3b74d6', S: '#c99a12' };

// HD = official artwork (256px WebP), classic = pixel sprites (96px, lots of padding)
let hd = false;
const sprite = n => hd ? `sprites-hd/${n}.webp` : `sprites/${n}.png`;
const spriteScale = () => hd ? 9 : 14; // drawn size on the field, % of field width
const dexNo = n => '#' + String(n).padStart(3, '0');

// PokeAPI stores height in decimeters and weight in hectograms
function heightText(dm) {
  const inches = Math.round(dm * 3.937);
  return `${Math.floor(inches / 12)}'${String(inches % 12).padStart(2, '0')}"`;
}
const weightText = hg => `${(hg * 0.220462).toFixed(1)} lb`;

// ---------- state ----------
const NO_RULES = { allGens: false, firstEvo: false, noLegends: false, noPseudo: false, popWarner: false, types: [] };
const FLAG_RULES = ['allGens', 'firstEvo', 'noLegends', 'noPseudo', 'popWarner'];

// Final forms of the 600-stat three-stage lines (Dragonite, Tyranitar, Salamence, Metagross, Garchomp,
// Hydreigon, Goodra, Kommo-o, Dragapult, Baxcalibur); their pre-evolutions stay allowed.
const PSEUDO = new Set([149, 248, 373, 376, 445, 635, 706, 784, 887, 998]);
// Pop Warner: small Pokémon only, at most 1.0 m (3'03") and 45 kg (99 lb)
const POP_WARNER = { dm: 10, hg: 450 };
let lineup = { title: '', signer: '', rules: { ...NO_RULES }, slots: {} }; // slots: slotId -> dex number
let selected = null;                    // { from: 'list', mon } or { from: 'slot', slot }

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function persist() { store.set('pf.current', lineup); }

function duplicates() {
  const count = {};
  for (const m of Object.values(lineup.slots)) count[m] = (count[m] || 0) + 1;
  return new Set(Object.keys(count).filter(m => count[m] > 1).map(Number));
}

// All gens on, or any Pokémon from outside Gen 1 placed, gives the field a blue border.
const mixedGens = () => lineup.rules.allGens || Object.values(lineup.slots).some(m => m > 151);

const TYPE_COLOR = {
  Normal: '#9a9a6c', Fighting: '#b8302a', Flying: '#8f7ad8', Poison: '#93409a', Ground: '#cfae5a', Rock: '#a8922e',
  Bug: '#8f9e1c', Ghost: '#6a5490', Steel: '#9a9ab8', Fire: '#e8742a', Water: '#5a84e0', Grass: '#5fae3e',
  Electric: '#e0b81c', Psychic: '#e8487a', Ice: '#78c8c8', Dragon: '#6a3ae8', Dark: '#6a5446', Fairy: '#d685ad',
};

function allowed(mon) {
  const r = lineup.rules, i = mon - 1;
  return (r.allGens || mon <= 151) &&
    (!r.firstEvo || FIRST_EVO[i] === '1') &&
    (!r.noLegends || LEGENDARY[i] === '0') &&
    (!r.noPseudo || !PSEUDO.has(mon)) &&
    (!r.popWarner || (SIZES[i][0] <= POP_WARNER.dm && SIZES[i][1] <= POP_WARNER.hg)) &&
    (!r.types.length || MON_TYPES[i].some(t => r.types.includes(t)));
}

// Labels for the toggles that are on, shown on the exported image
function ruleLabels() {
  const r = lineup.rules, out = [];
  if (r.allGens) out.push('All gens');
  if (r.firstEvo) out.push('1st evolution only');
  if (r.noLegends) out.push('No legendaries');
  if (r.noPseudo) out.push('No pseudo-legendaries');
  if (r.popWarner) out.push('Pop Warner');
  if (r.types.length) out.push('Types: ' + r.types.map(t => TYPES[t]).join(' / '));
  return out;
}

// The same Pokémon can play more than one position; duplicates get a red circle.
function place(mon, slotId) {
  lineup.slots[slotId] = mon;
  changed();
}

function moveSlot(fromId, toId) {
  if (fromId === toId) return;
  const a = lineup.slots[fromId], b = lineup.slots[toId];
  if (b) lineup.slots[fromId] = b; else delete lineup.slots[fromId];
  if (a) lineup.slots[toId] = a; else delete lineup.slots[toId];
  changed();
}

function clearSlot(slotId) {
  delete lineup.slots[slotId];
  changed();
}

function changed() {
  persist();
  drawPageField();
  renderGenBadges();
  renderSlots();
  renderUsed();
}

// ---------- field background (shared by page and export) ----------
const TURF = ['#349645', '#2f8a3e'];

function drawFieldBg(ctx, mixed) {
  const u = W / 100, v = H / 100;
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = TURF[i % 2];
    ctx.fillRect(0, i * 5 * v, W, 5 * v + 1);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 3;
  for (const y of [16, 31, 62, 77]) {
    ctx.beginPath(); ctx.moveTo(0, y * v); ctx.lineTo(W, y * v); ctx.stroke();
  }
  // hash marks
  ctx.lineWidth = 2;
  for (let y = 3; y < 98; y += 2.5) {
    for (const x of [34, 66]) {
      ctx.beginPath(); ctx.moveTo((x - .8) * u, y * v); ctx.lineTo((x + .8) * u, y * v); ctx.stroke();
    }
  }
  // special teams box, bottom right around K and P
  const bx = 72 * u, by = 75 * v;
  ctx.fillStyle = 'rgba(120, 90, 0, .55)';
  ctx.fillRect(bx, by, W - bx, H - by);
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, W - bx, H - by);

  // line of scrimmage
  ctx.strokeStyle = '#ffd84a';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, LOS * v); ctx.lineTo(W, LOS * v); ctx.stroke();

  if (mixed) {
    ctx.strokeStyle = '#2f7fff';
    ctx.lineWidth = 24;
    ctx.strokeRect(12, 12, W - 24, H - 24);
  } else {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W - 8, H - 8);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('SPECIAL TEAMS', (bx + W) / 2, 96.5 * v);
}

// ---------- rendering ----------
function renderList() {
  const list = $('list');
  list.innerHTML = '';
  POKEMON.forEach((name, i) => {
    const mon = i + 1;
    const [ht, wt] = SIZES[i];
    const li = document.createElement('li');
    li.className = 'mon';
    li.draggable = true;
    li.dataset.mon = mon;
    li.dataset.gen = genOf(mon);
    li.dataset.search = (name + ' ' + mon + ' ' + dexNo(mon)).toLowerCase();
    li.innerHTML = `<img src="${sprite(mon)}" alt="" loading="lazy"><span class="num">${dexNo(mon)}</span>` +
      `<span class="info"><span>${name}</span><span class="hw">${heightText(ht)} · ${weightText(wt)}</span>` +
      `<span class="types">${MON_TYPES[i].map(t => `<span class="type" style="--type:${TYPE_COLOR[TYPES[t]]}">${TYPES[t]}</span>`).join('')}</span></span>`;
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'list', mon }));
      e.dataTransfer.effectAllowed = 'move';
      setSelected(null);
    });
    li.addEventListener('click', () => {
      setSelected(selected && selected.from === 'list' && selected.mon === mon ? null : { from: 'list', mon });
    });
    list.appendChild(li);
  });
}

function renderUsed() {
  const used = new Set(Object.values(lineup.slots));
  for (const li of $('list').children) {
    const mon = +li.dataset.mon;
    li.classList.toggle('used', used.has(mon));
    li.classList.toggle('selected', !!selected && selected.from === 'list' && selected.mon === mon);
  }
}

function drawPageField() {
  const bg = $('fieldBg');
  const mixed = mixedGens();
  if (bg.dataset.mixed === String(mixed)) return;
  bg.dataset.mixed = mixed;
  const bctx = bg.getContext('2d');
  bctx.setTransform(2, 0, 0, 2, 0, 0); // 2x so lines stay sharp at large sizes
  drawFieldBg(bctx, mixed);
}

function buildField() {
  const field = $('field');
  const bg = document.createElement('canvas');
  bg.className = 'bg';
  bg.id = 'fieldBg';
  bg.width = W * 2; bg.height = H * 2;
  field.appendChild(bg);
  // bottom-left corner: signature, toggle badges, gen badges
  const corner = document.createElement('div');
  corner.className = 'corner';
  corner.innerHTML = '<div class="signature" id="signature"></div><div class="badges" id="ruleBadges"></div><div class="badges" id="genBadges"></div>';
  field.appendChild(corner);

  for (const s of SLOTS) {
    const el = document.createElement('div');
    el.className = 'slot ' + s.side;
    el.dataset.slot = s.id;
    el.style.left = s.x + '%';
    el.style.top = s.y + '%';
    el.innerHTML = `<span class="pos">${s.label}</span><div class="disc"><button class="x" title="Remove">×</button></div><span class="name"></span>`;

    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'slot', slot: s.id }));
      e.dataTransfer.effectAllowed = 'move';
      setSelected(null);
    });
    // A placed Pokémon dropped somewhere that isn't a position or the roster is removed.
    el.addEventListener('dragend', e => {
      if (e.dataTransfer.dropEffect === 'none' && lineup.slots[s.id]) clearSlot(s.id);
    });
    el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('over');
      const d = readDrag(e);
      if (!d) return;
      if (d.from === 'list') place(d.mon, s.id);
      else moveSlot(d.slot, s.id);
    });
    el.addEventListener('click', e => {
      if (e.target.classList.contains('x')) { clearSlot(s.id); setSelected(null); return; }
      if (selected && selected.from === 'list') { place(selected.mon, s.id); setSelected(null); }
      else if (selected && selected.from === 'slot') { moveSlot(selected.slot, s.id); setSelected(null); }
      else if (lineup.slots[s.id]) setSelected({ from: 'slot', slot: s.id });
    });
    field.appendChild(el);
  }
}

function renderSlots() {
  const dupes = duplicates();
  for (const el of document.querySelectorAll('.slot')) {
    const id = el.dataset.slot;
    const mon = lineup.slots[id];
    const disc = el.querySelector('.disc');
    const old = disc.querySelector('img');
    if (old) old.remove();
    el.classList.toggle('filled', !!mon);
    el.classList.toggle('dupe', dupes.has(mon));
    el.classList.toggle('selected', !!selected && selected.from === 'slot' && selected.slot === id);
    el.draggable = !!mon;
    el.querySelector('.name').textContent = mon ? POKEMON[mon - 1] : '';
    if (mon) {
      const img = document.createElement('img');
      img.src = sprite(mon);
      img.alt = POKEMON[mon - 1];
      disc.prepend(img);
    }
  }
}

const GEN_COLOR = ['#e3350d', '#c9a227', '#3d7dca', '#8a6bbe', '#4a4a4a', '#2b8fd6', '#e8822a', '#a8327e', '#7b2fbe'];
const gensUsed = () => [...new Set(Object.values(lineup.slots).map(genOf))].sort((x, y) => x - y);

function renderGenBadges() {
  $('genBadges').innerHTML = gensUsed()
    .map(g => `<span class="badge" style="background:${GEN_COLOR[g - 1]}">GEN ${g}</span>`).join('');
}

function renderRuleBadges() {
  $('ruleBadges').innerHTML = ruleLabels().map(r => `<span class="badge rule-badge">${escapeHtml(r)}</span>`).join('');
}

function renderSignature() {
  $('signature').textContent = lineup.signer ? '– ' + lineup.signer : '';
}

function setSelected(sel) {
  selected = sel;
  $('field').classList.toggle('placing', !!sel);
  renderSlots();
  renderUsed();
}

function readDrag(e) {
  try { return JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return null; }
}

// ---------- roster as a drop zone (drag a placed Pokémon back to remove it) ----------
function wireRosterDrop() {
  const roster = $('roster');
  roster.addEventListener('dragover', e => { e.preventDefault(); roster.classList.add('drop-target'); });
  roster.addEventListener('dragleave', e => { if (!roster.contains(e.relatedTarget)) roster.classList.remove('drop-target'); });
  roster.addEventListener('drop', e => {
    e.preventDefault();
    roster.classList.remove('drop-target');
    const d = readDrag(e);
    if (d && d.from === 'slot') clearSlot(d.slot);
  });
}

// ---------- image export ----------
const HEADER = 90;

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

function fitText(ctx, text, maxW, size, weight, family = 'system-ui, sans-serif') {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; } while (ctx.measureText(text).width > maxW && --s > 8);
}

// A left-aligned row of rounded badges; shrinks the text to fit maxW. Returns nothing.
function drawBadgeRow(ctx, items, x, y, h, maxW) {
  const u = W / 100, gap = .8 * u, pad = 1 * u;
  let size = 1.8 * u, widths;
  do {
    size -= .5;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    widths = items.map(it => ctx.measureText(it.label).width + pad * 2);
  } while (widths.reduce((s, w) => s + w, 0) + gap * (items.length - 1) > maxW && size > 9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  items.forEach((it, i) => {
    ctx.fillStyle = it.bg;
    roundRect(ctx, x, y, widths[i], h, h / 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = it.fg;
    ctx.fillText(it.label, x + widths[i] / 2, y + h / 2 + 1);
    x += widths[i] + gap;
  });
}

async function renderImage() {
  const header = HEADER;
  const c = document.createElement('canvas');
  c.width = W; c.height = H + header;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#14181f';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffcb05';
  fitText(ctx, lineup.title || 'PokéFootball', W - 60, 48, 800);
  ctx.fillText(lineup.title || 'PokéFootball', W / 2, HEADER / 2);

  ctx.save();
  ctx.translate(0, header);
  drawFieldBg(ctx, mixedGens());

  const dupes = duplicates();
  const imgs = {};
  await Promise.all(Object.values(lineup.slots).map(async m => { imgs[m] = await loadImg(sprite(m)); }));

  const u = W / 100;
  for (const s of SLOTS) {
    const mon = lineup.slots[s.id];
    const cx = s.x * u, cy = s.y * H / 100;
    const top = cy - 12.6 * u / 2;

    // position badge
    ctx.font = `700 ${2.1 * u}px system-ui, sans-serif`;
    const bw = ctx.measureText(s.label).width + 1.8 * u, bh = 3.2 * u;
    ctx.fillStyle = SIDE_COLOR[s.side];
    roundRect(ctx, cx - bw / 2, top, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(s.label, cx, top + bh / 2 + 1);

    // disc
    const r = 3.5 * u, dcy = top + bh + r;
    ctx.beginPath();
    ctx.arc(cx, dcy, r - 1.25, 0, Math.PI * 2);
    const dupe = dupes.has(mon);
    ctx.fillStyle = dupe ? 'rgba(230,40,40,.55)' : mon ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)';
    ctx.fill();
    ctx.lineWidth = dupe ? 4 : 2.5;
    ctx.strokeStyle = dupe ? '#ff3b3b' : 'rgba(255,255,255,.7)';
    ctx.setLineDash(mon ? [] : [6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (mon) {
      const sz = spriteScale() * u;
      ctx.imageSmoothingEnabled = hd;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgs[mon], cx - sz / 2, dcy - sz / 2, sz, sz);
      const name = POKEMON[mon - 1];
      fitText(ctx, name, 12 * u, 1.8 * u, 700);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.lineJoin = 'round';
      const ny = dcy + r + 1.2 * u;
      ctx.strokeText(name, cx, ny);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, cx, ny);

      const [ht, wt] = SIZES[mon - 1];
      const hw = `${heightText(ht)} · ${weightText(wt)}`;
      const hy = ny + 1.6 * u;
      fitText(ctx, hw, 9.6 * u, 1.45 * u, 600);
      ctx.lineWidth = 4;
      ctx.strokeText(hw, cx, hy);
      ctx.fillStyle = '#e8f0ff';
      ctx.fillText(hw, cx, hy);
    }
  }
  // bottom-left corner, bottom up: gens used, then toggles that are on, then the signature
  const bh = 3 * u, bgap = .8 * u, maxW = 44 * u;
  let by = H * .97;
  const gens = gensUsed();
  if (gens.length) {
    by -= bh;
    drawBadgeRow(ctx, gens.map(g => ({ label: `GEN ${g}`, bg: GEN_COLOR[g - 1], fg: '#fff' })), 4 * u, by, bh, maxW);
    by -= bgap;
  }
  const rules = ruleLabels();
  if (rules.length) {
    by -= bh;
    drawBadgeRow(ctx, rules.map(r => ({ label: r.toUpperCase(), bg: '#ffcb05', fg: '#1b1b1b' })), 4 * u, by, bh, maxW);
    by -= bgap;
  }

  if (lineup.signer) {
    const text = '– ' + lineup.signer;
    await document.fonts.load('700 46px Caveat').catch(() => {});
    ctx.save();
    ctx.translate(4 * u, by);
    ctx.rotate(-4 * Math.PI / 180);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    fitText(ctx, text, 42 * u, 46, '700', 'Caveat, cursive');
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const toBlob = c => new Promise(res => c.toBlob(res, 'image/png'));

async function downloadImage() {
  const blob = await toBlob(await renderImage());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (lineup.title || 'pokefootball').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyImage() {
  try {
    // Passing a promise keeps Safari's user-gesture requirement happy.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderImage().then(toBlob) })]);
    toast('Image copied to clipboard');
  } catch (err) {
    console.error(err);
    toast('Copy not supported here — use Download instead');
  }
}

// ---------- saving / loading / sharing ----------
function savedLineups() { return store.get('pf.saves', {}); }

function refreshLoadList(selectName) {
  const sel = $('loadSel');
  const saves = savedLineups();
  sel.innerHTML = '<option value="">Load…</option>' +
    Object.keys(saves).sort().map(n => `<option>${escapeHtml(n)}</option>`).join('');
  if (selectName) sel.value = selectName;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function setLineup(l) {
  const r = l.rules || {};
  lineup = {
    title: l.title || '', signer: l.signer || '',
    rules: {
      ...Object.fromEntries(FLAG_RULES.map(k => [k, !!r[k]])),
      types: (r.types || []).filter(t => TYPES[t]).map(Number),
    },
    slots: {},
  };
  for (const [k, v] of Object.entries(l.slots || {})) {
    if (SLOT_BY_ID[k] && v >= 1 && v <= POKEMON.length) lineup.slots[k] = +v;
  }
  $('title').value = lineup.title;
  $('signer').value = lineup.signer;
  renderSignature();
  renderGenBadges();
  renderRules();
  setSelected(null);
  persist();
}

function encodeShare() {
  const s = Object.entries(lineup.slots).map(([k, v]) => `${k}.${v}`).join('-');
  const r = lineup.rules;
  const flags = FLAG_RULES.filter(k => r[k]).join('.');
  return `#t=${encodeURIComponent(lineup.title)}&by=${encodeURIComponent(lineup.signer)}` +
    `&r=${flags}&ty=${r.types.join('.')}&s=${s}`;
}

function decodeShare(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('s')) return null;
  const slots = {};
  for (const pair of p.get('s').split('-')) {
    const [k, v] = pair.split('.');
    if (k) slots[k] = +v;
  }
  const flags = (p.get('r') || '').split('.');
  const rules = { ...Object.fromEntries(FLAG_RULES.map(k => [k, flags.includes(k)])),
                  types: (p.get('ty') || '').split('.').filter(Boolean).map(Number) };
  return { title: p.get('t') || '', signer: p.get('by') || '', rules, slots };
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function wireControls() {
  $('title').addEventListener('input', e => { lineup.title = e.target.value; persist(); });
  $('signer').addEventListener('input', e => { lineup.signer = e.target.value; persist(); renderSignature(); });

  $('search').addEventListener('input', filterList);
  $('genSel').value = store.get('pf.gen', 'all');
  $('genSel').addEventListener('change', e => { store.set('pf.gen', e.target.value); filterList(); });
  filterList();

  $('saveBtn').addEventListener('click', () => {
    const name = prompt('Save lineup as:', lineup.title || $('loadSel').value || 'My lineup');
    if (!name) return;
    const saves = savedLineups();
    saves[name] = JSON.parse(JSON.stringify(lineup));
    store.set('pf.saves', saves);
    refreshLoadList(name);
    toast(`Saved “${name}”`);
  });

  $('loadSel').addEventListener('change', e => {
    const l = savedLineups()[e.target.value];
    if (l) { setLineup(l); toast(`Loaded “${e.target.value}”`); }
  });

  $('deleteBtn').addEventListener('click', () => {
    const name = $('loadSel').value;
    if (!name) { toast('Pick a saved lineup in Load… first'); return; }
    if (!confirm(`Delete saved lineup “${name}”?`)) return;
    const saves = savedLineups();
    delete saves[name];
    store.set('pf.saves', saves);
    refreshLoadList();
    toast(`Deleted “${name}”`);
  });

  $('clearBtn').addEventListener('click', () => {
    if (Object.keys(lineup.slots).length && !confirm('Empty every position?')) return;
    setLineup({ ...lineup, slots: {} });
  });

  $('shareBtn').addEventListener('click', async () => {
    const url = location.href.split('#')[0] + encodeShare();
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { prompt('Copy this link:', url); }
  });

  $('hdBtn').addEventListener('click', () => setHd(!hd));

  $('downloadBtn').addEventListener('click', downloadImage);
  $('copyBtn').addEventListener('click', copyImage);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSelected(null); });
}

// Typing a search looks through every generation; otherwise the list shows the chosen one.
function filterList() {
  const q = $('search').value.trim().toLowerCase().replace(/^#0*/, '');
  const gen = lineup.rules.allGens ? $('genSel').value : 'all';
  for (const li of $('list').children) {
    li.hidden = !allowed(+li.dataset.mon) ||
      (q ? !li.dataset.search.includes(q) : gen !== 'all' && li.dataset.gen !== gen);
  }
}

function renderRules() {
  const r = lineup.rules;
  for (const b of document.querySelectorAll('.tog')) b.setAttribute('aria-pressed', !!r[b.dataset.rule]);
  for (const b of document.querySelectorAll('.type-chip')) b.setAttribute('aria-pressed', r.types.includes(+b.dataset.type));
  $('typeSummary').textContent = r.types.length ? r.types.map(t => TYPES[t]).join(', ') : 'any';
  $('genSel').hidden = !r.allGens;
  renderRuleBadges();
  filterList();
  drawPageField();
}

function wireRules() {
  const chips = $('typeChips');
  TYPES.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'type-chip';
    b.dataset.type = i;
    b.style.setProperty('--type', TYPE_COLOR[t]);
    b.textContent = t;
    chips.appendChild(b);
  });
  chips.addEventListener('click', e => {
    const t = e.target.dataset.type;
    if (t === undefined) return;
    const types = lineup.rules.types;
    const at = types.indexOf(+t);
    if (at >= 0) types.splice(at, 1); else types.push(+t);
    persist();
    renderRules();
  });
  $('toggles').addEventListener('click', e => {
    const rule = e.target.dataset.rule;
    if (!rule) return;
    lineup.rules[rule] = !lineup.rules[rule];
    persist();
    renderRules();
  });
}

function setHd(on) {
  hd = on;
  store.set('pf.hd', on);
  document.body.classList.toggle('hd', on);
  $('hdBtn').textContent = on ? 'HD: on' : 'HD: off';
  $('hdBtn').setAttribute('aria-pressed', on);
  for (const img of document.querySelectorAll('.mon img')) img.src = sprite(+img.closest('.mon').dataset.mon);
  renderSlots();
}

// ---------- boot ----------
renderList();
buildField();
wireRosterDrop();
wireRules();
wireControls();
refreshLoadList();
setHd(store.get('pf.hd', false));
setLineup(decodeShare(location.hash) || store.get('pf.current', { title: '', slots: {} }));
