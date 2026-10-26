/* ============================================================
   THE CRIMSON MASQUERADE - app logic
   ============================================================ */
(function () {
'use strict';

const CFG = window.MASQUERADE_CONFIG || {};
const FBCFG = CFG.FIREBASE || {};
const SPIN_MS = 7000;
const TURN_PICK_MS = 2400;

/* ---------------- DATA ---------------- */
const BL_KEYS = ['eclipsara', 'onychinus', 'vesperyn', 'rosethorn'];
const BLOODLINES = {
  eclipsara: { name: 'Eclipsara', title: 'The Moonbound', quote: 'What the moon chooses, the night protects.',
    traits: ['Patience', 'Perception', 'Devotion', 'Loyalty', 'Family'], color: '#4f86ff', icon: '🌙', img: 'images/eclipsara.webp' },
  onychinus: { name: 'Onychinus', title: 'The Crimson Sovereigns', quote: 'Mine. Always.',
    traits: ['Power', 'Control', 'Devotion', 'Freedom', 'Dominance'], color: '#d3122c', icon: '🐉', img: 'images/onychinus.webp' },
  vesperyn: { name: 'Vesperyn', title: 'The Velvet Fang', quote: 'Come closer. We don’t chase.',
    traits: ['Elegance', 'Allure', 'Mystery', 'Confidence', 'Intrigue'], color: '#9b3dff', icon: '💜', img: 'images/vesperyn.webp' },
  rosethorn: { name: 'Rosethorn', title: 'The Beguiling Blood', quote: 'Every thorn desires a drop.',
    traits: ['Charm', 'Creativity', 'Mischief', 'Temptation', 'Expression'], color: '#e8325f', icon: '🥀', img: 'images/rosethorn.webp' }
};

// Starter challenges: the host can edit all of these in the Host Panel.
const DEFAULT_CHALLENGES = [
  'Introduce yourself in your best dramatic vampire voice',
  'Tell a spooky story in exactly three sentences',
  'Do your best bat impression',
  'Whisper everything you say for the next 2 minutes',
  'Compliment every mortal in the voice channel',
  'Change your Discord nickname to something vampiric for 10 minutes',
  'Sing a few seconds of any song you choose',
  'Say a tongue twister three times, fast',
  'Describe your masquerade costume in 30 seconds',
  'Share an unpopular opinion and defend it',
  'Act out a dramatic vampire death scene',
  'Make the vampire laugh',
  'Answer three rapid-fire questions from the vampire',
  'Show something red to the camera or chat',
  'Invent a vampire pickup line',
  'Let the vampire pick your next Discord status for 10 minutes'
];

/* ---------------- HELPERS ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = (n, l = 3) => String(n).padStart(l, '0');

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------------- STORE (Firebase, or local demo mode) ---------------- */
const Store = (function () {
  let state = {};
  const listeners = [];
  let offset = 0;
  const emit = () => listeners.forEach((f) => f());

  function setAt(obj, path, val) {
    const parts = path.split('/').filter(Boolean);
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete o[last]; else o[last] = val;
  }

  const live = !!(FBCFG.apiKey && FBCFG.databaseURL && window.firebase);

  if (live) {
    firebase.initializeApp(FBCFG);
    const db = firebase.database();
    const auth = firebase.auth();
    const root = db.ref('masquerade');
    db.ref('.info/serverTimeOffset').on('value', (s) => { offset = s.val() || 0; });
    root.on('value', (s) => { state = s.val() || {}; emit(); });
    return {
      live: true,
      auth,
      get: () => state,
      now: () => Date.now() + offset,
      set: (p, v) => root.child(p).set(v === undefined ? null : v),
      update: (u) => root.update(u),
      on: (f) => listeners.push(f)
    };
  }

  // demo mode: everything lives in this browser (tabs stay in sync)
  const KEY = 'masq_state_v1';
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { try { state = JSON.parse(e.newValue || '{}') || {}; } catch (er) { state = {}; } emit(); }
  });
  return {
    live: false,
    get: () => state,
    now: () => Date.now(),
    set: (p, v) => { setAt(state, p, v); save(); emit(); },
    update: (u) => { Object.keys(u).forEach((k) => setAt(state, k, u[k])); save(); emit(); },
    on: (f) => listeners.push(f)
  };
})();

/* ---------------- STATE ACCESSORS ---------------- */
const S = () => Store.get();
const settings = () => Object.assign({ maxBlood: 3, finalCount: 4 }, S().settings || {});
function playersList() {
  return Object.entries(S().players || {}).map(([id, p]) => Object.assign({ id }, p));
}
const getPlayer = (id) => (S().players || {})[id] ? Object.assign({ id }, S().players[id]) : null;
const eligible = () => playersList().filter((p) => p.status === 'mortal' && p.blood >= 1);
function challengesList() {
  const c = S().challenges;
  if (!c) return S().chInit ? [] : DEFAULT_CHALLENGES.map((t, i) => ({ id: 'c' + pad(i), text: t }));
  return Object.entries(c).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, v]) => ({ id, text: v.text }));
}
function ensureChallenges() {
  if (S().challenges || S().chInit) return;
  const o = {};
  DEFAULT_CHALLENGES.forEach((t, i) => { o['c' + pad(i)] = { text: t }; });
  Store.update({ challenges: o, chInit: true });
}
function logLines() {
  return Object.entries(S().log || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, v]) => v);
}
function addLog(msg) {
  Store.set('log/' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), { t: Store.now(), msg });
}

