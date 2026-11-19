process.env.DATA_DIR = require('node:os').tmpdir() + '/bot-catalogo-tests-gameinfo';
delete process.env.RAWG_API_KEY;
process.env.AI_API_KEY = 'test-key';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const config = require('../src/config');
config.aiRpm = 1000000; // sem espera entre chamadas nos testes
const storage = require('../src/storage');
const gameinfo = require('../src/gameinfo');
const { buildGameInfoEmbed, buildVersionButtons } = require('../src/embeds');

function seed() {
    const g = storage.getGames();
    g.length = 0;
    g.push(
        { id: '1', name: 'Halo 3', category: 'xex', subcategory: null, nameLower: 'halo 3' },
        { id: '2', name: 'Halo 3', category: 'ports', subcategory: null, nameLower: 'halo 3' },
        { id: '3', name: 'Forza Horizon', category: 'god', subcategory: null, nameLower: 'forza horizon' },
    );
}

let calls;
function mockFetch(handler) {
    calls = [];
    global.fetch = async (url, opts) => {
        calls.push(String(url));
        const body = await handler(String(url), opts);
        if (body === null) return { ok: false, status: 404, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => body };
    };
}

const wikiPt = (title, extra = {}) => ({
    query: { pages: { 1: { index: 1, title, extract: 'Jogo de tiro em primeira pessoa da Bungie.', thumbnail: { source: 'https://img.test/halo3.jpg' }, ...extra } } },
});
const claude = (text) => ({ choices: [{ message: { content: text } }] });

beforeEach(() => seed());

test('categoria ports existe nas escolhas, com rótulo e cor próprios', () => {
    assert.ok(config.CATEGORY_CHOICES.some(c => c.value === 'ports'));
    assert.ok(config.LIST_CATEGORY_CHOICES.some(c => c.value === 'ports'));
    assert.equal(config.categoryLabel('ports'), 'PORTS XBOX');
    assert.equal(config.categoryLabel('xex'), 'XEX');
    assert.notEqual(config.categoryColor('ports'), config.categoryColor('xex'));
});

test('searchGames filtra pela categoria ports', () => {
    assert.equal(storage.searchGames('halo', { category: 'ports' }).length, 1);
});

test('botões de versão aceitam a categoria ports', () => {
    const rows = buildVersionButtons(storage.getGames().filter(g => g.name === 'Halo 3'));
    assert.equal(rows[0].components.length, 2);
});

test('cleanName remove rótulos que não fazem parte do nome', () => {
    assert.equal(gameinfo.cleanName('Halo 3 (XEX) - Disco 1'), 'Halo 3');
    assert.equal(gameinfo.cleanName('Forza Horizon [GOD]'), 'Forza Horizon');
});

test('titleMatches exige todas as palavras da busca', () => {
    assert.ok(gameinfo.titleMatches('Halo 3', 'Halo 3: ODST'));
    assert.ok(!gameinfo.titleMatches('Halo 3', 'Halo Wars'));
});

test('enrichGame: busca fonte, usa a IA e grava em todas as versões do nome', async () => {
    mockFetch((url) => {
        if (url.includes('store.steampowered.com/api/storesearch')) return { items: [] };
        if (url.includes('pt.wikipedia.org')) return wikiPt('Halo 3');
        if (url.includes('/chat/completions')) return claude('Master Chief encerra a guerra contra o Covenant.');
        return null;
    });
    const r = await gameinfo.enrichGame(storage.getGames()[0]);
    assert.equal(r.ok, true);
    const [a, b, c] = storage.getGames();
    assert.equal(a.description, 'Master Chief encerra a guerra contra o Covenant.');
    assert.equal(b.description, a.description, 'versão ports recebe a mesma descrição');
    assert.equal(a.image, 'https://img.test/halo3.jpg');
    assert.equal(c.description, undefined, 'outro jogo não é afetado');
    assert.ok(calls.some(u => u.includes('/chat/completions')));
});

