// Field is laid out in percent of a 1000 x 1300 design; the page and the exported image share these numbers.
const W = 1000, H = 1300;
const LOS = 47; // line of scrimmage, % from top

// side: D = defense, O = offense, S = special teams
const SLOTS = [
  { id: 'FS',  label: 'FS',  side: 'D', x: 36, y: 11 },
  { id: 'SS',  label: 'SS',  side: 'D', x: 64, y: 11 },
  { id: 'CB1', label: 'CB',  side: 'D', x: 8,  y: 20 },
  { id: 'CB2', label: 'CB',  side: 'D', x: 92, y: 20 },
  { id: 'WLB', label: 'WLB', side: 'D', x: 28, y: 28.5 },
  { id: 'MLB', label: 'MLB', side: 'D', x: 50, y: 27 },
  { id: 'SLB', label: 'SLB', side: 'D', x: 72, y: 28.5 },
  { id: 'DE1', label: 'DE',  side: 'D', x: 20, y: 39 },
  { id: 'DT1', label: 'DT',  side: 'D', x: 40, y: 39 },
  { id: 'DT2', label: 'DT',  side: 'D', x: 60, y: 39 },
  { id: 'DE2', label: 'DE',  side: 'D', x: 80, y: 39 },

  { id: 'WR1', label: 'WR',  side: 'O', x: 7,  y: 55 },
  { id: 'WR2', label: 'WR',  side: 'O', x: 18, y: 61 },
  { id: 'LT',  label: 'LT',  side: 'O', x: 30, y: 55 },
  { id: 'LG',  label: 'LG',  side: 'O', x: 40, y: 55 },
  { id: 'C',   label: 'C',   side: 'O', x: 50, y: 55 },
  { id: 'RG',  label: 'RG',  side: 'O', x: 60, y: 55 },
  { id: 'RT',  label: 'RT',  side: 'O', x: 70, y: 55 },
  { id: 'TE',  label: 'TE',  side: 'O', x: 81, y: 57 },
  { id: 'WR3', label: 'WR',  side: 'O', x: 93, y: 55 },
  { id: 'QB',  label: 'QB',  side: 'O', x: 50, y: 67.5 },
  { id: 'RB',  label: 'RB',  side: 'O', x: 50, y: 79 },

  { id: 'K',   label: 'K',   side: 'S', x: 36, y: 92.5 },
  { id: 'P',   label: 'P',   side: 'S', x: 64, y: 92.5 },
];
const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));
const SIDE_COLOR = { D: '#d64545', O: '#3b74d6', S: '#c99a12' };

const sprite = n => `sprites/${n}.png`;
const dexNo = n => '#' + String(n).padStart(3, '0');

// ---------- state ----------
let lineup = { title: '', slots: {} }; // slots: slotId -> dex number
let selected = null;                    // { from: 'list', mon } or { from: 'slot', slot }

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function persist() { store.set('pf.current', lineup); }

function slotOf(mon) {
  return Object.keys(lineup.slots).find(k => lineup.slots[k] === mon);
}

// Each Pokémon plays one position: putting it somewhere moves it from wherever it was.
function place(mon, slotId) {
  const prev = slotOf(mon);
  if (prev) delete lineup.slots[prev];
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
  renderSlots();
  renderUsed();
}

// ---------- field background (shared by page and export) ----------
function drawFieldBg(ctx) {
  const u = W / 100, v = H / 100;
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i % 2 ? '#2f8a3e' : '#349645';
    ctx.fillRect(0, i * 5 * v, W, 5 * v + 1);
  }
  // defense band and special-teams end zone
  ctx.fillStyle = 'rgba(160, 30, 30, .55)';
  ctx.fillRect(0, 0, W, 4.5 * v);
  ctx.fillStyle = 'rgba(120, 90, 0, .45)';
  ctx.fillRect(0, 86 * v, W, 14 * v);

  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 3;
  for (let y = 10; y <= 80; y += 10) {
    if (y === LOS + 3) continue;
    ctx.beginPath(); ctx.moveTo(0, y * v); ctx.lineTo(W, y * v); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, 86 * v); ctx.lineTo(W, 86 * v); ctx.stroke();
  // hash marks
  ctx.lineWidth = 2;
  for (let y = 6; y < 86; y += 2) {
    for (const x of [34, 66]) {
      ctx.beginPath(); ctx.moveTo((x - .8) * u, y * v); ctx.lineTo((x + .8) * u, y * v); ctx.stroke();
    }
  }
  // line of scrimmage
  ctx.strokeStyle = '#ffd84a';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, LOS * v); ctx.lineTo(W, LOS * v); ctx.stroke();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('DEFENSE', W / 2, 2.4 * v);
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText('SPECIAL TEAMS', W / 2, 87.9 * v);
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('▲ DEFENSE', W / 2, (LOS - 1.6) * v);
  ctx.fillText('▼ OFFENSE', W / 2, (LOS + 1.6) * v);
}