/* ---------------- ACCOUNTS / ADMIN ---------------- */
let isAdmin = !Store.live, user = null;
let me = Store.live ? '' : (localStorage.getItem('masq_me') || '');
const mail = (u) => u.toLowerCase() + '@crimson-masquerade.app';
const myName = () => user ? (((S().users || {})[user.uid] || {}).username || user.email.split('@')[0]) : '';
function refreshRole() {
  if (!Store.live) return;
  me = user ? user.uid : '';
  isAdmin = !!(user && (S().admins || {})[user.uid]);
}
function authErr(e) {
  const m = { 'auth/email-already-in-use': 'That username is already taken', 'auth/invalid-credential': 'Wrong username or password',
    'auth/wrong-password': 'Wrong username or password', 'auth/user-not-found': 'Wrong username or password',
    'auth/weak-password': 'Password needs at least 6 characters', 'auth/too-many-requests': 'Too many tries, wait a moment',
    'auth/operation-not-allowed': 'Enable Email/Password in Firebase > Authentication' };
  toast(m[e.code] || e.message);
}
function readAuthForm() {
  const u = $('#authUser').value.trim(), p = $('#authPass').value;
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) { toast('Username: 3-20 letters, numbers, _ . -'); return null; }
  return { u, p };
}
async function signIn() {
  const f = readAuthForm(); if (!f) return;
  try { await Store.auth.signInWithEmailAndPassword(mail(f.u), f.p); $('#authDlg').close(); $('#authPass').value = ''; toast('Welcome back 🦇'); } catch (e) { authErr(e); }
}
async function signUp() {
  const f = readAuthForm(); if (!f) return;
  try {
    const c = await Store.auth.createUserWithEmailAndPassword(mail(f.u), f.p);
    const up = { ['users/' + c.user.uid]: { username: f.u } };
    if (!settings().regClosed) up['players/' + c.user.uid] = { name: f.u, blood: settings().maxBlood, status: 'mortal', turns: 0 };
    await Store.update(up);
    if (up['players/' + c.user.uid]) addLog('🎭 ' + f.u + ' entered the Masquerade');
    $('#authDlg').close(); $('#authPass').value = ''; toast('Account created. Welcome, ' + f.u + ' 🦇');
  } catch (e) { authErr(e); }
}
function login() {
  if (user) { if (confirm('Log out?')) Store.auth.signOut(); return; }
  $('#authDlg').showModal();
}
function applyAdminUI() {
  $$('.hostonly').forEach((el) => { el.hidden = !isAdmin; });
  $('#loginBtn').hidden = !Store.live;
  $('#loginBtn').textContent = user ? 'Log out (' + myName() + ')' : 'Sign in / Register';
  $('.me').hidden = Store.live;
  $('#claimBtn').hidden = !(Store.live && user && !S().admins);
  if (!isAdmin) {
    document.body.classList.remove('clean');
    if ($('#view-host').classList.contains('active')) showView('stage');
  }
}

/* ---------------- NAVIGATION ---------------- */
function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo({ top: 0 });
}

/* ---------------- WHEEL DRAWING ---------------- */
function drawWheel(cv, items, ang, mode) {
  const ctx = cv.getContext('2d');
  const W = cv.width, R = W / 2 - 14;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.translate(W / 2, W / 2);
  // outer ring
  ctx.beginPath(); ctx.arc(0, 0, R + 10, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, '#f2e7d5'); g.addColorStop(.5, '#8a6f5a'); g.addColorStop(1, '#e3c7a0');
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.fillStyle = '#12040a'; ctx.fill();

  const n = items.length, seg = (Math.PI * 2) / n;
  ctx.rotate(ang);
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * seg, (i + 1) * seg); ctx.closePath();
    ctx.fillStyle = items[i].color; ctx.fill();
    ctx.strokeStyle = '#e3c7a055'; ctx.lineWidth = 2; ctx.stroke();
    // label
    ctx.save();
    ctx.rotate((i + 0.5) * seg);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    const fs = mode === 'bl' ? 34 : (n > 10 ? 30 : n > 7 ? 24 : 26);
    ctx.font = '700 ' + fs + 'px Cinzel, Georgia, serif';
    ctx.fillText(items[i].label, R - 22, 0);
    ctx.restore();
  }
  // hub
  ctx.rotate(-ang);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.14, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.14);
  hg.addColorStop(0, '#d6203a'); hg.addColorStop(1, '#4a0710');
  ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = '#e3c7a0'; ctx.lineWidth = 4; ctx.stroke();
  ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0;
  ctx.fillText('🩸', 0, 3);
  ctx.restore();
}

const CH_COLORS = ['#5a0b16', '#1d060b', '#7a1022', '#2b0a12'];
function challengeItems() {
  const list = challengesList();
  const n = list.length;
  return list.map((c, i) => ({
    color: CH_COLORS[(i === n - 1 && n > 1 && i % 4 === 0) ? 2 : i % 4],
    label: n > 60 ? '' : n > 10 ? String(i + 1) : (c.text.length > 20 ? c.text.slice(0, 19) + '…' : c.text)
  }));
}
function bloodlineItems() {
  return BL_KEYS.map((k) => ({ color: BLOODLINES[k].color, label: BLOODLINES[k].name }));
}

// final resting angle so that segment `idx` (+ jitter) sits under the top pointer
function finalAngle(idx, n, jit) {
  const seg = (Math.PI * 2) / n;
  return -Math.PI / 2 - (idx + 0.5 + jit) * seg;
}
const easeOut = (p) => 1 - Math.pow(1 - p, 4);

