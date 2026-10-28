import { SONGS, ARTIST_COUNT, DECADES, decadeOf } from './songs.js?v=22';
import * as G from './game.js?v=22';
import * as S from './spotify.js?v=22';

const app = document.getElementById('app');
const SAVE_KEY = 'hitster.game';
const SETUP_KEY = 'hitster.setup.v2';

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
  setup: load(SETUP_KEY, { names: ['Player 1', 'Player 2'], target: 10, startTokens: 0, decades: [...DECADES] }),
  spotify: { connected: S.isLoggedIn(), profile: null, error: null, busy: false },
  music: { songId: null, status: 'off', error: null },
  modal: null, // 'settings' | 'rules'
  setupError: null,
  animatedTurn: null,
};

// Setups saved before the 50s option existed had those songs inside the 60s, so keep them in.
if (!ui.setup.decades.includes(1950) && ui.setup.decades.includes(1960) && !ui.setup.has50s) ui.setup.decades.unshift(1950);
ui.setup.has50s = true;

const saved = load(SAVE_KEY, null);
if (saved?.version === 2 && saved.turn && saved.winner == null) ui.savedGame = saved;

function setGame(next) {
  const prev = ui.game?.turn;
  ui.game = next;
  store(SAVE_KEY, next);
  render();
  // Start the song whenever a turn enters 'listen' (new song, or right after the steal step).
  const t = next?.turn;
  if (t?.phase === 'listen' && (t.songId !== prev?.songId || prev?.phase !== 'listen')) playCurrent();
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
    const track = await S.findTrack(G.song(songId));
    if (ui.game?.turn?.songId !== songId) return; // turn moved on while we searched
    const device = await S.playTrack(track);
    ui.music = { songId, status: 'playing', error: null, device };
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
  if (!spotifyOn() || !ui.game?.turn || ui.game.turn.phase === 'steal') return;
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
    ui.spotify = { ...ui.spotify, connected: false, profile: null };
    return render();
  }
  ui.spotify.connected = true;
  try {
    const profile = await S.getProfile();
    ui.spotify = { ...ui.spotify, profile, error: null };
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

const decadeClass = (year) => `d${Math.max(1950, decadeOf(year))}`;
const decadeLabel = (d) => `${String(d).slice(2)}s`;
const PLAYER_CLASS = ['p0', 'p1'];
const dot = (pi) => `<i class="dot ${PLAYER_CLASS[pi]}"></i>`;
const logo = (cls = '') => `<div class="logo ${cls}">HIT<span>LINE</span></div>`;
const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.8" width="3" height="10.4" rx="1" fill="currentColor"/><rect x="9.5" y="2.8" width="3" height="10.4" rx="1" fill="currentColor"/></svg>',
  restart:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4.4 1.8v3h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// "Jay's turn · Round 2": a round is one turn for each player.
const turnLabel = (g) =>
  `<div class="eyebrow">${dot(g.current)}${esc(g.players[g.current].name)}’s turn · Round ${Math.ceil(g.turnNumber / 2)}</div>`;

function card(id, { cls = '' } = {}) {
  const s = G.song(id);
  return `
    <div class="card face ${decadeClass(s.year)} ${cls}">
      <div class="card-artist">${esc(s.artist)}</div>
      <div class="card-year">${s.year}</div>
      <div class="card-title">${esc(s.title)}</div>
    </div>`;
}

// The chosen spot in the timeline, before the answer is revealed.
function ghost() {
  return `<div class="card ghost"><span class="ghost-q">?</span><span class="ghost-label">Place here</span></div>`;
}

const slot = (action, i) => `<button class="slot" data-action="${action}" data-i="${i}" aria-label="Place the song here">+</button>`;

function vinyl({ spin = false, cls = '' } = {}) {
  return `<div class="vinyl ${spin ? 'spin' : ''} ${cls}"><div class="vinyl-label"><span>?</span></div></div>`;
}

// Splits a timeline into runs of cards that share a year: [{ start, end }] with end exclusive.
function yearGroups(timeline) {
  const groups = [];
  timeline.forEach((id, i) => {
    const last = groups.at(-1);
    if (last && G.yearOf(timeline[last.start]) === G.yearOf(id)) last.end = i + 1;
    else groups.push({ start: i, end: i + 1 });
  });
  return groups;
}

// Same-year cards are drawn as one pile, newest on top, each earlier card's artist peeking out.
function stack(ids, newId) {
  const order = [...ids.filter((id) => id !== newId), ...ids.filter((id) => id === newId)];
  return `
    <div class="stack ${ids.includes(newId) ? 'has-new' : ''}" style="--k:${ids.length}">
      ${order.map((id, i) => `<div class="stack-item" style="--i:${i}">${card(id, { cls: id === newId ? 'new' : '' })}</div>`).join('')}
      <span class="stack-count">×${ids.length}</span>
    </div>`;
}

function timelineRow(pi, { plain = false } = {}) {
  const g = ui.game;
  const p = g.players[pi];
  const t = plain ? null : g.turn;
  const isActive = pi === g.current;
  const opp = G.opponentOf(g);
  const stealing = t?.phase === 'steal' && pi === opp;
  const n = p.timeline.length;
  const newId = t?.phase === 'reveal' ? t.songId : t?.phase !== 'steal' ? t?.stolen : null;
  const parts = [];
  let items = 0;
  let slots = 0;

  // Piles spread back out during a steal so any single card can be picked.
  const groups = stealing ? p.timeline.map((_, i) => ({ start: i, end: i + 1 })) : yearGroups(p.timeline);
  // A saved placement inside a pile (from before piles existed) is shown at the pile's end.
  const boundaryOf = (i) => groups.find((gr) => i > gr.start && i < gr.end)?.end ?? i;
  const place = t?.place == null ? null : boundaryOf(t.place);

  const gap = (i) => {
    if (!isActive || !t) return;
    if (t.phase === 'listen') {
      if (i === place) {
        parts.push(ghost());
        items++;
      } else {
        parts.push(slot('place', i));
        slots++;
      }
    } else if (t.phase === 'reveal' && t.result === 'wrong' && i === place) {
      parts.push(card(t.songId, { cls: 'wrong marker' }));
      items++;
    }
  };

  for (const { start, end } of groups) {
    gap(start);
    const ids = p.timeline.slice(start, end);
    if (stealing) {
      // Opponent's cards are pickable during the steal step.
      const id = ids[0];
      const picked = id === t.stealPick ? 'picked' : '';
      parts.push(`<button class="pick ${picked}" data-action="steal-pick" data-id="${esc(id)}">${card(id)}</button>`);
    } else if (ids.length > 1) {
      parts.push(stack(ids, newId));
    } else {
      parts.push(card(ids[0], { cls: ids[0] === newId ? 'new' : '' }));
    }
    items++;
  }
  gap(n);

  const tag = plain ? '' : stealing ? 'Tap a card to steal' : isActive ? 'Timeline' : 'Opponent';
  return `
    <section class="row ${PLAYER_CLASS[pi]} ${isActive && !plain ? 'active' : ''} ${stealing ? 'stealable' : ''}" style="--n:${Math.max(1, items)};--slots:${slots}">
      <div class="row-label">
        ${dot(pi)}<span class="row-name">${esc(p.name)}</span>
        ${tag ? `<span class="row-tag">${tag}</span>` : ''}
        <span class="row-count">${n} / ${g.settings.target}</span>
      </div>
      <div class="strip">${parts.join('')}</div>
    </section>`;
}

function scorePanel(pi) {
  const g = ui.game;
  const p = g.players[pi];
  const pct = Math.min(100, (p.timeline.length / g.settings.target) * 100);
  const steal = p.tokens >= G.STEAL_COST ? '<span class="steal-ready">Steal ready</span>' : '';
  return `
    <div class="score ${PLAYER_CLASS[pi]} ${g.current === pi && g.winner == null ? 'turn' : ''}">
      <div class="score-head">${dot(pi)}<span class="score-name">${esc(p.name)}</span>${steal}</div>
      <div class="score-stats">
        <span><b>${p.timeline.length}</b> / ${g.settings.target}</span>
        <span class="tokens" title="Tokens"><span class="star">★</span> ${p.tokens}</span>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
    </div>`;
}

function musicBar() {
  const m = ui.music;
  if (!spotifyOn()) {
    return `
      <div class="music off">
        <div class="status"><i class="status-dot"></i><span class="status-main">Silent mode</span><span class="status-sub">Spotify not connected</span></div>
      </div>`;
  }
  const label = {
    loading: 'Finding the song…',
    playing: m.device ? `Playing on ${esc(m.device)}` : 'Playing',
    paused: 'Paused',
    error: esc(m.error ?? 'Playback failed'),
    off: 'Ready',
  }[m.status];
  const errorFix =
    m.status === 'error' && m.notFound && ui.game?.turn?.phase === 'listen'
      ? `<button class="btn tertiary small" data-action="replace-song">Swap song</button>`
      : '';
  // On phones the Spotify app often needs to be opened to wake it up.
  const openApp =
    m.status === 'error' && !S.browserPlaybackSupported ? `<a class="btn tertiary small" href="spotify:">Open Spotify</a>` : '';
  return `
    <div class="music ${m.status}">
      <div class="status"><i class="status-dot"></i><span class="status-main">${label}</span><span class="status-sub">Spotify</span></div>
      <div class="music-actions">
        <button class="btn tertiary small" data-action="toggle-music">${m.status === 'playing' ? `${ICON.pause}Pause` : `${ICON.play}Play`}</button>
        <button class="btn tertiary small" data-action="restart-music" aria-label="Restart song">${ICON.restart}<span class="lbl">Restart</span></button>
        ${openApp}${errorFix}
      </div>
    </div>`;
}

const RESULT = {
  correct: { title: 'Correct', sub: (a) => `${a} keeps the card.` },
  wrong: { title: 'Not quite', sub: () => 'The card is discarded.' },
};

function stage() {
  const g = ui.game;
  const t = g.turn;
  const a = g.players[g.current];
  const o = g.players[G.opponentOf(g)];

  if (t.phase === 'reveal') {
    const animate = ui.animatedTurn !== g.turnNumber;
    ui.animatedTurn = g.turnNumber;
    const r = RESULT[t.result];
    return `
      <div class="stage">
        ${turnLabel(g)}
        <div class="flip ${animate ? 'animate' : 'done'}">
          ${vinyl({ cls: 'back' })}
          ${card(t.songId, { cls: 'hero front' })}
        </div>
        <div class="stage-info">
          <h2 class="result ${t.result}"><i class="result-mark">${t.result === 'correct' ? '✓' : '✕'}</i>${r.title}</h2>
          <p class="hint">${r.sub(esc(a.name))}</p>
          <button class="btn secondary toggle ${t.named ? 'on' : ''}" data-action="named">
            ${t.named ? '★&ensp;Named it · +1 token' : `${esc(a.name)} named the artist and title? +1 ★`}
          </button>
          ${musicBar()}
          <div class="actions">
            ${
              g.winner != null
                ? `<button class="btn primary" data-action="show-winner">See the winner</button>`
                : `<button class="btn primary" data-action="next">Next: ${esc(o.name)}’s turn</button>`
            }
          </div>
        </div>
      </div>`;
  }

  let heading, body, actions;
  if (t.phase === 'listen') {
    heading = '<h2>Where does this song belong?</h2>';
    body = `
      <p class="hint">${t.place == null ? 'Place the mystery song somewhere in your timeline.' : 'Happy with that spot? Lock it in.'}</p>
      <p class="hint subtle">Name the artist and title for +1 ★</p>`;
    actions = `<button class="btn primary" data-action="lock" ${t.place == null ? 'disabled' : ''}>Lock it in</button>`;
  } else {
    heading = '<h2>Steal a card?</h2>';
    body = `<p class="hint">You have ${a.tokens} ★. Trade ${G.STEAL_COST} to take any card from ${esc(o.name)}’s timeline${
      t.stealPick ? '.' : '. Tap the one you want.'
    } The song plays after this.</p>`;
    actions = `
      <button class="btn primary" data-action="confirm-steal" ${t.stealPick == null ? 'disabled' : ''}>Steal it (−${G.STEAL_COST} ★)</button>
      <button class="btn secondary" data-action="decline-steal">Not now, play the song</button>`;
  }
  return `
    <div class="stage">
      ${turnLabel(g)}
      <div class="record">${vinyl({ spin: t.phase === 'listen' && ui.music.status === 'playing' })}</div>
      <div class="stage-info">
        ${heading}${body}
        ${t.phase === 'steal' ? '' : musicBar()}
        <div class="actions">${actions}</div>
      </div>
    </div>`;
}

function spotifyPanel() {
  const sp = ui.spotify;
  const clientId = S.getClientId();
  const redirect = S.redirectUri();
  if (!sp.connected) {
    return `
      <section class="panel spotify">
        <h3 class="panel-title"><i class="status-dot"></i>Spotify</h3>
        <p class="hint">Log in with Spotify to hear the songs. Needs Spotify Premium; without it the game runs in silent mode.</p>
        <button class="btn secondary connect-main" data-action="connect">Connect Spotify</button>
        <p class="hint small">Login not working? Ask whoever set up Hitline to add your Spotify email to their app.</p>
        ${sp.error ? `<p class="error">${esc(sp.error)}</p>` : ''}
        <!-- Only needed when running your own copy of Hitline with your own Spotify app. -->
        <details class="own-app">
          <summary>Use your own Spotify app</summary>
          <ol class="steps">
            <li>Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">Spotify Developer Dashboard</a> and <b>Create app</b>.</li>
            <li>Add this <b>Redirect URI</b>:<br><code class="copy" data-action="copy" data-text="${esc(redirect)}" title="Click to copy">${esc(redirect)}</code></li>
            <li>Tick <b>Web API</b> and <b>Web Playback SDK</b>, save, and copy the <b>Client ID</b>.</li>
          </ol>
          <div class="inline">
            <input id="client-id" placeholder="Paste Client ID" value="${esc(clientId)}" spellcheck="false" autocomplete="off">
            <button class="btn secondary" data-action="connect" data-custom="1">Connect</button>
          </div>
        </details>
      </section>`;
  }
  return `
    <section class="panel spotify connected">
      <h3 class="panel-title"><i class="status-dot"></i>Spotify connected</h3>
      <p class="signed-in">${sp.profile ? `Signed in as <b>${esc(sp.profile.display_name || sp.profile.id)}</b>` : 'Signed in'}</p>
      <p class="hint small">${
        S.browserPlaybackSupported
          ? 'Music plays in this browser tab. To play on a TV, cast the tab. For a speaker, pick it as your computer’s sound output.'
          : `Music plays through Spotify on this ${S.deviceWord}. To hear it on a speaker or TV, pick it with AirPlay or Bluetooth, not Spotify’s own device list.`
      }</p>
      ${sp.error ? `<p class="error">${esc(sp.error)}</p>` : ''}
      <button class="btn tertiary small" data-action="disconnect">Disconnect</button>
    </section>`;
}

function rulesHtml() {
  return `
    <h3 class="modal-title">How to play</h3>
    <ol class="rules">
      <li>Each player starts with one card in their timeline and no tokens.</li>
      <li>On your turn a mystery song plays. Tap a <b>+</b> where you think it belongs, oldest on the left and newest on the right.</li>
      <li>Name the <b>artist and title</b> to earn <b>+1 ★</b>, even if you got the year wrong.</li>
      <li>At the start of your turn, before the song plays, trade <b>${G.STEAL_COST} ★</b> to <b>steal any card</b> from your opponent’s timeline.</li>
      <li>First to the target number of cards wins.</li>
    </ol>`;
}

function modal() {
  if (!ui.modal) return '';
  const content =
    ui.modal === 'rules'
      ? rulesHtml()
      : `<h3 class="modal-title">Settings</h3>
         ${spotifyPanel()}
         <section class="panel">
           <h3 class="panel-title">Game</h3>
           <div class="actions">
             <button class="btn secondary" data-action="fullscreen">⛶&ensp;Fullscreen</button>
             <button class="btn tertiary danger" data-action="quit">End game</button>
           </div>
         </section>`;
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
      `<button class="chip ${decadeClass(d)} ${s.decades.includes(d) ? 'on' : ''}" data-action="decade" data-d="${d}" aria-pressed="${s.decades.includes(d)}"><i></i>${decadeLabel(d)}</button>`,
  ).join('');
  return `
    <main class="setup">
      <header class="hero-title">
        ${logo('big')}
        <p class="tagline">The music timeline game</p>
        <p class="tagline sub">${SONGS.length.toLocaleString()} songs · ${ARTIST_COUNT} artists · 1950s to today</p>
      </header>
      <div class="setup-grid">
        <section class="panel">
          <h3 class="panel-title">Players</h3>
          <div class="names">
            <label class="name-input">${dot(0)}<input id="name0" maxlength="16" value="${esc(s.names[0])}" placeholder="Player 1" aria-label="Player 1 name"></label>
            <span class="vs">vs</span>
            <label class="name-input">${dot(1)}<input id="name1" maxlength="16" value="${esc(s.names[1])}" placeholder="Player 2" aria-label="Player 2 name"></label>
          </div>
          <div class="two">
            <label class="field"><span class="field-label">Cards to win</span>
              <select id="target">${[5, 8, 10, 12, 15, 20, 25, 30].map((n) => `<option ${n === s.target ? 'selected' : ''}>${n}</option>`).join('')}</select>
            </label>
            <label class="field"><span class="field-label">Starting tokens</span>
              <select id="tokens">${[0, 1, 2, 3, 4, 5].map((n) => `<option ${n === s.startTokens ? 'selected' : ''}>${n}</option>`).join('')}</select>
            </label>
          </div>
          <div class="field"><span class="field-label">Decades <span class="count">${count.toLocaleString()} songs</span></span>
            <div class="chips">${decadeChips}</div>
          </div>
          ${ui.setupError ? `<p class="error">${esc(ui.setupError)}</p>` : ''}
          <div class="actions">
            <button class="btn primary big" data-action="start">Start game</button>
            ${ui.savedGame ? `<button class="btn secondary big" data-action="resume">Resume last game</button>` : ''}
            <button class="btn tertiary" data-action="rules">How to play</button>
          </div>
        </section>
        ${spotifyPanel()}
      </div>
      <p class="cast-tip"><b>Playing on a TV?</b> From a phone, mirror your screen and send sound with AirPlay or Bluetooth. From a laptop, use Chrome’s ⋮ menu → Cast… → Cast tab.</p>
    </main>`;
}

