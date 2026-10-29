// Pure game rules. State is a plain JSON object so it can be saved to localStorage and
// survive a page refresh mid-game.
//
// Rules (2-5 players or teams, house rules):
//  - Each player starts with one face-up card in their timeline and no tokens.
//  - Turns go around in order. On your turn a mystery song plays; place it in your timeline
//    where you think its year fits.
//  - Name the artist AND title to earn a token, whether or not the placement was right.
//  - At the start of a turn, before the song plays, you may trade 3 tokens to steal any one
//    card from any other player's timeline
//    who has at least 2 cards (a player's last card is safe).
//  - First to the target number of cards wins.

import { SONGS, SONGS_BY_ID, decadeBucket } from './songs.js?v=30';

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
export const MAX_PLAYERS = 5;
export const nextPlayer = (state) => (state.current + 1) % state.players.length;
// The player (other than the current one) who holds this card, or -1.
const ownerOf = (state, cardId) =>
  state.players.findIndex((p, i) => i !== state.current && p.timeline.includes(cardId));

export function deckFor(decades) {
  return SONGS.filter((s) => decades.includes(decadeBucket(s.year))).map((s) => s.id);
}

// `exclude` lists songs already heard (e.g. in the game before a rematch). If too few songs
// would be left, the whole pool is used again so the game can still be played.
export function newGame({ names, target, startTokens, decades, exclude = [] }) {
  const pool = deckFor(decades);
  // Enough for every player to reach the target, plus their starting cards.
  const minCards = target * names.length + names.length;
  if (pool.length < minCards) throw new Error(`Pick more decades: need at least ${minCards} songs, have ${pool.length}.`);
  const skip = new Set(exclude);
  const unheard = pool.filter((id) => !skip.has(id));
  const deck = shuffle(unheard.length >= minCards ? unheard : pool);
  const state = {
    version: 2,
    settings: { target, startTokens, decades },
    players: names.map((name) => ({ name, timeline: [deck.pop()], tokens: startTokens })),
    deck,
    current: Math.floor(Math.random() * names.length),
    turn: null,
    winner: null,
    turnNumber: 0,
  };
  return startTurn(state);
}

// A player down to their last card is safe: you can only steal from someone with 2 or more.
export const MIN_CARDS_TO_STEAL_FROM = 2;
export const stealableFrom = (p) => p.timeline.length >= MIN_CARDS_TO_STEAL_FROM;

export const canSteal = (state) =>
  state.players[state.current].tokens >= STEAL_COST &&
  state.players.some((p, i) => i !== state.current && stealableFrom(p));

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

// Used when the deck runs out: most cards wins, or 'tie' if several share the lead.
const leader = (state) => {
  const counts = state.players.map((p) => p.timeline.length);
  const best = Math.max(...counts);
  return counts.filter((c) => c === best).length > 1 ? 'tie' : counts.indexOf(best);
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
  const owner = ownerOf(state, cardId);
  if (turn?.phase !== 'steal' || owner === -1 || !stealableFrom(state.players[owner])) return state;
  return { ...state, turn: { ...turn, stealPick: turn.stealPick === cardId ? null : cardId } };
}

export function confirmSteal(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'steal' || turn.stealPick == null || !canSteal(state)) return state;
  const card = turn.stealPick;
  const owner = ownerOf(state, card);
  if (owner === -1 || !stealableFrom(state.players[owner])) return state;
  let next = updatePlayer(state, owner, (p) => ({ ...p, timeline: p.timeline.filter((id) => id !== card) }));
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
  const n = state.players.length;
  const order = Array.from({ length: n }, (_, k) => (state.current + k) % n);
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

// Every song in this game's pool that has been heard or dealt so far (including songs left out
// because an earlier game used them), so a rematch can avoid all of them.
export function usedSongs(state) {
  const remaining = new Set(state.deck);
  return deckFor(state.settings.decades).filter((id) => !remaining.has(id));
}

// Free skip: the current player gets a new mystery song on the same turn.
export function replaceSong(state) {
  if (state.turn?.phase !== 'listen') return state;
  return startTurn({ ...state, turnNumber: state.turnNumber - 1 }, { offerSteal: false });
}

export function nextTurn(state) {
  if (state.turn?.phase !== 'reveal' || state.winner != null) return state;
  return startTurn({ ...state, current: nextPlayer(state) });
}