let lastDrawKey = { c: '', b: '' };
function drawFrame() {
  const sp = S().spin;
  const now = Store.now();
  let pC = 1, pB = 1;
  if (sp && sp.at) {
    pC = clamp((now - sp.at) / SPIN_MS, 0, 1);
    pB = clamp((now - sp.at) / (SPIN_MS - 1800), 0, 1);
  }
  const itemsC = challengeItems(), itemsB = bloodlineItems();
  let angC, angB;
  if (sp && itemsC.length) {
    const nC = sp.count && sp.ci < itemsC.length ? itemsC.length : itemsC.length;
    const ci = clamp(sp.ci || 0, 0, nC - 1);
    angC = finalAngle(ci, nC, sp.jc || 0) + (1 - easeOut(pC)) * 6 * Math.PI * 2;
    angB = finalAngle(clamp(sp.bi || 0, 0, 3), 4, sp.jb || 0) + (1 - easeOut(pB)) * 5 * Math.PI * 2;
  } else { angC = -Math.PI / 2; angB = -Math.PI / 2; }

  const keyC = angC.toFixed(4) + '|' + itemsC.map((i) => i.label).join('~');
  if (keyC !== lastDrawKey.c) { lastDrawKey.c = keyC; drawWheel($('#wheelC'), itemsC, angC, 'ch'); }
  const keyB = angB.toFixed(4);
  if (keyB !== lastDrawKey.b) { lastDrawKey.b = keyB; drawWheel($('#wheelB'), itemsB, angB, 'bl'); }
  return { pC, pB, spinning: !!(sp && pC < 1) };
}

/* ---------------- SPIN ---------------- */
function spinActive() {
  const sp = S().spin;
  return !!(sp && sp.at && Store.now() - sp.at < SPIN_MS + 200);
}
function canSpin() {
  const s = S();
  if (!s.turn || !getPlayer(s.turn)) return { ok: false, why: isAdmin ? 'Pick a mortal first.' : 'Waiting for the host to choose a mortal…' };
  if (spinActive()) return { ok: false, why: 'The wheel is turning…' };
  const p = getPlayer(s.turn);
  if (isAdmin) return { ok: true, why: 'Spinning for ' + p.name };
  if (me !== s.turn) return { ok: false, why: 'It is ' + p.name + '’s turn.' };
  if (s.spin && !s.spin.resolved && s.spin.playerId === s.turn) return { ok: false, why: 'Waiting for the vampire’s judgement…' };
  return { ok: true, why: 'It is your turn, ' + p.name + '. Face the wheel!' };
}
function doSpin() {
  const c = canSpin();
  if (!c.ok) { toast(c.why); return; }
  const s = S();
  const chs = challengesList();
  if (!chs.length) { toast('Add at least one challenge first'); return; }
  const p = getPlayer(s.turn);
  const ci = Math.floor(Math.random() * chs.length);
  const bi = Math.floor(Math.random() * 4);
  const spin = {
    n: ((s.spin && s.spin.n) || 0) + 1,
    playerId: p.id, playerName: p.name,
    ci, count: chs.length, challenge: chs[ci].text,
    bl: BL_KEYS[bi], bi,
    jc: rand(-0.35, 0.35), jb: rand(-0.35, 0.35),
    at: Store.now(), resolved: ''
  };
  Store.set('spin', spin);
  addLog('🎡 ' + p.name + ' spins the Blood Wheel → ' + BLOODLINES[spin.bl].name + ': “' + spin.challenge + '”');
}

