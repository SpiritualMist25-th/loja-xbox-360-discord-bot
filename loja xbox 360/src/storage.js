const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const config = require('./config');
const logger = require('./logger');

const LOCAL_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const FILES = {
    games: path.join(LOCAL_DIR, 'games.json'),
    favorites: path.join(LOCAL_DIR, 'favorites.json'),
    suggestions: path.join(LOCAL_DIR, 'suggestions.json'),
    counters: path.join(LOCAL_DIR, 'counters.json'),
};

const state = {
    games: [],
    favorites: [],
    suggestions: [],
    counters: {},
    useMongo: false,
};

const collections = {
    games: null,
    favorites: null,
    suggestions: null,
    counters: null,
};

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeGame(g) {
    if (!g.id) g.id = generateId();
    if (g.subcategory === undefined) g.subcategory = null;
    g.nameLower = (g.name || '').trim().toLowerCase();
    return g;
}

function loadLocal(key, fallback) {
    try {
        if (fs.existsSync(FILES[key])) {
            return JSON.parse(fs.readFileSync(FILES[key], 'utf8'));
        }
    } catch (err) {
        logger.error(`Erro ao ler ${path.basename(FILES[key])}:`, err.message);
    }
    return fallback;
}

function saveLocal(key) {
    if (state.useMongo) return;
    if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(FILES[key], JSON.stringify(state[key], null, 2));
}

function dedupeGames(list) {
    const seen = new Map();
    const result = [];
    for (const g of list) {
        const key = `${(g.name || '').trim().toLowerCase()}|${g.category || ''}|${g.subcategory || ''}`;
        if (seen.has(key)) continue;
        seen.set(key, true);
        result.push(g);
    }
    return result;
}

async function initStorage() {
    if (!config.mongoUri) {
        logger.warn('MONGODB_URI não definida — usando arquivos locais. Isso NÃO é persistente no Render Free!');
        state.games = dedupeGames(loadLocal('games', []).map(normalizeGame));
        state.favorites = loadLocal('favorites', []);
        state.suggestions = loadLocal('suggestions', []);
        state.counters = loadLocal('counters', {});
        return;
    }

    try {
        const mongoClient = new MongoClient(config.mongoUri);
        await mongoClient.connect();
        const db = mongoClient.db(config.mongoDb);
        collections.games = db.collection('games');
        collections.favorites = db.collection('favorites');
        collections.suggestions = db.collection('suggestions');
        collections.counters = db.collection('counters');
        state.useMongo = true;

        const rawGames = await collections.games.find({}, { projection: { _id: 0 } }).toArray();
        const missingNameLowerIds = rawGames
            .filter(g => typeof g.nameLower !== 'string')
            .map(g => g.id)
            .filter(Boolean);
        state.games = rawGames.map(normalizeGame);

        if (state.games.length === 0 && fs.existsSync(FILES.games)) {
            const seed = loadLocal('games', []).map(normalizeGame);
            if (seed.length > 0) {
                await collections.games.insertMany(seed.map(g => ({ ...g })));
                state.games = seed;
                logger.info(`Migrados ${seed.length} jogos do games.json local para o MongoDB.`);
            }
        }

        const deduped = dedupeGames(state.games);
        const keptIds = new Set(deduped.map(g => g.id));
        const removedIds = state.games.map(g => g.id).filter(id => !keptIds.has(id));
        state.games = deduped;
        state.games.forEach(g => {
            g.nameLower = (g.name || '').trim().toLowerCase();
        });

        if (removedIds.length > 0) {
            logger.warn(`Removidas ${removedIds.length} entradas duplicadas.`);
            await collections.games.deleteMany({ id: { $in: removedIds } });
        }
        for (const id of missingNameLowerIds) {
            const g = state.games.find(x => x.id === id);
            if (!g) continue;
            await collections.games.updateOne(
                { id },
                { $set: { nameLower: (g.name || '').trim().toLowerCase() } }
            );
        }

        try {
            await collections.games.createIndex(
                { nameLower: 1, category: 1, subcategory: 1 },
                { unique: true, name: 'games_unique', partialFilterExpression: { nameLower: { $type: 'string' } } }
            );
            await collections.favorites.createIndex(
                { userId: 1, gameId: 1 },
                { unique: true, name: 'favorites_unique' }
            );
            await collections.counters.createIndex({ key: 1 }, { unique: true, name: 'counters_key' });
            await collections.suggestions.createIndex({ id: 1 }, { unique: true, name: 'suggestions_id' });
        } catch (err) {
            logger.error('Erro ao criar índices únicos:', err.message);
        }

        state.favorites = await collections.favorites.find({}, { projection: { _id: 0 } }).toArray();
        state.suggestions = await collections.suggestions.find({}, { projection: { _id: 0 } }).toArray();
        state.counters = {};
        const counterDocs = await collections.counters.find({}, { projection: { _id: 0 } }).toArray();
        for (const c of counterDocs) state.counters[c.key] = c.count;

        logger.info(`Conectado ao MongoDB. ${state.games.length} jogos, ${state.favorites.length} favoritos, ${state.suggestions.length} sugestões.`);
    } catch (err) {
        logger.error('Erro ao conectar no MongoDB, caindo para arquivos locais (NÃO persistente no Render Free):', err);
        state.useMongo = false;
        state.games = dedupeGames(loadLocal('games', []).map(normalizeGame));
        state.favorites = loadLocal('favorites', []);
        state.suggestions = loadLocal('suggestions', []);
        state.counters = loadLocal('counters', {});
    }
}

