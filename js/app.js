import { SONGS, ARTIST_COUNT, DECADES, decadeOf } from './songs.js';
import * as G from './game.js';
import * as S from './spotify.js';

const app = document.getElementById('app');
const SAVE_KEY = 'hitster.game';
const SETUP_KEY = 'hitster.setup';

const load = (k, f) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? f : JSON.parse(v);
  } catch {
    return f;
  }
};
const store = (k, v) => {
  try {
    v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- App state ----------

const ui = {
  screen: 'setup',
  game: null,
  setup: load(SETUP_KEY, { names: ['Player 1', 'Player 2'], target: 10, startTokens: 2, decades: [...DECADES] }),
  spotify: { connected: S.isLoggedIn(), profile: null, devices: [], error: null, busy: false },
  music: { songId: null, status: 'off', error: null },
  modal: null, // 'settings' | 'rules'
  setupError: null,
  animatedTurn: null,
};

const saved = load(SAVE_KEY, null);
if (saved?.version === 1 && saved.turn && saved.winner == null) ui.savedGame = saved;

function setGame(next) {
  const prevSong = ui.game?.turn?.songId;
  ui.game = next;
  store(SAVE_KEY, next);
  render();
  if (next?.turn && next.turn.songId !== prevSong && next.turn.phase === 'listen') playCurrent();
}

// ---------- Music ----------

// Playback control needs Premium; free accounts fall back to silent mode.
const spotifyOn = () => ui.spotify.connected && (!ui.spotify.profile || ui.spotify.profile.product === 'premium');

async function playCurrent() {
  const songId = ui.game?.turn?.songId;
  if (!songId) return;
  if (!spotifyOn()) {
    ui.music = { songId, status: 'off', error: null };
    return render();
  }
  ui.music = { songId, status: 'loading', error: null };
  render();
  try {
    const uri = await S.findTrack(G.song(songId));
    if (ui.game?.turn?.songId !== songId) return; // turn moved on while we searched
    await S.playTrack(uri);
    ui.music = { songId, status: 'playing', error: null };
  } catch (err) {
    if (ui.game?.turn?.songId !== songId) return;
    ui.music = { songId, status: 'error', error: err.message, notFound: !!err.notFound };
  }
  render();
  prefetchNext();
}

function prefetchNext() {
  const nextId = ui.game?.deck?.at(-1);
  if (nextId && spotifyOn()) S.findTrack(G.song(nextId)).catch(() => {});
}

async function togglePause() {
  const m = ui.music;
  if (!spotifyOn() || !ui.game?.turn) return;
  try {
    if (m.status === 'playing') {
      await S.pause();
      ui.music = { ...m, status: 'paused' };
    } else if (m.status === 'paused') {
      await S.resume();
      ui.music = { ...m, status: 'playing' };
    } else {
      return playCurrent();
    }
  } catch (err) {
    ui.music = { ...m, status: 'error', error: err.message };
  }
  render();
}

function onPlayerState(state) {
  if (!state || !S.usingSdk()) return;
  if (ui.music.status === 'playing' || ui.music.status === 'paused') {
    const status = state.paused ? 'paused' : 'playing';
    if (status !== ui.music.status) {
      ui.music = { ...ui.music, status };
      render();
    }
  }
}

function onPlayerError(err) {
  ui.spotify.error = err.message;
  render();
}

async function refreshSpotify() {
  if (!S.isLoggedIn()) {
    ui.spotify = { ...ui.spotify, connected: false, profile: null, devices: [] };
    return render();
  }
  ui.spotify.connected = true;
  try {
    const [profile, devices] = await Promise.all([S.getProfile(), S.getDevices()]);
    ui.spotify = { ...ui.spotify, profile, devices, error: null };
    if (profile.product !== 'premium') {
      ui.spotify.error = 'Spotify Premium is required to control playback. You can still play in silent mode.';
    } else if (S.usingSdk()) {
      S.initPlayer({ onState: onPlayerState, onError: onPlayerError }).catch(onPlayerError);
    }
  } catch (err) {
    ui.spotify.error = err.message;
    if (!S.isLoggedIn()) ui.spotify.connected = false;
  }
  render();
}

// ---------- Rendering helpers ----------

const decadeClass = (year) => `d${Math.max(1960, decadeOf(year))}`;
const decadeLabel = (d) => `${String(d).slice(2)}s`;
const PLAYER_CLASS = ['p0', 'p1'];

function card(id, { cls = '' } = {}) {
  const s = G.song(id);
  return `
    <div class="card face ${decadeClass(s.year)} ${cls}">
      <div class="card-artist">${esc(s.artist)}</div>
      <div class="card-year">${s.year}</div>
      <div class="card-title">${esc(s.title)}</div>
    </div>`;
}

function ghost(playerIdx, label) {
  return `<div class="card ghost ${PLAYER_CLASS[playerIdx]}"><span class="ghost-q">?</span><span class="ghost-label">${esc(label)}</span></div>`;
}

const slot = (action, i, playerIdx) =>
  `<button class="slot ${PLAYER_CLASS[playerIdx]}" data-action="${action}" data-i="${i}" aria-label="Place here">+</button>`;

function timelineRow(pi, { plain = false } = {}) {
  const g = ui.game;
  const p = g.players[pi];
  const t = plain ? null : g.turn;
  const isActive = pi === g.current;
  const opp = G.opponentOf(g);
  const n = p.timeline.length;
  const parts = [];
  let extra = 0;
  let slots = 0;

  for (let i = 0; i <= n; i++) {
    if (isActive && t) {
      if (t.phase === 'listen') {
        if (i === t.place) {
          parts.push(ghost(pi, 'here'));
          extra++;
        } else {
          parts.push(slot('place', i, pi));
          slots++;
        }
      } else if (t.phase === 'challenge') {
        if (i === t.place) {
          parts.push(ghost(pi, g.players[pi].name));
          extra++;
        } else if (i === t.challenge) {
          parts.push(ghost(opp, g.players[opp].name));
          extra++;
        } else {
          parts.push(slot('challenge', i, opp));
          slots++;
        }
      } else if (t.phase === 'reveal' && (t.result === 'wrong' || t.result === 'stolen')) {
        if (i === t.place) {
          parts.push(card(t.songId, { cls: 'wrong marker' }));
          extra++;
        }
        if (i === t.challenge) {
          parts.push(card(t.songId, { cls: `${t.result === 'stolen' ? 'right' : 'wrong'} marker ${PLAYER_CLASS[opp]}` }));
          extra++;
        }
      }
    }
    if (i < n) {
      const id = p.timeline[i];
      const isNew = t?.phase === 'reveal' && id === t.songId;
      parts.push(card(id, { cls: isNew ? 'new' : '' }));
    }
  }

  return `
    <section class="row ${PLAYER_CLASS[pi]} ${isActive ? 'active' : ''}" style="--n:${n + extra};--slots:${slots}">
      <div class="row-label">
        <span class="row-name">${esc(p.name)}</span>
        <span class="row-count">${n}/${g.settings.target}</span>
      </div>
      <div class="strip">${parts.join('')}</div>
    </section>`;
}

function scorePanel(pi) {
  const g = ui.game;
  const p = g.players[pi];
  const pips = Array.from({ length: g.settings.target }, (_, i) => `<i class="${i < p.timeline.length ? 'on' : ''}"></i>`).join('');
  const coins = p.tokens ? Array.from({ length: p.tokens }, () => '<b class="coin">★</b>').join('') : '<span class="muted">no tokens</span>';
  return `
    <div class="score ${PLAYER_CLASS[pi]} ${g.current === pi && g.winner == null ? 'turn' : ''}">
      <div class="score-name">${esc(p.name)}</div>
      <div class="score-cards"><span class="big">${p.timeline.length}</span> / ${g.settings.target} cards</div>
      <div class="pips">${pips}</div>
      <div class="coins">${coins}</div>
    </div>`;
}

function musicBar() {
  const m = ui.music;
  if (!spotifyOn()) return `<div class="music muted">🔇 Silent mode, Spotify isn't connected</div>`;
  const label = {
    loading: 'Finding the song…',
    playing: 'Now playing',
    paused: 'Paused',
    error: `⚠ ${esc(m.error ?? 'Playback failed')}`,
    off: 'Ready',
  }[m.status];
  const eq = m.status === 'playing' ? '<span class="eq"><i></i><i></i><i></i><i></i><i></i></span>' : '';
  const errorFix =
    m.status === 'error' && m.notFound && ui.game?.turn?.phase === 'listen'
      ? `<button class="btn small ghost-btn" data-action="replace-song">Swap song (free)</button>`
      : '';
  return `
    <div class="music ${m.status}">
      ${eq}<span>${label}</span>
      <button class="btn small ghost-btn" data-action="toggle-music">${m.status === 'playing' ? '❚❚ Pause' : '▶ Play'}</button>
      <button class="btn small ghost-btn" data-action="restart-music">↺ Restart</button>
      ${errorFix}
    </div>`;
}

const RESULT_TEXT = {
  correct: (a) => `✅ Nailed it! ${a} keeps the card.`,
  'correct-challenge-failed': (a, o) => `✅ ${a} was right, so ${o}'s challenge fails.`,
  stolen: (a, o) => `🏴‍☠️ Stolen! ${a} missed it and ${o} takes the card.`,
  wrong: (a) => `❌ Not quite. The card is discarded.`,
  bought: (a) => `🪙 ${a} cashed in 3 tokens for the card.`,
};

function stage() {
  const g = ui.game;
  const t = g.turn;
  const a = g.players[g.current];
  const oi = G.opponentOf(g);
  const o = g.players[oi];
  const pc = PLAYER_CLASS[g.current];

  if (t.phase === 'reveal') {
    const animate = ui.animatedTurn !== g.turnNumber;
    ui.animatedTurn = g.turnNumber;
    const canName = t.result !== 'bought';
    const atMax = a.tokens >= G.MAX_TOKENS && !t.named;
    return `
      <div class="stage">
        <div class="flip ${animate ? 'animate' : 'done'}">
          <div class="card mystery back"><div class="vinyl"></div></div>
          ${card(t.songId, { cls: 'hero front' })}
        </div>
        <div class="stage-info">
          <div class="turn-label ${pc}">Turn ${g.turnNumber} · ${esc(a.name)}</div>
          <h2 class="result ${t.result}">${RESULT_TEXT[t.result](esc(a.name), esc(o.name))}</h2>
          ${
            canName
              ? `<button class="btn toggle ${t.named ? 'on' : ''}" data-action="named" ${atMax ? 'disabled' : ''}>
                  ${t.named ? '★ Named it! +1 token' : `Did ${esc(a.name)} name the artist <u>and</u> title? +1 ★`}
                </button>`
              : ''
          }
          <div class="actions">
            ${
              g.winner != null
                ? `<button class="btn primary" data-action="show-winner">🏆 And the winner is…</button>`
                : `<button class="btn primary" data-action="next">Next: ${esc(o.name)} ▶</button>`
            }
          </div>
          ${musicBar()}
        </div>
      </div>`;
  }

  const spinning = ui.music.status === 'playing' ? 'spin' : '';
  let heading, body, actions;
  if (t.phase === 'listen') {
    heading = `<div class="turn-label ${pc}">Turn ${g.turnNumber} · ${esc(a.name)}</div><h2>Where does this song go?</h2>`;
    body = `<p class="hint">${
      t.place == null ? `Tap a <b>+</b> in ${esc(a.name)}'s timeline.` : 'Happy with that spot? Lock it in.'
    } Shout the artist &amp; title for a bonus ★.</p>`;
    actions = `
      <button class="btn primary" data-action="lock" ${t.place == null ? 'disabled' : ''}>Lock it in</button>
      <button class="btn" data-action="skip" ${a.tokens < G.SKIP_COST ? 'disabled' : ''}>Skip song (−1 ★)</button>
      <button class="btn" data-action="buy" ${a.tokens < G.BUY_COST ? 'disabled' : ''}>Buy card (−3 ★)</button>`;
  } else {
    const opc = PLAYER_CLASS[oi];
    heading = `<div class="turn-label ${opc}">Challenge · ${esc(o.name)}</div><h2>${esc(o.name)}, do you trust it?</h2>`;
    body = `<p class="hint">Spend 1 ★ and pick a <b>different</b> spot. If ${esc(a.name)} is wrong and you're right, you steal the card.</p>`;
    actions = `
      <button class="btn primary ${opc}" data-action="confirm-challenge" ${t.challenge == null ? 'disabled' : ''}>Challenge! (−1 ★)</button>
      <button class="btn" data-action="decline-challenge">No challenge, reveal it</button>`;
  }
  return `
    <div class="stage">
      <div class="card mystery hero"><div class="vinyl ${spinning}"></div><span class="mystery-q">?</span></div>
      <div class="stage-info">
        ${heading}${body}
        <div class="actions">${actions}</div>
        ${musicBar()}
      </div>
    </div>`;
}

function spotifyPanel() {
  const sp = ui.spotify;
  const clientId = S.getClientId();
  const redirect = S.redirectUri();
  if (!sp.connected) {
    return `
      <div class="panel spotify">
        <h3><span class="sp-logo">●</span> Connect Spotify</h3>
        <ol class="steps">
          <li>Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">Spotify Developer Dashboard</a> and <b>Create app</b>.</li>
          <li>Add this <b>Redirect URI</b>:<br><code class="copy" data-action="copy" data-text="${esc(redirect)}" title="Click to copy">${esc(redirect)}</code></li>
          <li>Tick <b>Web API</b> and <b>Web Playback SDK</b>, save, and copy the <b>Client ID</b>.</li>
        </ol>
        <div class="inline">
          <input id="client-id" placeholder="Paste Client ID" value="${esc(clientId)}" spellcheck="false" autocomplete="off">
          <button class="btn primary sp" data-action="connect">Connect</button>
        </div>
        <p class="hint small">Needs Spotify Premium. You can also play in silent mode and use your own music.</p>
        ${sp.error ? `<p class="error">${esc(sp.error)}</p>` : ''}
      </div>`;
  }
  const pref = S.getDevicePreference();
  const options = [
    `<option value="${S.SDK_DEVICE}" ${pref === S.SDK_DEVICE ? 'selected' : ''}>${
      S.browserPlaybackSupported ? 'This browser tab (cast the tab to your TV)' : 'Auto: the Spotify app that is open'
    }</option>`,
    ...sp.devices
      .filter((d) => d.name !== 'Hitster TV')
      .map((d) => `<option value="${esc(d.id)}" ${pref === d.id ? 'selected' : ''}>${esc(d.name)} (${esc(d.type)})</option>`),
  ];
  if (pref !== S.SDK_DEVICE && !sp.devices.some((d) => d.id === pref)) {
    options.push(`<option value="${esc(pref)}" selected>Last used device (offline?)</option>`);
  }
  return `
    <div class="panel spotify">
      <h3><span class="sp-logo">●</span> Spotify connected</h3>
      <p>${sp.profile ? `Signed in as <b>${esc(sp.profile.display_name || sp.profile.id)}</b>` : 'Signed in'}</p>
      <label class="field">Play music on
        <div class="inline">
          <select id="device">${options.join('')}</select>
          <button class="btn small" data-action="refresh-devices" title="Refresh devices">↻</button>
        </div>
      </label>
      <p class="hint small">${
        S.browserPlaybackSupported
          ? "Tip: open Spotify on your TV or speaker first and it'll show up here."
          : 'On a phone, music plays through the Spotify app. Open Spotify (on this phone or your TV) and play any song for a second so it shows up here.'
      }</p>
      ${sp.error ? `<p class="error">${esc(sp.error)}</p>` : ''}
      <button class="btn small ghost-btn" data-action="disconnect">Disconnect</button>
    </div>`;
}

function rulesHtml() {
  return `
    <h3>How to play</h3>
    <ol class="rules">
      <li>Each player starts with one card in their timeline.</li>
      <li>On your turn a mystery song plays. Tap the <b>+</b> where you think it belongs, oldest on the left and newest on the right.</li>
      <li>Your opponent can spend <b>1 ★</b> to <b>challenge</b> by picking a different spot. If you're wrong and they're right, they steal the card.</li>
      <li>Name the <b>artist and title</b> before the reveal to earn <b>+1 ★</b> (max ${G.MAX_TOKENS}).</li>
      <li>Spend <b>1 ★</b> to skip a song, or <b>3 ★</b> to take the card for free.</li>
      <li>First to the target number of cards wins!</li>
    </ol>`;
}

function modal() {
  if (!ui.modal) return '';
  const content =
    ui.modal === 'rules'
      ? rulesHtml()
      : `${spotifyPanel()}
         <div class="panel">
           <h3>Game</h3>
           <div class="actions">
             <button class="btn" data-action="fullscreen">⛶ Fullscreen</button>
             <button class="btn danger" data-action="quit">End game</button>
           </div>
         </div>`;
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal" data-stop>
        <button class="close" data-action="close-modal" aria-label="Close">✕</button>
        ${content}
      </div>
    </div>`;
}

// ---------- Screens ----------

function setupScreen() {
  const s = ui.setup;
  const count = G.deckFor(s.decades).length;
  const decadeChips = DECADES.map(
    (d) =>
      `<button class="chip ${decadeClass(d)} ${s.decades.includes(d) ? 'on' : ''}" data-action="decade" data-d="${d}">${decadeLabel(d)}</button>`,
  ).join('');
  return `
    <main class="setup">
      <header class="hero-title">
        <div class="logo">HIT<span>LINE</span></div>
        <p class="tagline">The music timeline game · ${ARTIST_COUNT} artists · ${SONGS.length} songs · 1950s to today</p>
      </header>
      <div class="setup-grid">
        <div class="panel">
          <h3>Players</h3>
          <div class="names">
            <input class="p0" id="name0" maxlength="16" value="${esc(s.names[0])}" placeholder="Player 1">
            <span class="vs">vs</span>
            <input class="p1" id="name1" maxlength="16" value="${esc(s.names[1])}" placeholder="Player 2">
          </div>
          <div class="two">
            <label class="field">Cards to win
              <select id="target">${[5, 8, 10, 12, 15].map((n) => `<option ${n === s.target ? 'selected' : ''}>${n}</option>`).join('')}</select>
            </label>
            <label class="field">Starting ★ tokens
              <select id="tokens">${[0, 1, 2, 3, 4, 5].map((n) => `<option ${n === s.startTokens ? 'selected' : ''}>${n}</option>`).join('')}</select>
            </label>
          </div>
          <div class="field">Decades <span class="muted">(${count} songs)</span>
            <div class="chips">${decadeChips}</div>
          </div>
          ${ui.setupError ? `<p class="error">${esc(ui.setupError)}</p>` : ''}
          <div class="actions">
            <button class="btn primary big" data-action="start">Start game</button>
            ${ui.savedGame ? `<button class="btn big" data-action="resume">Resume last game</button>` : ''}
            <button class="btn" data-action="rules">How to play</button>
          </div>
        </div>
        ${spotifyPanel()}
      </div>
      <p class="cast-tip">📺 <b>To play on your TV:</b> in Chrome open the ⋮ menu, choose <b>Cast…</b>, then cast this <b>tab</b>. Music from this tab goes to the TV too. Hit ⛶ for fullscreen.</p>
    </main>`;
}

function gameScreen() {
  const g = ui.game;
  return `
    <main class="game">
      <header class="topbar">
        ${scorePanel(0)}
        <div class="center-title">
          <div class="logo small">HIT<span>LINE</span></div>
          <div class="deck-left">${g.deck.length} songs left</div>
          <div class="tools">
            <button class="icon" data-action="rules" title="Rules">?</button>
            <button class="icon" data-action="fullscreen" title="Fullscreen">⛶</button>
            <button class="icon" data-action="settings" title="Settings">⚙</button>
          </div>
        </div>
        ${scorePanel(1)}
      </header>
      ${stage()}
      <div class="rows">
        ${timelineRow(g.current)}
        ${timelineRow(G.opponentOf(g))}
      </div>
    </main>`;
}

function winnerScreen() {
  const g = ui.game;
  const w = g.winner;
  const title = w === 'tie' ? "It's a tie!" : `${esc(g.players[w].name)} wins!`;
  const confetti = Array.from({ length: 40 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.4}s;--c:${i % 7}"></i>`).join('');
  return `
    <main class="winner">
      <div class="confetti">${confetti}</div>
      <div class="logo">HIT<span>LINE</span></div>
      <h1 class="${w === 'tie' ? '' : PLAYER_CLASS[w]}">🏆 ${title}</h1>
      <p class="tagline">${g.players.map((p) => `${esc(p.name)}: ${p.timeline.length} cards`).join(' · ')}</p>
      <div class="rows">${timelineRow(0, { plain: true })}${timelineRow(1, { plain: true })}</div>
      <div class="actions center">
        <button class="btn primary big" data-action="rematch">Rematch</button>
        <button class="btn big" data-action="quit">New setup</button>
      </div>
    </main>`;
}

