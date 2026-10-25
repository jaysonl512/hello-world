// Spotify integration: PKCE login (no backend needed), track lookup, and playback either
// through the Web Playback SDK (audio comes out of this browser tab, so casting the tab
// sends it to the TV) or through any Spotify Connect device (e.g. the Spotify app on the TV).

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

const LS = {
  clientId: 'hitster.spotify.clientId',
  tokens: 'hitster.spotify.tokens',
  verifier: 'hitster.spotify.verifier',
  trackCache: 'hitster.spotify.trackCache.v2',
  device: 'hitster.spotify.device',
};

// The default device choice: this browser tab on desktop, or this phone's Spotify app on phones.
export const SDK_DEVICE = 'sdk';

// Spotify's Web Playback SDK only supports desktop browsers.
export const browserPlaybackSupported = !(
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

export const usingSdk = () => browserPlaybackSupported && getDevicePreference() === SDK_DEVICE;

const NO_DEVICE =
  'No Spotify device found. Open the Spotify app (on this phone or your TV), play any song for a second, then tap ▶ Play.';
const NO_PHONE =
  "Spotify on this phone isn't awake. Tap Open Spotify, play any song for a second, come back and tap ▶ Play.";

export const redirectUri = () => location.origin + location.pathname;

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode); everything still works for this page load
  }
};

// Public PKCE client ID for this deployment (not a secret). Can be overridden from the setup screen.
const DEFAULT_CLIENT_ID = '82a4a1f24fe24be3a70727dfd42fb01a';

export const getClientId = () => load(LS.clientId, '') || DEFAULT_CLIENT_ID;
export const setClientId = (id) => save(LS.clientId, id.trim());
export const getDevicePreference = () => load(LS.device, SDK_DEVICE);
export const setDevicePreference = (id) => save(LS.device, id);
export const isLoggedIn = () => !!load(LS.tokens, null);

export function logout() {
  save(LS.tokens, null);
  sdk.player?.disconnect();
  sdk.player = null;
  sdk.deviceId = null;
  sdk.ready = null;
}

// ---------- PKCE auth ----------

const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export async function login() {
  const clientId = getClientId();
  if (!clientId) throw new Error('Enter your Spotify Client ID first.');
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  save(LS.verifier, verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  location.assign(`${AUTH_URL}?${params}`);
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: getClientId(), ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `Token request failed (${res.status})`);
  const prev = load(LS.tokens, {});
  const tokens = {
    access: json.access_token,
    refresh: json.refresh_token || prev.refresh,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  save(LS.tokens, tokens);
  return tokens;
}

// Call once on page load: finishes the login if Spotify just redirected back to us.
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return null;
  history.replaceState(null, '', redirectUri());
  if (error) throw new Error(`Spotify login failed: ${error}`);
  const verifier = load(LS.verifier, null);
  save(LS.verifier, null);
  if (!verifier) throw new Error('Spotify login expired, please try again.');
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier });
}

let refreshing = null;
async function accessToken() {
  const tokens = load(LS.tokens, null);
  if (!tokens) throw new Error('Not connected to Spotify.');
  if (Date.now() < tokens.expiresAt) return tokens.access;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh })
    .catch((err) => {
      save(LS.tokens, null);
      throw err;
    })
    .finally(() => (refreshing = null));
  return (await refreshing).access;
}

async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(API + path);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Spotify API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export const getProfile = () => api('/me');
export const getDevices = async () => (await api('/me/player/devices'))?.devices ?? [];

// ---------- Track lookup ----------

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const UNWANTED = /\b(live|karaoke|instrumental|remix|cover|tribute|acoustic|demo|sped up|slowed|8d)\b/i;

function scoreTrack(track, song) {
  const want = normalize(song.title);
  const got = normalize(track.name.split(' - ')[0]);
  let score = 0;
  if (got === want) score += 10;
  else if (got.includes(want) || want.includes(got)) score += 5;
  const artists = track.artists.map((a) => normalize(a.name));
  const wantArtist = normalize(song.artist);
  if (artists.some((a) => a === wantArtist)) score += 6;
  else if (artists.some((a) => a.includes(wantArtist) || wantArtist.includes(a))) score += 3;
  if (UNWANTED.test(track.name) && !UNWANTED.test(song.title)) score -= 8;
  if (UNWANTED.test(track.album?.name ?? '')) score -= 3;
  return score;
}

const trackCache = load(LS.trackCache, {});

export async function findTrack(song) {
  if (trackCache[song.id]) return trackCache[song.id];
  const clean = (s) => s.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim();
  const queries = [`track:${clean(song.title)} artist:${clean(song.artist)}`, `${clean(song.title)} ${clean(song.artist)}`];
  let best = null;
  for (const q of queries) {
    // market=from_token limits results to versions playable in the user's country.
    const res = await api('/search', { query: { q, type: 'track', limit: 10, market: 'from_token' } });
    const items = res?.tracks?.items ?? [];
    for (const [i, track] of items.entries()) {
      if (track.is_playable === false) continue;
      // Earlier results get a small boost: Spotify's own relevance ranking is usually right.
      const score = scoreTrack(track, song) - i * 0.2;
      if (!best || score > best.score) best = { score, uri: track.uri };
    }
    if (best && best.score >= 14) break;
  }
  if (!best || best.score < 5) {
    const err = new Error(`Couldn't find "${song.title}" by ${song.artist} on Spotify.`);
    err.notFound = true;
    throw err;
  }
  trackCache[song.id] = best.uri;
  save(LS.trackCache, trackCache);
  return best.uri;
}

