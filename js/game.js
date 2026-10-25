// Pure game rules. State is a plain JSON object so it can be saved to localStorage and
// survive a page refresh mid-game.
//
// Rules (2 players, house rules):
//  - Each player starts with one face-up card in their timeline and no tokens.
//  - On your turn a mystery song plays. Place it in your timeline where you think its year fits.
//  - Name the artist AND title to earn a token, whether or not the placement was right.
//  - At the start of a turn, before the song plays, you may trade 3 tokens to steal any one
//    card from your opponent's timeline.
//  - First to the target number of cards wins.

import { SONGS, SONGS_BY_ID, decadeBucket } from './songs.js?v=18';

export const STEAL_COST = 3;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const song = (id) => SONGS_BY_ID[id];
export const yearOf = (id) => SONGS_BY_ID[id].year;
export const opponentOf = (state) => 1 - state.current;

export function deckFor(decades) {
  return SONGS.filter((s) => decades.includes(decadeBucket(s.year))).map((s) => s.id);
}

export function newGame({ names, target, startTokens, decades }) {
  const deck = shuffle(deckFor(decades));
  const minCards = target * 2 + 2;
  if (deck.length < minCards) throw new Error(`Pick more decades: need at least ${minCards} songs, have ${deck.length}.`);
  const state = {
    version: 2,
    settings: { target, startTokens, decades },
    players: names.map((name) => ({ name, timeline: [deck.pop()], tokens: startTokens })),
    deck,
    current: Math.floor(Math.random() * 2),
    turn: null,
    winner: null,
    turnNumber: 0,
  };
  return startTurn(state);
}

export const canSteal = (state) =>
  state.players[state.current].tokens >= STEAL_COST && state.players[opponentOf(state)].timeline.length > 0;

// A turn opens with the steal offer (only if affordable), then the song plays in 'listen'.
function startTurn(state, { offerSteal = true } = {}) {
  if (!state.deck.length) return { ...state, turn: null, winner: leader(state) };
  const deck = [...state.deck];
  const songId = deck.pop();
  const next = {
    ...state,
    deck,
    turnNumber: state.turnNumber + 1,
    turn: { songId, phase: 'listen', place: null, stealPick: null, result: null, named: false },
  };
  return offerSteal && canSteal(next) ? { ...next, turn: { ...next.turn, phase: 'steal' } } : next;
}

// Index i means "insert before timeline[i]"; i === timeline.length means at the end.
export function fits(timeline, i, year) {
  const before = i > 0 ? yearOf(timeline[i - 1]) : -Infinity;
  const after = i < timeline.length ? yearOf(timeline[i]) : Infinity;
  return before <= year && year <= after;
}

const insertSorted = (timeline, id) => {
  const year = yearOf(id);
  const i = timeline.findIndex((t) => yearOf(t) > year);
  const next = [...timeline];
  next.splice(i === -1 ? next.length : i, 0, id);
  return next;
};

const updatePlayer = (state, idx, fn) => ({
  ...state,
  players: state.players.map((p, i) => (i === idx ? fn(p) : p)),
});

const leader = (state) => {
  const [a, b] = state.players.map((p) => p.timeline.length);
  return a === b ? 'tie' : a > b ? 0 : 1;
};

export function choosePlacement(state, i) {
  if (state.turn?.phase !== 'listen') return state;
  return { ...state, turn: { ...state.turn, place: i } };
}

export function lockPlacement(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'listen' || turn.place == null) return state;
  const correct = fits(state.players[current].timeline, turn.place, yearOf(turn.songId));
  const next = correct
    ? updatePlayer(state, current, (p) => {
        const tl = [...p.timeline];
        tl.splice(turn.place, 0, turn.songId);
        return { ...p, timeline: tl };
      })
    : state;
  return checkWinner({ ...next, turn: { ...turn, phase: 'reveal', result: correct ? 'correct' : 'wrong' } });
}

export function pickSteal(state, cardId) {
  const { turn } = state;
  if (turn?.phase !== 'steal' || !state.players[opponentOf(state)].timeline.includes(cardId)) return state;
  return { ...state, turn: { ...turn, stealPick: turn.stealPick === cardId ? null : cardId } };
}

export function confirmSteal(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'steal' || turn.stealPick == null || !canSteal(state)) return state;
  const card = turn.stealPick;
  let next = updatePlayer(state, opponentOf(state), (p) => ({ ...p, timeline: p.timeline.filter((id) => id !== card) }));
  next = updatePlayer(next, current, (p) => ({
    ...p,
    tokens: p.tokens - STEAL_COST,
    timeline: insertSorted(p.timeline, card),
  }));
  return checkWinner({ ...next, turn: { ...turn, phase: 'listen', stolen: card } });
}

export function declineSteal(state) {
  if (state.turn?.phase !== 'steal') return state;
  return { ...state, turn: { ...state.turn, phase: 'listen', stealPick: null } };
}

function checkWinner(state) {
  const { target } = state.settings;
  // The active player wins ties on reaching the target, since they earned it on their turn.
  const order = [state.current, opponentOf(state)];
  const winner = order.find((i) => state.players[i].timeline.length >= target);
  return winner == null ? state : { ...state, winner };
}

// Naming artist + title earns a token regardless of whether the placement was right.
export function toggleNamed(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'reveal') return state;
  const named = !turn.named;
  const next = updatePlayer(state, current, (p) => ({ ...p, tokens: p.tokens + (named ? 1 : -1) }));
  return { ...next, turn: { ...turn, named } };
}

// Free swap for when a song can't be played (e.g. not available on Spotify).
export function replaceSong(state) {
  if (state.turn?.phase !== 'listen') return state;
  return startTurn({ ...state, turnNumber: state.turnNumber - 1 }, { offerSteal: false });
}

export function nextTurn(state) {
  if (state.turn?.phase !== 'reveal' || state.winner != null) return state;
  return startTurn({ ...state, current: opponentOf(state) });
}