function render() {
  const screen =
    ui.screen === 'game' && ui.game ? gameScreen() : ui.screen === 'winner' && ui.game ? winnerScreen() : setupScreen();
  app.innerHTML = screen + modal();
}

// ---------- Events ----------

function readSetupForm() {
  const val = (id) => document.getElementById(id)?.value;
  if (!document.getElementById('name0')) return;
  ui.setup = {
    ...ui.setup,
    names: [val('name0').trim() || 'Player 1', val('name1').trim() || 'Player 2'],
    target: Number(val('target')),
    startTokens: Number(val('tokens')),
  };
  store(SETUP_KEY, ui.setup);
}

function startGame() {
  try {
    ui.setupError = null;
    ui.screen = 'game';
    ui.savedGame = null;
    S.unlockAudio();
    setGame(G.newGame(ui.setup));
  } catch (err) {
    ui.screen = 'setup';
    ui.setupError = err.message;
    render();
  }
}

const actions = {
  start() {
    readSetupForm();
    startGame();
  },
  resume() {
    ui.screen = 'game';
    S.unlockAudio();
    const g = ui.savedGame;
    ui.savedGame = null;
    ui.game = null;
    setGame(g);
    if (g.turn.phase !== 'listen') playCurrent();
  },
  rematch() {
    ui.screen = 'game';
    startGame();
  },
  decade(el) {
    readSetupForm();
    const d = Number(el.dataset.d);
    const set = new Set(ui.setup.decades);
    set.has(d) ? set.delete(d) : set.add(d);
    ui.setup.decades = DECADES.filter((x) => set.has(x));
    store(SETUP_KEY, ui.setup);
    render();
  },
  place: (el) => setGame(G.choosePlacement(ui.game, Number(el.dataset.i))),
  lock: () => setGame(G.lockPlacement(ui.game)),
  challenge: (el) => setGame(G.chooseChallenge(ui.game, Number(el.dataset.i))),
  'confirm-challenge': () => setGame(G.confirmChallenge(ui.game)),
  'decline-challenge': () => setGame(G.declineChallenge(ui.game)),
  named: () => setGame(G.toggleNamed(ui.game)),
  skip: () => setGame(G.skipSong(ui.game)),
  'replace-song': () => setGame(G.replaceSong(ui.game)),
  buy: () => setGame(G.buyCard(ui.game)),
  next: () => {
    S.unlockAudio();
    setGame(G.nextTurn(ui.game));
  },
  'show-winner'() {
    ui.screen = 'winner';
    store(SAVE_KEY, null);
    render();
  },
  'toggle-music': () => {
    S.unlockAudio();
    togglePause();
  },
  'restart-music': () => {
    S.unlockAudio();
    playCurrent();
  },
  rules() {
    ui.modal = 'rules';
    render();
  },
  settings() {
    ui.modal = 'settings';
    render();
    if (ui.spotify.connected) refreshSpotify();
  },
  'close-modal'(el, e) {
    if (e.target.closest('[data-stop]') && !el.classList.contains('close')) return;
    ui.modal = null;
    render();
  },
  quit() {
    if (ui.screen === 'game' && !confirm('End this game?')) return;
    ui.modal = null;
    ui.game = null;
    ui.screen = 'setup';
    store(SAVE_KEY, null);
    S.pause().catch(() => {});
    render();
  },
  fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
  async connect() {
    readSetupForm();
    const id = document.getElementById('client-id')?.value.trim();
    if (!id) {
      ui.spotify.error = 'Paste your Client ID first.';
      return render();
    }
    S.setClientId(id);
    try {
      await S.login();
    } catch (err) {
      ui.spotify.error = err.message;
      render();
    }
  },
  disconnect() {
    S.logout();
    ui.spotify = { connected: false, profile: null, devices: [], error: null };
    ui.music = { songId: null, status: 'off', error: null };
    render();
  },
  'refresh-devices': () => refreshSpotify(),
  async copy(el) {
    try {
      await navigator.clipboard.writeText(el.dataset.text);
      el.classList.add('copied');
      setTimeout(() => el.classList.remove('copied'), 1200);
    } catch {}
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'device') {
    S.setDevicePreference(e.target.value);
    if (S.usingSdk()) S.initPlayer({ onState: onPlayerState, onError: onPlayerError }).catch(onPlayerError);
    if (ui.game?.turn && ui.music.status !== 'off') playCurrent();
  } else if (['name0', 'name1', 'target', 'tokens'].includes(e.target.id)) {
    readSetupForm();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === 'Escape' && ui.modal) {
    ui.modal = null;
    render();
  } else if (e.key === ' ' && ui.screen === 'game') {
    e.preventDefault();
    S.unlockAudio();
    togglePause();
  }
});

// ---------- Boot ----------

(async () => {
  render();
  try {
    if (await S.handleRedirect()) ui.spotify.connected = true;
  } catch (err) {
    ui.spotify.error = err.message;
  }
  if (S.isLoggedIn()) refreshSpotify();
  else render();
})();
