// Safe localStorage wrapper. Keys look like hub:<gameId>:<name>:v1.
// Everything is wrapped in try/catch: storage can be full, blocked or missing.

export function createStore(gameId) {
  const key = (name) => `hub:${gameId}:${name}:v1`;
  return {
    get(name, fallback = null) {
      try {
        const raw = localStorage.getItem(key(name));
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(name, value) {
      try {
        localStorage.setItem(key(name), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(name) {
      try {
        localStorage.removeItem(key(name));
      } catch {
        /* ignore */
      }
    },
  };
}

// The shared progress shape every game writes and the hub reads.
export function emptyProgress(gameId) {
  return { gameId, played: 0, won: 0, badges: [], lastPlayed: null };
}

export function readProgress(gameId) {
  const saved = createStore(gameId).get('progress');
  if (!saved || typeof saved !== 'object') return emptyProgress(gameId);
  return {
    gameId,
    played: Number(saved.played) || 0,
    won: Number(saved.won) || 0,
    badges: Array.isArray(saved.badges) ? saved.badges.filter((b) => typeof b === 'string') : [],
    lastPlayed: typeof saved.lastPlayed === 'string' ? saved.lastPlayed : null,
  };
}

export function writeProgress(progress) {
  return createStore(progress.gameId).set('progress', progress);
}

export function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