function getGames() {
    return state.games;
}

async function addGameRecord(game) {
    normalizeGame(game);
    game.nameLower = (game.name || '').trim().toLowerCase();
    const duplicate = state.games.find(g =>
        g.nameLower === game.nameLower &&
        g.category === game.category &&
        (g.subcategory || null) === (game.subcategory || null)
    );
    if (duplicate) return { ok: false, duplicate };

    state.games.push(game);
    if (state.useMongo) {
        await collections.games.insertOne({ ...game });
    } else {
        saveLocal('games');
    }
    return { ok: true, game };
}

async function removeGameRecord(id) {
    const removed = state.games.find(g => g.id === id) || null;
    state.games = state.games.filter(g => g.id !== id);
    if (state.useMongo) {
        await collections.games.deleteOne({ id });
        await collections.favorites.deleteMany({ gameId: id });
    } else {
        saveLocal('games');
    }
    state.favorites = state.favorites.filter(f => f.gameId !== id);
    if (!state.useMongo) saveLocal('favorites');
    return removed;
}

// Metadados (descrição/imagem) são por NOME do jogo: valem para todas as versões.
function getMeta(name) {
    const key = (name || '').trim().toLowerCase();
    const g = state.games.find(x => x.nameLower === key && (x.description || x.image));
    if (!g) return null;
    return {
        description: g.description || null,
        image: g.image || null,
        genres: g.genres || null,
        released: g.released || null,
        metaSource: g.metaSource || null,
        metaAI: g.metaAI === true,
        metaAt: g.metaAt || null,
    };
}

async function updateGameMeta(name, patch) {
    const key = (name || '').trim().toLowerCase();
    const clean = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    let changed = 0;
    for (const g of state.games) {
        if (g.nameLower === key) { Object.assign(g, clean); changed++; }
    }
    if (changed === 0) return 0;
    if (state.useMongo) {
        await collections.games.updateMany({ nameLower: key }, { $set: clean });
    } else {
        saveLocal('games');
    }
    return changed;
}

function findGame(id) {
    return state.games.find(g => g.id === id) || null;
}