/* ---------------- HOST ACTIONS ---------------- */
function setTurn(id, how) {
  const p = getPlayer(id);
  if (!p) return;
  const up = { turn: id };
  up['players/' + id + '/turns'] = (p.turns || 0) + 1;
  if (how === 'random') up.pick = { at: Store.now(), n: uid() };
  Store.update(up);
  addLog('🎭 ' + p.name + ' is called to face the Blood Wheel');
}
function pickRandom() {
  const el = eligible();
  if (!el.length) { toast('No mortals left to pick'); return; }
  const minTurns = Math.min.apply(null, el.map((p) => p.turns || 0));
  const pool = el.filter((p) => (p.turns || 0) === minTurns && p.id !== S().turn);
  const list = pool.length ? pool : el;
  setTurn(list[Math.floor(Math.random() * list.length)].id, 'random');
}
function resolveSpin(kind) {
  const sp = S().spin;
  if (!sp) { toast('No spin to judge yet'); return; }
  if (spinActive()) { toast('Wait for the wheel to stop'); return; }
  if (sp.resolved) { toast('Already judged'); return; }
  const p = getPlayer(sp.playerId);
  const up = { 'spin/resolved': kind };
  if (kind === 'completed') {
    addLog('✔ ' + sp.playerName + ' completed the challenge and keeps their Blood');
  } else if (p && p.status === 'mortal') {
    const b = Math.max(0, (p.blood == null ? settings().maxBlood : p.blood) - 1);
    up['players/' + p.id + '/blood'] = b;
    addLog('✖ ' + sp.playerName + ' failed — ' + BLOODLINES[sp.bl].name + ' claims 1 Blood (' + b + ' left)');
    if (b === 0) {
      up['players/' + p.id + '/status'] = 'pending';
      up['players/' + p.id + '/claimedBy'] = sp.bl;
      addLog('☠️ ' + p.name + ' has lost all their Blood to ' + BLOODLINES[sp.bl].name + ' — DRINK or TURN?');
    }
  }
  Store.update(up);
}
function decide(id, kind) {
  const p = getPlayer(id);
  if (!p || p.status !== 'pending') return;
  const bl = p.claimedBy && BLOODLINES[p.claimedBy] ? p.claimedBy : null;
  if (kind === 'drink') {
    Store.update({ ['players/' + id + '/status']: 'banished' });
    addLog('🩸 ' + (bl ? BLOODLINES[bl].name : 'The vampire') + ' DRINKS ' + p.name + ' — banished from the Masquerade');
  } else {
    Store.update({ ['players/' + id + '/status']: 'turned', ['players/' + id + '/bloodline']: bl });
    addLog('🦇 ' + p.name + ' is TURNED into ' + (bl ? 'a member of ' + BLOODLINES[bl].name : 'a vampire'));
  }
}
function askBloodline() {
  const a = prompt('Which bloodline claimed it?\n1 = Eclipsara\n2 = Onychinus\n3 = Vesperyn\n4 = Rosethorn', '1');
  const n = parseInt(a, 10);
  return n >= 1 && n <= 4 ? BL_KEYS[n - 1] : null;
}
function adjustBlood(id, delta) {
  const p = getPlayer(id);
  if (!p) return;
  const max = settings().maxBlood;
  if (delta > 0) {
    const nb = Math.min(max, (p.blood || 0) + 1);
    const up = { ['players/' + id + '/blood']: nb };
    if (p.status !== 'mortal') up['players/' + id + '/status'] = 'mortal';
    Store.update(up);
    addLog('🩸 Host gives ' + p.name + ' 1 Blood (' + nb + ')');
  } else {
    const nb = Math.max(0, (p.blood || 0) - 1);
    const up = { ['players/' + id + '/blood']: nb };
    if (nb === 0 && p.status === 'mortal') {
      const sp = S().spin;
      let bl = sp && sp.playerId === id ? sp.bl : null;
      if (!bl) bl = askBloodline();
      if (!bl) { toast('Cancelled'); return; }
      up['players/' + id + '/status'] = 'pending';
      up['players/' + id + '/claimedBy'] = bl;
    }
    Store.update(up);
    addLog('🩸 Host removes 1 Blood from ' + p.name + ' (' + nb + ')');
  }
}
function revive(id) {
  const p = getPlayer(id);
  if (!p) return;
  Store.update({ ['players/' + id + '/status']: 'mortal', ['players/' + id + '/blood']: settings().maxBlood, ['players/' + id + '/claimedBy']: null, ['players/' + id + '/bloodline']: null });
  addLog('✨ ' + p.name + ' is restored as a mortal');
}
function removePlayer(id) {
  const p = getPlayer(id);
  if (!p || !confirm('Remove ' + p.name + ' from the event?')) return;
  const up = { ['players/' + id]: null };
  if (S().turn === id) up.turn = null;
  Store.update(up);
  addLog('🗑️ ' + p.name + ' removed from the guest list');
}
function addMortals() {
  const names = $('#addNames').value.split('\n').map((x) => x.trim()).filter(Boolean);
  if (!names.length) { toast('Write at least one name'); return; }
  const existing = playersList().map((p) => p.name.toLowerCase());
  const up = {};
  let added = 0;
  names.forEach((nm) => {
    if (existing.includes(nm.toLowerCase())) return;
    existing.push(nm.toLowerCase());
    up['players/' + uid() + added] = { name: nm.slice(0, 40), blood: settings().maxBlood, status: 'mortal', turns: 0 };
    added++;
  });
  if (!added) { toast('Those names already exist'); return; }
  Store.update(up);
  addLog('🎭 ' + added + ' new mortal' + (added > 1 ? 's' : '') + ' entered the Masquerade');
  $('#addNames').value = '';
  toast(added + ' mortal(s) added');
}
function saveSettings() {
  const mb = clamp(parseInt($('#setMaxBlood').value, 10) || 3, 1, 9);
  const fc = clamp(parseInt($('#setFinal').value, 10) || 4, 1, 20);
  Store.set('settings', { maxBlood: mb, finalCount: fc, regClosed: $('#setReg').checked });
  toast('Settings saved');
}
function resetEvent() {
  if (!confirm('Restart the event? Everyone becomes a mortal with full Blood again and the wheel is cleared.')) return;
  const up = { spin: null, turn: null, pick: null, log: null };
  playersList().forEach((p) => {
    up['players/' + p.id + '/blood'] = settings().maxBlood;
    up['players/' + p.id + '/status'] = 'mortal';
    up['players/' + p.id + '/claimedBy'] = null;
    up['players/' + p.id + '/bloodline'] = null;
    up['players/' + p.id + '/turns'] = 0;
  });
  Store.update(up);
  toast('The Masquerade begins anew');
}
function wipeAll() {
  if (!confirm('Delete EVERYTHING (guests, challenges, log)? This cannot be undone.')) return;
  if (!confirm('Really sure?')) return;
  Store.update({ players: null, spin: null, turn: null, pick: null, log: null, challenges: null, settings: null });
  toast('Everything deleted');
}
function addChallenge() {
  const lines = $('#newChallenge').value.split('\n').map((x) => x.trim()).filter(Boolean);
  if (!lines.length) return;
  ensureChallenges();
  const up = { chInit: true }, t = Date.now();
  lines.forEach((l, i) => { up['challenges/n' + t + '_' + pad(i, 4)] = { text: l.slice(0, 160) }; });
  Store.update(up);
  $('#newChallenge').value = '';
  toast(lines.length + ' added to the wheel');
}
function editChallenge(id) {
  const c = challengesList().find((x) => x.id === id);
  const t = c && prompt('Edit challenge:', c.text);
  if (t && t.trim()) Store.set('challenges/' + id, { text: t.trim().slice(0, 160) });
}
function clearChallenges() {
  if (confirm('Remove ALL challenges from the wheel?')) Store.update({ challenges: null, chInit: true });
}
function delChallenge(id) {
  ensureChallenges();
  Store.update({ ['challenges/' + id]: null, chInit: true });
}
function defaultChallenges() {
  if (!confirm('Replace all challenges with the default list?')) return;
  const o = {};
  DEFAULT_CHALLENGES.forEach((t, i) => { o['c' + pad(i)] = { text: t }; });
  Store.update({ challenges: o, chInit: true });
}