test('enrichGame reaproveita dados de outra versão sem chamar APIs', async () => {
    storage.getGames()[0].description = 'Já existe';
    storage.getGames()[0].image = 'https://img.test/x.jpg';
    mockFetch(() => { throw new Error('não deveria chamar rede'); });
    const r = await gameinfo.enrichGame(storage.getGames()[1]);
    assert.equal(r.ok, true);
    assert.equal(storage.getGames()[1].description, 'Já existe');
    assert.equal(calls.length, 0);
});

test('sem ANTHROPIC_API_KEY usa o texto da fonte como descrição', async () => {
    const saved = config.aiKey;
    config.aiKey = undefined;
    mockFetch((url) => {
        if (url.includes('storesearch')) return { items: [] };
        if (url.includes('pt.wikipedia.org')) return wikiPt('Halo 3');
        return null;
    });
    const r = await gameinfo.enrichGame(storage.getGames()[0]);
    config.aiKey = saved;
    assert.equal(r.ok, true);
    assert.match(storage.getGames()[0].description, /Bungie/);
});

test('nada encontrado: não grava descrição e marca tentativa', async () => {
    mockFetch((url) => {
        if (url.includes('storesearch')) return { items: [] };
        if (url.includes('wikipedia')) return { query: { pages: {} } };
        if (url.includes('/chat/completions')) return claude('SEM_INFO');
        return null;
    });
    const r = await gameinfo.enrichGame(storage.getGames()[2]);
    assert.equal(r.ok, false);
    assert.ok(storage.getGames()[2].metaTriedAt);
    assert.equal(storage.getGames()[2].description, undefined);
    // segunda chamada logo em seguida não repete as requisições
    mockFetch(() => { throw new Error('não deveria chamar rede'); });
    const again = await gameinfo.enrichGame(storage.getGames()[2]);
    assert.equal(again.ok, false);
});

test('fonte com título diferente é ignorada (evita imagem do jogo errado)', async () => {
    mockFetch((url) => {
        if (url.includes('storesearch')) return { items: [] };
        if (url.includes('wikipedia')) return wikiPt('Halo Wars');
        if (url.includes('/chat/completions')) return claude('SEM_INFO');
        return null;
    });
    const r = await gameinfo.enrichGame(storage.getGames()[0]);
    assert.equal(r.ok, false);
    assert.equal(storage.getGames()[0].image, undefined);
});

test('embed de info mostra descrição e imagem quando existem', () => {
    const embed = buildGameInfoEmbed({ ...storage.getGames()[0], link: 'https://www.mediafire.com/x' }, {
        meta: { description: 'Texto', image: 'https://img.test/a.jpg', genres: ['Ação'] },
    });
    const json = embed.toJSON();
    assert.equal(json.description, 'Texto');
    assert.equal(json.image.url, 'https://img.test/a.jpg');
});

test('IA compatível com OpenAI: usa URL/modelo configurados e remove <think>', async () => {
    const saved = { u: config.aiUrl, m: config.aiModel };
    config.aiUrl = 'https://minha-ia.test/v1/';
    config.aiModel = 'modelo-x';
    let sentBody, sentAuth;
    mockFetch((url, opts) => {
        if (url.includes('storesearch')) return { items: [] };
        if (url.includes('pt.wikipedia.org')) return wikiPt('Halo 3');
        if (url.startsWith('https://minha-ia.test/v1/chat/completions')) {
            sentBody = JSON.parse(opts.body);
            sentAuth = opts.headers.authorization;
            return claude('<think>raciocinando</think>Descrição final.');
        }
        return null;
    });
    await gameinfo.enrichGame(storage.getGames()[0]);
    config.aiUrl = saved.u; config.aiModel = saved.m;
    assert.equal(sentBody.model, 'modelo-x');
    assert.equal(sentAuth, 'Bearer test-key');
    assert.equal(storage.getGames()[0].description, 'Descrição final.');
});

