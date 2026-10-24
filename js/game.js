// Pure game rules. State is a plain JSON object so it can be saved to localStorage and
// survive a page refresh mid-game.
//
// Rules (Hitster, 2 players):
//  - Each player starts with one face-up card in their timeline.
//  - On your turn a mystery song plays. Place it in your timeline where you think its year fits.
//  - The opponent may spend a token to challenge by picking a different spot. If you were
//    wrong and they were right, they steal the card into their own timeline.
//  - Name the artist AND title before the reveal to earn a token (max 5).
//  - Spend 1 token to skip a song, or 3 tokens to take the card for free.
//  - First to the target number of cards wins.

import { SONGS, SONGS_BY_ID, decadeBucket } from './songs.js';

export const MAX_TOKENS = 5;
export const SKIP_COST = 1;
export const BUY_COST = 3;

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
    version: 1,
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

function startTurn(state) {
  if (!state.deck.length) return { ...state, turn: null, winner: leader(state) };
  const deck = [...state.deck];
  const songId = deck.pop();
  return {
    ...state,
    deck,
    turnNumber: state.turnNumber + 1,
    turn: { songId, phase: 'listen', place: null, challenge: null, result: null, named: false },
  };
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
  const { turn } = state;
  if (turn?.phase !== 'listen' || turn.place == null) return state;
  const canChallenge = state.players[opponentOf(state)].tokens > 0;
  const next = { ...state, turn: { ...turn, phase: canChallenge ? 'challenge' : 'reveal' } };
  return canChallenge ? next : reveal(next);
}

export function chooseChallenge(state, i) {
  const { turn } = state;
  if (turn?.phase !== 'challenge' || i === turn.place) return state;
  return { ...state, turn: { ...turn, challenge: turn.challenge === i ? null : i } };
}

export function confirmChallenge(state) {
  const { turn } = state;
  if (turn?.phase !== 'challenge' || turn.challenge == null) return state;
  const paid = updatePlayer(state, opponentOf(state), (p) => ({ ...p, tokens: p.tokens - 1 }));
  return reveal(paid);
}

export function declineChallenge(state) {
  if (state.turn?.phase !== 'challenge') return state;
  return reveal({ ...state, turn: { ...state.turn, challenge: null } });
}

function reveal(state) {
  const { turn, current } = state;
  const opp = opponentOf(state);
  const year = yearOf(turn.songId);
  const timeline = state.players[current].timeline;
  const correct = fits(timeline, turn.place, year);
  const challengeCorrect = turn.challenge != null && fits(timeline, turn.challenge, year);

  let next = state;
  let outcome;
  if (correct) {
    next = updatePlayer(next, current, (p) => {
      const tl = [...p.timeline];
      tl.splice(turn.place, 0, turn.songId);
      return { ...p, timeline: tl };
    });
    outcome = turn.challenge != null ? 'correct-challenge-failed' : 'correct';
  } else if (challengeCorrect) {
    next = updatePlayer(next, opp, (p) => ({ ...p, timeline: insertSorted(p.timeline, turn.songId) }));
    outcome = 'stolen';
  } else {
    outcome = 'wrong';
  }
  return checkWinner({ ...next, turn: { ...turn, phase: 'reveal', result: outcome } });
}

function checkWinner(state) {
  const { target } = state.settings;
  // The active player wins ties on reaching the target, since they earned it on their turn.
  const order = [state.current, opponentOf(state)];
  const winner = order.find((i) => state.players[i].timeline.length >= target);
  return winner == null ? state : { ...state, winner };
}

export function toggleNamed(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'reveal') return state;
  const named = !turn.named;
  const delta = named ? 1 : -1;
  const player = state.players[current];
  if (named && player.tokens >= MAX_TOKENS) return state;
  const next = updatePlayer(state, current, (p) => ({ ...p, tokens: p.tokens + delta }));
  return { ...next, turn: { ...turn, named } };
}

export function skipSong(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'listen' || state.players[current].tokens < SKIP_COST) return state;
  const paid = updatePlayer(state, current, (p) => ({ ...p, tokens: p.tokens - SKIP_COST }));
  return startTurn({ ...paid, turnNumber: paid.turnNumber - 1 });
}

// Free swap for when a song can't be played (e.g. not available on Spotify).
export function replaceSong(state) {
  if (state.turn?.phase !== 'listen') return state;
  return startTurn({ ...state, turnNumber: state.turnNumber - 1 });
}

export function buyCard(state) {
  const { turn, current } = state;
  if (turn?.phase !== 'listen' || state.players[current].tokens < BUY_COST) return state;
  const next = updatePlayer(state, current, (p) => ({
    ...p,
    tokens: p.tokens - BUY_COST,
    timeline: insertSorted(p.timeline, turn.songId),
  }));
  return checkWinner({ ...next, turn: { ...turn, phase: 'reveal', result: 'bought', place: null, challenge: null } });
}

export function nextTurn(state) {
  if (state.turn?.phase !== 'reveal' || state.winner != null) return state;
  return startTurn({ ...state, current: opponentOf(state) });
}