/* ---------------- RENDER: STAGE ---------------- */
const dropsHtml = (blood, max) => {
  let h = '';
  for (let i = 0; i < max; i++) h += '<span class="drop' + (i < blood ? '' : ' lost') + '">🩸</span>';
  return h;
};

let pickCycling = false, cycleTimer = 0, lastCycle = 0;
function renderTurn() {
  const s = S();
  const p = s.turn ? getPlayer(s.turn) : null;
  const box = $('#turnPanel');
  if (!p) {
    box.innerHTML = '<div class="turn-label">The Masquerade awaits</div><div class="turn-name" style="font-size:26px">No mortal has been chosen yet</div>';
    return;
  }
  const st = p.status === 'mortal' ? '' : '<div class="hint">' + statusText(p) + '</div>';
  box.innerHTML = '<div class="turn-label">Now facing the Blood Wheel</div>' +
    '<div class="turn-name" id="turnName">' + esc(p.name) + '</div>' +
    '<div class="drops">' + dropsHtml(p.blood, settings().maxBlood) + '</div>' + st;
}
function statusText(p) {
  const bl = p.claimedBy && BLOODLINES[p.claimedBy] ? BLOODLINES[p.claimedBy].name : 'a vampire';
  if (p.status === 'pending') return '☠️ Out of Blood — their fate is in the hands of ' + bl;
  if (p.status === 'banished') return '🩸 Drunk by ' + bl + ' — banished';
  if (p.status === 'turned') return '🦇 Turned — now of ' + (p.bloodline && BLOODLINES[p.bloodline] ? BLOODLINES[p.bloodline].name : 'the vampires');
  return 'Mortal';
}

let lastResultKey = '';
function renderResult(anim) {
  const sp = S().spin;
  const box = $('#resultPanel');
  const panel = box;
  const key = sp ? [sp.n, anim.pC >= 1 ? 'done' : 'spin', sp.resolved || ''].join('|') : 'none';
  if (key === lastResultKey) return;
  lastResultKey = key;
  if (!sp) {
    panel.style.removeProperty('--bl');
    box.innerHTML = '<div class="result-empty">The Blood Wheel awaits its first victim…</div>';
    return;
  }
  const bl = BLOODLINES[sp.bl] || BLOODLINES.onychinus;
  if (anim.pC < 1) {
    panel.style.setProperty('--bl', '#c1121f');
    box.innerHTML = '<div class="spinning">THE WHEEL IS TURNING…</div><div class="res-for">Fate is being decided for <b>' + esc(sp.playerName) + '</b></div>';
    return;
  }
  panel.style.setProperty('--bl', bl.color);
  const stClass = sp.resolved === 'completed' ? 'completed' : sp.resolved === 'failed' ? 'failed' : 'wait';
  const stText = sp.resolved === 'completed' ? '✔ Challenge completed — ' + esc(sp.playerName) + ' keeps their Blood'
    : sp.resolved === 'failed' ? '✖ Failed or refused — ' + esc(bl.name) + ' claims one Blood'
    : '⏳ Awaiting the vampire’s judgement…';
  const num = sp.count > 10 ? '<small style="color:var(--muted)"> #' + (sp.ci + 1) + '</small>' : '';
  box.innerHTML =
    '<div class="reveal">' +
    '<div class="res-for">For <b>' + esc(sp.playerName) + '</b></div>' +
    '<div class="res-challenge"><span class="lbl">The Challenge' + num + '</span><p>' + esc(sp.challenge) + '</p></div>' +
    '<div class="res-vamp">' +
      '<img src="' + bl.img + '" alt="' + esc(bl.name) + '" onerror="this.remove()">' +
      '<div><span class="lbl">Presented &amp; judged by</span><h3>' + esc(bl.icon + ' ' + bl.name) + '</h3><em>' + esc(bl.title) + '</em><q>' + esc(bl.quote) + '</q></div>' +
    '</div>' +
    '<div class="res-status ' + stClass + '">' + stText + '</div>' +
    '</div>';
}

function renderSpinBtn(anim) {
  const c = canSpin();
  const b = $('#spinBtn');
  b.disabled = !c.ok;
  $('#spinHint').textContent = c.why;
}

let lastHostSig = '';
function renderHostbar(force) {
  const bar = $('#hostbar');
  bar.hidden = !isAdmin;
  if (!isAdmin) return;
  const s = S();
  const pl = playersList();
  const sig = JSON.stringify([pl.map((p) => [p.id, p.name, p.status, p.blood, p.claimedBy]), s.turn, s.spin && s.spin.n, s.spin && s.spin.resolved]);
  if (!force && sig === lastHostSig) return;
  lastHostSig = sig;
  const mortals = pl.filter((p) => p.status === 'mortal').sort((a, b) => a.name.localeCompare(b.name));
  const pend = pl.filter((p) => p.status === 'pending');
  bar.innerHTML =
    '<h3>👑 Host controls</h3>' +
    '<div class="hb-row">' +
      '<button class="btn" id="hbRandom">🎲 Pick a random mortal</button>' +
      '<select id="hbSel">' + mortals.map((p) => '<option value="' + p.id + '"' + (p.id === s.turn ? ' selected' : '') + '>' + esc(p.name) + ' (' + p.blood + ')</option>').join('') + '</select>' +
      '<button class="btn ghost" id="hbSet">Choose</button>' +
    '</div>' +
    '<div class="hb-row">' +
      '<button class="btn ok" id="hbOk">✔ Completed</button>' +
      '<button class="btn" id="hbFail">✖ Failed / refused (−1 Blood)</button>' +
    '</div>' +
    pend.map((p) => {
      const bl = p.claimedBy && BLOODLINES[p.claimedBy] ? BLOODLINES[p.claimedBy].name : 'the vampire';
      return '<div class="pend"><b>' + esc(p.name) + '</b> lost all their Blood to <b>' + esc(bl) + '</b>.<div class="hb-row" style="margin:8px 0 0">' +
        '<button class="btn" data-decide="drink" data-id="' + p.id + '">🩸 DRINK (eliminate)</button>' +
        '<button class="btn violet" data-decide="turn" data-id="' + p.id + '">🦇 TURN (join ' + esc(bl) + ')</button></div></div>';
    }).join('');
}