function gameScreen() {
  const g = ui.game;
  return `
    <main class="game">
      <header class="topbar">
        ${logo('small')}
        <div class="deck-left">${g.deck.length} songs left</div>
        <div class="tools">
          <button class="icon" data-action="rules" title="How to play" aria-label="How to play">?</button>
          <button class="icon" data-action="fullscreen" title="Fullscreen" aria-label="Fullscreen">⛶</button>
          <button class="icon" data-action="settings" title="Settings" aria-label="Settings">⚙</button>
        </div>
      </header>
      <div class="scores">${scorePanel(0)}${scorePanel(1)}</div>
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
  const title = w === 'tie' ? 'It’s a tie' : `${esc(g.players[w].name)} wins`;
  const confetti = Array.from({ length: 32 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${((i * 1.37) % 6).toFixed(2)}s;--s:${0.8 + (i % 5) * 0.1}"></i>`).join('');
  return `
    <main class="winner">
      <div class="confetti">${confetti}</div>
      ${logo('small')}
      <div class="eyebrow center">Game over</div>
      <h1>${w === 'tie' ? '' : dot(w)}${title}</h1>
      <p class="tagline">${g.players.map((p) => `${esc(p.name)} · ${p.timeline.length} cards`).join('&emsp;')}</p>
      <div class="rows">${timelineRow(0, { plain: true })}${timelineRow(1, { plain: true })}</div>
      <div class="actions center">
        <button class="btn primary big" data-action="rematch">Rematch</button>
        <button class="btn secondary big" data-action="quit">New setup</button>
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
    if (g.turn.phase === 'reveal') playCurrent();
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
  'steal-pick': (el) => setGame(G.pickSteal(ui.game, el.dataset.id)),
  'confirm-steal'() {
    S.unlockAudio();
    const next = G.confirmSteal(ui.game);
    if (next.winner != null) {
      ui.game = next;
      return actions['show-winner']();
    }
    setGame(next);
  },
  'decline-steal': () => {
    S.unlockAudio();
    setGame(G.declineSteal(ui.game));
  },
  named: () => setGame(G.toggleNamed(ui.game)),
  'replace-song': () => setGame(G.replaceSong(ui.game)),
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
  async connect(el) {
    readSetupForm();
    // The main button uses Hitline's built-in app; the "own app" button uses the pasted Client ID.
    if (el.dataset.custom) {
      const id = document.getElementById('client-id')?.value.trim();
      if (!id) {
        ui.spotify.error = 'Paste your Client ID first.';
        return render();
      }
      S.setClientId(id);
    }
    try {
      await S.login();
    } catch (err) {
      ui.spotify.error = err.message;
      render();
    }
  },
  disconnect() {
    S.logout();
    ui.spotify = { connected: false, profile: null, error: null };
    ui.music = { songId: null, status: 'off', error: null };
    render();
  },
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
  if (['name0', 'name1', 'target', 'tokens'].includes(e.target.id)) {
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