test('Claude (Anthropic) continua funcionando se for o único configurado', async () => {
    const saved = config.aiKey;
    config.aiKey = undefined;
    config.anthropicKey = 'k';
    mockFetch((url) => {
        if (url.includes('storesearch')) return { items: [] };
        if (url.includes('pt.wikipedia.org')) return wikiPt('Halo 3');
        if (url.includes('api.anthropic.com')) return { content: [{ type: 'text', text: 'Texto do Claude.' }] };
        return null;
    });
    await gameinfo.enrichGame(storage.getGames()[0]);
    config.aiKey = saved; config.anthropicKey = undefined;
    assert.equal(storage.getGames()[0].description, 'Texto do Claude.');
});

test('IA com limite estourado (429) espera e tenta de novo', async () => {
    const saved = gameinfo.AI_RETRY_DELAYS.splice(0, 2, 1, 1);
    let tries = 0;
    global.fetch = async (url) => {
        url = String(url);
        const ok = (b) => ({ ok: true, status: 200, json: async () => b });
        if (url.includes('storesearch')) return ok({ items: [] });
        if (url.includes('pt.wikipedia.org')) return ok(wikiPt('Halo 3'));
        if (url.includes('/chat/completions')) {
            tries++;
            if (tries < 3) return { ok: false, status: 429, json: async () => ({}) };
            return ok(claude('Funcionou depois de esperar.'));
        }
        return { ok: false, status: 404, json: async () => ({}) };
    };
    await gameinfo.enrichGame(storage.getGames()[0]);
    gameinfo.AI_RETRY_DELAYS.splice(0, 2, ...saved);
    assert.equal(tries, 3);
    assert.equal(storage.getGames()[0].description, 'Funcionou depois de esperar.');
});

test('IA que estoura o tempo (timeout) também é repetida', async () => {
    const saved = gameinfo.AI_RETRY_DELAYS.splice(0, 1, 1);
    let tries = 0;
    global.fetch = async (url) => {
        url = String(url);
        const ok = (b) => ({ ok: true, status: 200, json: async () => b });
        if (url.includes('storesearch')) return ok({ items: [] });
        if (url.includes('pt.wikipedia.org')) return ok(wikiPt('Halo 3'));
        if (url.includes('/chat/completions')) {
            tries++;
            if (tries === 1) { const e = new Error('This operation was aborted'); e.name = 'AbortError'; throw e; }
            return ok(claude('Respondeu na segunda.'));
        }
        return { ok: false, status: 404, json: async () => ({}) };
    };
    await gameinfo.enrichGame(storage.getGames()[0]);
    gameinfo.AI_RETRY_DELAYS.splice(0, 1, ...saved);
    assert.equal(tries, 2);
    assert.equal(storage.getGames()[0].metaAI, true);
});

test('descrição em texto cru (IA falhou) é refeita pela IA no lote', async () => {
    const g = storage.getGames()[2];
    Object.assign(g, { description: 'texto cru em inglês', image: 'https://img.test/f.jpg', metaAI: false, metaSource: 'RAWG' });
    let aiCalls = 0;
    global.fetch = async (url) => {
        url = String(url);
        const ok = (b) => ({ ok: true, status: 200, json: async () => b });
        if (url.includes('storesearch')) return ok({ items: [] });
        if (url.includes('wikipedia')) return ok({ query: { pages: {} } });
        if (url.includes('/chat/completions')) { aiCalls++; return ok(claude('Descrição boa da IA.')); }
        return { ok: false, status: 404, json: async () => ({}) };
    };
    const sleepSave = global.setTimeout;
    const r = await gameinfo.enrichAll({});
    assert.ok(r.started);
    assert.ok(aiCalls >= 1);
    assert.equal(storage.getGames()[2].description, 'Descrição boa da IA.');
});