function renderChronicle() {
  const rows = logLines().slice(0, 7);
  $('#chronicle').innerHTML = '<h3>📜 The Chronicle</h3>' + (rows.length
    ? rows.map((r) => '<div class="chron-row">' + esc(r.msg) + '</div>').join('')
    : '<div class="hint">Nothing has happened yet…</div>');
}

function renderFinal() {
  const el = eligible();
  const total = playersList().length;
  const fc = settings().finalCount;
  const pending = playersList().some((p) => p.status === 'pending');
  const box = $('#finalBanner');
  if (total > fc && el.length > 0 && el.length <= fc && !pending) {
    box.innerHTML = '<div class="final"><h2>🏆 The Final Survivors of the Crimson Masquerade 🏆</h2><div>The night is over for the others… these mortals survived!</div><div class="names">' +
      el.map((p) => '<span>' + esc(p.name) + '</span>').join('') + '</div></div>';
  } else box.innerHTML = '';
}

/* ---------------- RENDER: MORTALS ---------------- */
function renderMortals() {
  const pl = playersList();
  const groups = { mortal: [], pending: [], turned: [], banished: [] };
  pl.forEach((p) => (groups[p.status] || groups.mortal).push(p));
  groups.mortal.sort((a, b) => b.blood - a.blood || a.name.localeCompare(b.name));
  ['pending', 'turned', 'banished'].forEach((k) => groups[k].sort((a, b) => a.name.localeCompare(b.name)));
  const el = eligible().length;
  $('#mortalSummary').innerHTML =
    '<span>🎭 ' + pl.length + ' guests</span><span>🩸 ' + el + ' mortals still in the race</span>' +
    '<span>🦇 ' + groups.turned.length + ' turned</span><span>☠️ ' + groups.banished.length + ' banished</span>' +
    '<span>🏆 ' + settings().finalCount + ' will be crowned</span>';

  const max = settings().maxBlood;
  const turnId = S().turn;
  const card = (p) => {
    const actions = isAdmin ? '<div class="mactions">' +
      (p.status === 'mortal' ? '<button class="btn small ghost" data-act="turn" data-id="' + p.id + '">🎭 Call</button>' +
        '<button class="btn small ghost" data-act="minus" data-id="' + p.id + '">−🩸</button>' : '') +
      (p.status !== 'pending' ? '<button class="btn small ghost" data-act="plus" data-id="' + p.id + '">+🩸</button>' : '') +
      (p.status === 'pending' ? '<button class="btn small" data-act="drink" data-id="' + p.id + '">DRINK</button><button class="btn small violet" data-act="tturn" data-id="' + p.id + '">TURN</button>' : '') +
      (p.status !== 'mortal' ? '<button class="btn small ghost" data-act="revive" data-id="' + p.id + '">Revive</button>' : '') +
      '<button class="btn small ghost" data-act="remove" data-id="' + p.id + '">🗑️</button></div>' : '';
    return '<div class="mcard ' + p.status + (p.id === turnId ? ' turn' : '') + '">' +
      '<div class="mname">' + esc(p.name) + (p.id === me ? '<span class="you">you</span>' : '') + '</div>' +
      '<div class="mblood">' + (p.status === 'turned' ? (p.bloodline && BLOODLINES[p.bloodline] ? BLOODLINES[p.bloodline].icon : '🦇') : dropsHtml(p.blood, max)) + '</div>' +
      '<div class="mstatus">' + esc(p.id === turnId && p.status === 'mortal' ? '🎡 Facing the wheel now' : statusText(p)) + '</div>' + actions + '</div>';
  };
  const sec = (title, arr) => arr.length ? '<div class="group-title">' + title + ' (' + arr.length + ')</div><div class="mgrid">' + arr.map(card).join('') + '</div>' : '';
  $('#mortalLists').innerHTML = pl.length
    ? sec('Mortals — still in the race', groups.mortal) + sec('Awaiting their fate', groups.pending) + sec('Turned', groups.turned) + sec('Banished', groups.banished)
    : '<p class="lead">No guests yet. The host adds them in the Host Panel.</p>';
}