// ---------- Web Playback SDK ----------

const sdk = { player: null, deviceId: null, ready: null };

function loadSdkScript() {
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = () => reject(new Error('Could not load the Spotify player.'));
    document.head.appendChild(s);
  });
}

export function initPlayer({ onState, onError } = {}) {
  sdk.ready ??= (async () => {
    await loadSdkScript();
    const player = new window.Spotify.Player({
      name: 'Hitster TV',
      getOAuthToken: (cb) => accessToken().then(cb, (err) => onError?.(err)),
      volume: 0.8,
    });
    sdk.player = player;
    player.addListener('player_state_changed', (state) => onState?.(state));
    for (const evt of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
      player.addListener(evt, ({ message }) =>
        onError?.(new Error(evt === 'account_error' ? 'Spotify Premium is required for in-browser playback.' : message)),
      );
    }
    const deviceId = await new Promise((resolve, reject) => {
      player.addListener('ready', ({ device_id }) => resolve(device_id));
      player.addListener('not_ready', () => (sdk.deviceId = null));
      player.connect().then((ok) => ok || reject(new Error('Spotify player failed to connect.')));
    });
    sdk.deviceId = deviceId;
    return deviceId;
  })().catch((err) => {
    sdk.ready = null;
    throw err;
  });
  return sdk.ready;
}

// Browsers block audio until a user gesture; call this from a click handler.
export function unlockAudio() {
  sdk.player?.activateElement?.();
}

// Resolves the device to play on: the chosen device if Spotify lists it, otherwise the default
// (this browser on desktop, this phone's Spotify app on phones). Never silently switches to
// some other device like a TV.
async function targetDevice() {
  if (usingSdk()) return { id: await initPlayer(), name: 'this browser' };
  const pref = getDevicePreference();
  const devices = (await getDevices()).filter((d) => !d.is_restricted && d.name !== 'Hitster TV');
  const chosen = pref !== SDK_DEVICE && devices.find((d) => d.id === pref);
  if (chosen) return chosen;
  if (browserPlaybackSupported) return { id: await initPlayer(), name: 'this browser' };
  const phones = devices.filter((d) => d.type === 'Smartphone');
  const phone = phones.find((d) => d.is_active) ?? phones[0];
  if (phone) return phone;
  throw new Error(NO_PHONE);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendPlay(deviceId, uri) {
  try {
    await api('/me/player/play', { method: 'PUT', query: { device_id: deviceId }, body: { uris: [uri], position_ms: 0 } });
  } catch (err) {
    if (err.status !== 404) throw err;
    // Device went idle; wake it with a transfer, then retry.
    await api('/me/player', { method: 'PUT', body: { device_ids: [deviceId], play: false } }).catch((e) => {
      throw e.status === 404 ? new Error(NO_DEVICE) : e;
    });
    await api('/me/player/play', { method: 'PUT', query: { device_id: deviceId }, body: { uris: [uri], position_ms: 0 } });
  }
}

// Spotify can accept a play command and then not play (e.g. the app was asleep), so for
// Spotify Connect devices confirm the song actually started, retrying once.
const playerState = () => api('/me/player', { query: { market: 'from_token' } }).catch(() => null);
const isOurSong = (state, uri) => state?.item?.uri === uri || state?.item?.linked_from?.uri === uri;

async function isPlaying(uri, deviceId) {
  const state = await playerState();
  return !!state?.is_playing && state.device?.id === deviceId && isOurSong(state, uri);
}

async function waitForPlaying(uri, deviceId, seconds) {
  for (let i = 0; i < seconds; i++) {
    await sleep(1000);
    if (await isPlaying(uri, deviceId)) return true;
  }
  return false;
}

// Short description of what Spotify reports, without revealing the song title.
async function describePlayer(uri) {
  const state = await playerState();
  if (!state?.device) return 'Spotify reports no active device.';
  const what = state.item ? (isOurSong(state, uri) ? 'this song' : 'a different song') : 'nothing';
  return `Spotify reports: ${state.is_playing ? 'playing' : 'paused'} on ${state.device.name}, ${what} loaded.`;
}

// Returns the name of the device the song is playing on. Sends a single play command and then
// only watches: re-sending commands while a phone is still buffering interrupts it, so the
// player is never nudged again here (the ▶ Play button is the manual retry).
export async function playTrack(uri) {
  const { id: deviceId, name } = await targetDevice();
  await sendPlay(deviceId, uri);
  if (usingSdk() && deviceId === sdk.deviceId) return name;
  if (await waitForPlaying(uri, deviceId, 12)) return name;
  const err = new Error(
    `Spotify on ${name} didn't start the song. ${await describePlayer(uri)} Tap ▶ Play to try again, or Swap song.`,
  );
  err.notFound = true; // the track itself may be the problem, so offer a free swap
  throw err;
}

export async function pause() {
  if (usingSdk() && sdk.player) return sdk.player.pause();
  await api('/me/player/pause', { method: 'PUT' }).catch(() => {});
}

export async function resume() {
  if (usingSdk() && sdk.player) return sdk.player.resume();
  await api('/me/player/play', { method: 'PUT' });
}