function searchGames(term, filters = {}) {
    const tokens = (term || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter(Boolean);

    let list = state.games;
    if (filters.category && filters.category !== 'todos') {
        list = list.filter(g => g.category === filters.category);
    }
    if (filters.subcategory) {
        list = list.filter(g => (g.subcategory || null) === filters.subcategory);
    }

    if (tokens.length === 0) return list;

    return list.filter(g => {
        const haystack = (g.name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        return tokens.every(t => haystack.includes(t));
    });
}

function uniqueNames(gamesList) {
    return [...new Set(gamesList.map(g => g.name))];
}

function autocompleteNames(prefix, limit = 25) {
    const needle = (prefix || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const names = uniqueNames(state.games)
        .filter(n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(needle))
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    return names.slice(0, limit);
}

function getFavorites(userId) {
    return state.favorites.filter(f => f.userId === userId);
}

async function addFavorite(userId, game) {
    const existing = state.favorites.find(f => f.userId === userId && f.gameId === game.id);
    if (existing) return { ok: false, reason: 'exists' };
    if (getFavorites(userId).length >= 25) return { ok: false, reason: 'limit' };

    const fav = {
        userId,
        gameId: game.id,
        name: game.name,
        category: game.category,
        subcategory: game.subcategory || null,
        addedAt: new Date().toISOString(),
    };
    state.favorites.push(fav);
    if (state.useMongo) {
        await collections.favorites.insertOne({ ...fav });
    } else {
        saveLocal('favorites');
    }
    return { ok: true };
}

async function removeFavorite(userId, gameId) {
    const before = state.favorites.length;
    state.favorites = state.favorites.filter(f => !(f.userId === userId && f.gameId === gameId));
    if (state.favorites.length === before) return false;
    if (state.useMongo) {
        await collections.favorites.deleteOne({ userId, gameId });
    } else {
        saveLocal('favorites');
    }
    return true;
}

function isFavorite(userId, gameId) {
    return state.favorites.some(f => f.userId === userId && f.gameId === gameId);
}

function favoriteCount(gameId) {
    return state.favorites.filter(f => f.gameId === gameId).length;
}

function getSuggestions(status = null) {
    if (!status) return state.suggestions;
    return state.suggestions.filter(s => s.status === status);
}

function findSuggestion(id) {
    return state.suggestions.find(s => s.id === id) || null;
}

async function createSuggestion(data) {
    const sug = {
        id: generateId(),
        name: data.name,
        link: data.link,
        category: data.category,
        subcategory: data.subcategory || null,
        suggestedBy: data.suggestedBy,
        suggestedById: data.suggestedById,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    state.suggestions.push(sug);
    if (state.useMongo) {
        await collections.suggestions.insertOne({ ...sug });
    } else {
        saveLocal('suggestions');
    }
    return sug;
}

async function updateSuggestion(id, patch) {
    const sug = findSuggestion(id);
    if (!sug) return null;
    Object.assign(sug, patch);
    if (state.useMongo) {
        await collections.suggestions.updateOne({ id }, { $set: patch });
    } else {
        saveLocal('suggestions');
    }
    return sug;
}

async function incrementCounter(key, by = 1) {
    state.counters[key] = (state.counters[key] || 0) + by;
    if (state.useMongo) {
        await collections.counters.updateOne(
            { key },
            { $inc: { count: by } },
            { upsert: true }
        );
    } else {
        saveLocal('counters');
    }
    return state.counters[key];
}

function getCounter(key) {
    return state.counters[key] || 0;
}

function topCounters(prefix, limit = 10) {
    return Object.entries(state.counters)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, count]) => ({ key: key.slice(prefix.length), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function stats() {
    const byCategory = {};
    const bySubcategory = {};
    for (const g of state.games) {
        const cat = g.category || '???';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        const sub = g.subcategory || null;
        const subKey = sub || 'sem subcategoria';
        bySubcategory[subKey] = (bySubcategory[subKey] || 0) + 1;
    }
    return {
        total: state.games.length,
        byCategory,
        bySubcategory,
        favorites: state.favorites.length,
        suggestionsPending: state.suggestions.filter(s => s.status === 'pending').length,
        searches: getCounter('searches'),
        views: getCounter('views'),
    };
}

module.exports = {
    initStorage,
    generateId,
    getGames,
    findGame,
    getMeta,
    updateGameMeta,
    addGameRecord,
    removeGameRecord,
    searchGames,
    uniqueNames,
    autocompleteNames,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    favoriteCount,
    getSuggestions,
    findSuggestion,
    createSuggestion,
    updateSuggestion,
    incrementCounter,
    getCounter,
    topCounters,
    stats,
    get usingMongo() { return state.useMongo; },
};