/* ---------------- RENDER: STATIC PAGES ---------------- */
function renderBloodlines() {
  $('#bloodlineGrid').innerHTML = BL_KEYS.map((k) => {
    const b = BLOODLINES[k];
    return '<div class="bl-card" style="--bl:' + b.color + '"><img src="' + b.img + '" alt="' + esc(b.name) + '" onerror="this.outerHTML=\'<div class=&quot;fallback&quot;><h3>' + b.icon + ' ' + b.name + '</h3><p>' + b.title + '</p><p><i>' + esc(b.quote).replace(/'/g, '&#39;') + '</i></p></div>\'"></div>';
  }).join('');
}
function renderRules() {
  $('#rulesBox').innerHTML =
    '<div class="rule-card"><h3>🩸 Every guest is a Mortal</h3><p>You enter the Masquerade as a Mortal with <b>3 Blood</b>.</p><div class="big-blood">🩸 🩸 🩸</div>' +
    '<p>Throughout the night, mortals are selected to face the Blood Wheel, where their fate lies in the hands of chance.</p></div>' +
    '<div class="rule-card"><h3>🎡 The Blood Wheel</h3><p>When the wheel is spun, it reveals two things:</p><ul>' +
    '<li>🦇 <b>A Challenge</b> — the trial the selected mortal must complete.</li>' +
    '<li>🩸 <b>A Vampire Bloodline</b> — the vampire who presents the challenge and judges the mortal’s fate.</li></ul>' +
    '<p>The result stays on screen for everyone until the next spin.</p>' +
    '<p>✔ <b>Complete your challenge?</b> You keep your Blood and survive another round.</p>' +
    '<p>✖ <b>Fail or refuse?</b> The vampire claims one of your Blood.</p></div>' +
    '<div class="rule-card"><h3>☠️ Losing all your Blood</h3><p>Once a mortal loses their final Blood, their fate belongs to the vampire who claimed it. That vampire must choose:</p><ul>' +
    '<li>🩸 <b>DRINK</b> — the vampire ends the mortal, eliminating them from the Masquerade.</li>' +
    '<li>🦇 <b>TURN</b> — the vampire spares the mortal’s life, turning them into a member of their bloodline.</li></ul></div>' +
    '<div class="rule-card warn"><h3>⚠️ Important</h3><p>Both <b>banished</b> and <b>turned</b> mortals are eliminated from the survivor competition. A turned mortal may belong to a vampire bloodline, but can no longer compete for the Final Four or claim a survivor reward.</p>' +
    '<p>Only mortals who still have Blood left (1 to 3) are eligible to win.</p></div>' +
    '<div class="rule-card"><h3>🏆 The Final Four &amp; Rewards</h3><p>Protect your Blood and be one of the last four mortals standing. The final four eligible mortals are crowned the <b>Final Survivors of the Crimson Masquerade</b>!</p>' +
    '<p>🎁 Each of the four winners receives one exclusive <b>Crimson Masquerade Frame</b>, the same special design for all four, created for this event.</p>' +
    '<p>When the event ends, the winners are announced and the host explains how to claim the frame.</p></div>' +
    '<div class="rule-end">4 Vampires · 4 Bloodlines · 4 Final Survivors · 1 Exclusive Frame Design<br>Will you survive the Masquerade? 🎭🩸</div>';
}

/* ---------------- RENDER: HOST PANEL ---------------- */
function renderHostPanel() {
  if (!isAdmin) return;
  renderAccounts();
  const chs = challengesList();
  $('#chCount').textContent = '(' + chs.length + ')';
  $('#chList').innerHTML = chs.map((c, i) => '<div class="ch-item"><span>' + (i + 1) + '. ' + esc(c.text) + '</span><button data-edch="' + c.id + '" title="Edit">✏️</button><button data-delch="' + c.id + '" title="Delete">✖</button></div>').join('');
  const st = settings();
  if (document.activeElement !== $('#setMaxBlood')) $('#setMaxBlood').value = st.maxBlood;
  if (document.activeElement !== $('#setFinal')) $('#setFinal').value = st.finalCount;
  $('#setReg').checked = !!st.regClosed;
  $('#fullLog').innerHTML = logLines().slice(0, 80).map((r) => '<div class="chron-row"><small>' + new Date(r.t).toLocaleTimeString() + '</small> ' + esc(r.msg) + '</div>').join('') || '<div class="hint">Empty</div>';
}

function renderAccounts() {
  const us = Object.entries(S().users || {}), ad = S().admins || {}, pl = S().players || {};
  $('#accCount').textContent = '(' + us.length + ')';
  $('#accList').innerHTML = us.map(([id, u]) => '<div class="ch-item"><span>' + esc(u.username) + (ad[id] ? ' 👑' : '') + (pl[id] ? '' : ' <small>(not on guest list)</small>') + '</span>' +
    (pl[id] ? '' : '<button data-acc="add" data-id="' + id + '" title="Add to guest list">➕</button>') +
    (user && id === user.uid ? '' : '<button data-acc="host" data-id="' + id + '" title="' + (ad[id] ? 'Remove host rights' : 'Make host') + '">👑</button>') + '</div>').join('') || '<div class="hint">No accounts yet.</div>';
}

/* ---------------- RENDER: MISC ---------------- */
function renderMeSel() {
  const sel = $('#meSel');
  const pl = playersList().sort((a, b) => a.name.localeCompare(b.name));
  if (me && !pl.find((p) => p.id === me)) me = '';
  sel.innerHTML = '<option value="">👀 Just watching</option>' + pl.map((p) => '<option value="' + p.id + '"' + (p.id === me ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
}

let lastStaticSig = '';
function renderAll() {
  refreshRole();
  applyAdminUI();
  const sig = JSON.stringify([playersList().map((p) => [p.id, p.name]), me]);
  if (sig !== lastStaticSig) { lastStaticSig = sig; renderMeSel(); }
  renderTurn();
  renderFinal();
  renderChronicle();
  renderMortals();
  renderHostbar();
  renderHostPanel();
  const anim = drawFrame();
  renderResult(anim);
  renderSpinBtn(anim);
}

/* ---------------- ANIMATION LOOP ---------------- */
let wasSpinning = false, lastPickAt = 0;
function loop() {
  const anim = drawFrame();
  if (anim.spinning !== wasSpinning) {
    wasSpinning = anim.spinning;
    renderResult(anim);
    renderSpinBtn(anim);
    renderHostbar(true);
  } else if (anim.spinning) {
    renderResult(anim);
  }
  // cycling names while the random pick is "rolling"
  const pk = S().pick;
  const now = Store.now();
  const picking = !!(pk && pk.at && now - pk.at < TURN_PICK_MS && now - pk.at >= -500);
  if (picking) {
    const nameEl = $('#turnName');
    const names = eligible();
    if (nameEl && names.length && Date.now() - lastCycle > 90) {
      lastCycle = Date.now();
      nameEl.textContent = names[Math.floor(Math.random() * names.length)].name;
      nameEl.classList.add('cycling');
    }
    pickCycling = true;
  } else if (pickCycling) {
    pickCycling = false;
    renderTurn();
  }
  requestAnimationFrame(loop);
}

/* ---------------- COUNTDOWN ---------------- */
function tickCountdown() {
  const el = $('#countdown');
  const t = new Date(CFG.EVENT_DATE_UTC || '2026-10-31T19:00:00Z').getTime();
  const d = t - Date.now();
  if (isNaN(t)) { el.textContent = ''; return; }
  if (d <= 0) { el.textContent = '🦇 The doors are open… 🦇'; return; }
  const days = Math.floor(d / 864e5), h = Math.floor(d / 36e5) % 24, m = Math.floor(d / 6e4) % 60, s = Math.floor(d / 1e3) % 60;
  el.textContent = '🕯️ The doors open in ' + days + 'd ' + pad(h, 2) + 'h ' + pad(m, 2) + 'm ' + pad(s, 2) + 's 🕯️';
}

/* ---------------- INIT ---------------- */
function init() {
  // petals
  const pet = $('#petals');
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span');
    s.style.left = rand(0, 100) + 'vw';
    s.style.setProperty('--dx', rand(-120, 120) + 'px');
    s.style.animationDuration = rand(12, 26) + 's';
    s.style.animationDelay = -rand(0, 26) + 's';
    s.style.transform = 'scale(' + rand(0.6, 1.3) + ')';
    pet.appendChild(s);
  }
  if (!Store.live) $('#demoBanner').hidden = false;

  // clean-view exit button
  const ce = document.createElement('button');
  ce.id = 'cleanExit'; ce.className = 'btn small ghost'; ce.textContent = 'Show controls';
  ce.onclick = () => document.body.classList.remove('clean');
  document.body.appendChild(ce);

  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#loginBtn').onclick = login;
  $('#cleanBtn').onclick = () => document.body.classList.add('clean');
  $('#meSel').onchange = (e) => { me = e.target.value; localStorage.setItem('masq_me', me); renderAll(); };
  $('#spinBtn').onclick = doSpin;
  $('#addNamesBtn').onclick = addMortals;
  $('#saveSettingsBtn').onclick = saveSettings;
  $('#resetEventBtn').onclick = resetEvent;
  $('#wipeBtn').onclick = wipeAll;
  $('#addChBtn').onclick = addChallenge;
  $('#newChallenge').addEventListener('keydown', (e) => { if (e.key === 'Enter') addChallenge(); });
  $('#defaultsBtn').onclick = defaultChallenges;
  $('#clearChBtn').onclick = clearChallenges;
  $('#claimBtn').onclick = () => { if (confirm('Become the host of this event?')) Store.set('admins/' + user.uid, true); };
  $('#authForm').addEventListener('submit', (e) => { e.preventDefault(); signIn(); });
  $('#authUp').onclick = signUp;
  $('#authX').onclick = () => $('#authDlg').close();
  $('#accList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-acc]'); if (!b) return;
    const id = b.dataset.id, u = (S().users || {})[id]; if (!u) return;
    if (b.dataset.acc === 'add') { Store.set('players/' + id, { name: u.username, blood: settings().maxBlood, status: 'mortal', turns: 0 }); addLog('🎭 ' + u.username + ' entered the Masquerade'); }
    else Store.set('admins/' + id, (S().admins || {})[id] ? null : true);
  });
  if (Store.live) Store.auth.onAuthStateChanged((u) => { user = u; renderAll(); });
  $('#chList').addEventListener('click', (e) => { const b = e.target.closest('[data-delch]'); if (b) return delChallenge(b.dataset.delch); const x = e.target.closest('[data-edch]'); if (x) editChallenge(x.dataset.edch); });

  // host bar (event delegation, it gets re-rendered)
  $('#hostbar').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'hbRandom') return pickRandom();
    if (t.id === 'hbSet') { const v = $('#hbSel').value; return v && setTurn(v); }
    if (t.id === 'hbOk') return resolveSpin('completed');
    if (t.id === 'hbFail') return resolveSpin('failed');
    if (t.dataset.decide) return decide(t.dataset.id, t.dataset.decide);
  });
  // mortal list actions
  $('#mortalLists').addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || !isAdmin) return;
    const id = t.dataset.id;
    ({
      turn: () => setTurn(id), minus: () => adjustBlood(id, -1), plus: () => adjustBlood(id, 1),
      drink: () => decide(id, 'drink'), tturn: () => decide(id, 'turn'), revive: () => revive(id), remove: () => removePlayer(id)
    })[t.dataset.act]();
  });

  Store.on(renderAll);
  applyAdminUI();
  renderBloodlines();
  renderRules();
  renderAll();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  requestAnimationFrame(loop);
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastDrawKey = { c: '', b: '' }; });
document.addEventListener('DOMContentLoaded', init);
})();
