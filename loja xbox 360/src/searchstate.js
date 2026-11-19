const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;

const cache = new Map();

function prune() {
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (now - entry.at > TTL_MS) cache.delete(key);
    }
    while (cache.size >= MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
}

function create(state) {
    prune();
    const key = Math.random().toString(36).slice(2, 8);
    cache.set(key, { ...state, at: Date.now() });
    return key;
}

function get(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > TTL_MS) {
        cache.delete(key);
        return null;
    }
    entry.at = Date.now();
    return entry;
}

module.exports = { create, get };