// ---------- rendering ----------
function renderList() {
  const list = $('list');
  list.innerHTML = '';
  POKEMON.forEach((name, i) => {
    const mon = i + 1;
    const li = document.createElement('li');
    li.className = 'mon';
    li.draggable = true;
    li.dataset.mon = mon;
    li.dataset.search = (name + ' ' + mon + ' ' + dexNo(mon)).toLowerCase();
    li.innerHTML = `<img src="${sprite(mon)}" alt="" loading="lazy"><span class="num">${dexNo(mon)}</span><span>${name}</span>`;
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

function buildField() {
  const field = $('field');
  const bg = document.createElement('canvas');
  bg.className = 'bg';
  bg.width = W; bg.height = H;
  drawFieldBg(bg.getContext('2d'));
  field.appendChild(bg);

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
  for (const el of document.querySelectorAll('.slot')) {
    const id = el.dataset.slot;
    const mon = lineup.slots[id];
    const disc = el.querySelector('.disc');
    const old = disc.querySelector('img');
    if (old) old.remove();
    el.classList.toggle('filled', !!mon);
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

function fitText(ctx, text, maxW, size, weight) {
  let s = size;
  do { ctx.font = `${weight} ${s}px system-ui, sans-serif`; } while (ctx.measureText(text).width > maxW && --s > 8);
}

async function renderImage() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H + HEADER;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#14181f';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffcb05';
  fitText(ctx, lineup.title || 'PokéFootball', W - 60, 48, 800);
  ctx.fillText(lineup.title || 'PokéFootball', W / 2, HEADER / 2);

  ctx.save();
  ctx.translate(0, HEADER);
  drawFieldBg(ctx);

  const imgs = {};
  await Promise.all(Object.values(lineup.slots).map(async m => { imgs[m] = await loadImg(sprite(m)); }));

  const u = W / 100;
  for (const s of SLOTS) {
    const mon = lineup.slots[s.id];
    const cx = s.x * u, cy = s.y * H / 100;
    const top = cy - 11.7 * u / 2;

    // position badge
    ctx.font = `700 ${1.5 * u}px system-ui, sans-serif`;
    const bw = ctx.measureText(s.label).width + 1.4 * u, bh = 2.4 * u;
    ctx.fillStyle = SIDE_COLOR[s.side];
    roundRect(ctx, cx - bw / 2, top, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(s.label, cx, top + bh / 2 + 1);

    // disc
    const r = 3.75 * u, dcy = top + bh + r;
    ctx.beginPath();
    ctx.arc(cx, dcy, r - 1.25, 0, Math.PI * 2);
    ctx.fillStyle = mon ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.setLineDash(mon ? [] : [6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (mon) {
      const sz = 10 * u;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(imgs[mon], cx - sz / 2, dcy - sz / 2, sz, sz);
      const name = POKEMON[mon - 1];
      fitText(ctx, name, 11 * u, 1.25 * u, 700);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.lineJoin = 'round';
      const ny = dcy + r + 0.9 * u;
      ctx.strokeText(name, cx, ny);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, cx, ny);
    }
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
  lineup = { title: l.title || '', slots: {} };
  for (const [k, v] of Object.entries(l.slots || {})) {
    if (SLOT_BY_ID[k] && v >= 1 && v <= 151) lineup.slots[k] = +v;
  }
  $('title').value = lineup.title;
  setSelected(null);
  persist();
}

function encodeShare() {
  const s = Object.entries(lineup.slots).map(([k, v]) => `${k}.${v}`).join('-');
  return `#t=${encodeURIComponent(lineup.title)}&s=${s}`;
}

function decodeShare(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('s')) return null;
  const slots = {};
  for (const pair of p.get('s').split('-')) {
    const [k, v] = pair.split('.');
    if (k) slots[k] = +v;
  }
  return { title: p.get('t') || '', slots };
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

  $('search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase().replace(/^#0*/, '');
    for (const li of $('list').children) li.hidden = !!q && !li.dataset.search.includes(q);
  });

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
    setLineup({ title: lineup.title, slots: {} });
  });

  $('shareBtn').addEventListener('click', async () => {
    const url = location.href.split('#')[0] + encodeShare();
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { prompt('Copy this link:', url); }
  });

  $('downloadBtn').addEventListener('click', downloadImage);
  $('copyBtn').addEventListener('click', copyImage);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSelected(null); });
}

// ---------- boot ----------
renderList();
buildField();
wireRosterDrop();
wireControls();
refreshLoadList();
setLineup(decodeShare(location.hash) || store.get('pf.current', { title: '', slots: {} }));
