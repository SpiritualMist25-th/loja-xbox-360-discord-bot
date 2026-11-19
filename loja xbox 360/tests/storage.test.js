process.env.DATA_DIR = require('node:os').tmpdir() + '/bot-catalogo-tests';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const storage = require('../src/storage');

function seed() {
    storage.getGames().length = 0;
    storage.getGames().push(
        { id: '1', name: 'Halo 3', category: 'xex', subcategory: null, nameLower: 'halo 3' },
        { id: '2', name: 'Halo 3', category: 'god', subcategory: 'disco1', nameLower: 'halo 3' },
        { id: '3', name: 'Forza Horizon', category: 'god', subcategory: null, nameLower: 'forza horizon' },
        { id: '4', name: 'Grand Theft Auto V', category: 'xex', subcategory: null, nameLower: 'grand theft auto v' },
    );
}

test('searchGames busca por termo simples', () => {
    seed();
    const results = storage.searchGames('halo');
    assert.equal(results.length, 2);
});

test('searchGames ignora acentos e maiúsculas', () => {
    seed();
    const results = storage.searchGames('FORZA');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Forza Horizon');
});

test('searchGames com múltiplas palavras exige todas', () => {
    seed();
    assert.equal(storage.searchGames('halo 3').length, 2);
    assert.equal(storage.searchGames('halo forza').length, 0);
});

test('searchGames filtra por categoria', () => {
    seed();
    const results = storage.searchGames('halo', { category: 'god' });
    assert.equal(results.length, 1);
    assert.equal(results[0].category, 'god');
});

test('searchGames filtra por subcategoria', () => {
    seed();
    const results = storage.searchGames('halo', { subcategory: 'disco1' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, '2');
});

test('searchGames sem termo retorna tudo (com filtros aplicados)', () => {
    seed();
    assert.equal(storage.searchGames('', { category: 'xex' }).length, 2);
    assert.equal(storage.searchGames('').length, 4);
});

test('uniqueNames remove duplicatas de versões', () => {
    seed();
    const names = storage.uniqueNames(storage.searchGames('halo'));
    assert.equal(names.length, 1);
    assert.deepEqual(names, ['Halo 3']);
});

test('addGameRecord bloqueia duplicata (nome+categoria+subcategoria)', async () => {
    seed();
    const result = await storage.addGameRecord({
        id: '99',
        name: 'Halo 3',
        category: 'xex',
        subcategory: null,
    });
    assert.equal(result.ok, false);
    assert.equal(result.duplicate.id, '1');
});

test('addGameRecord permite mesmo nome em categoria diferente', async () => {
    seed();
    const result = await storage.addGameRecord({
        id: '99',
        name: 'Halo 3',
        category: 'god',
        subcategory: 'disco2',
    });
    assert.equal(result.ok, true);
    storage.getGames().pop();
});

test('favoritos: adicionar, verificar e remover', async () => {
    seed();
    const game = storage.getGames()[0];

    const add1 = await storage.addFavorite('user1', game);
    assert.equal(add1.ok, true);

    const add2 = await storage.addFavorite('user1', game);
    assert.equal(add2.ok, false);
    assert.equal(add2.reason, 'exists');

    assert.equal(storage.isFavorite('user1', game.id), true);
    assert.equal(storage.isFavorite('user2', game.id), false);

    const removed = await storage.removeFavorite('user1', game.id);
    assert.equal(removed, true);
    assert.equal(storage.isFavorite('user1', game.id), false);
});

test('favoritos: limite de 25 por usuário', async () => {
    for (let i = 0; i < 26; i++) {
        const res = await storage.addFavorite('userLimit', { id: `g${i}`, name: `Jogo ${i}`, category: 'xex', subcategory: null });
        if (i < 25) assert.equal(res.ok, true, `favorito ${i} deveria ser aceito`);
        else assert.equal(res.reason, 'limit');
    }
});

test('removeGameRecord remove favoritos do jogo removido', async () => {
    seed();
    const game = storage.getGames()[2];
    await storage.addFavorite('user1', game);
    await storage.removeGameRecord(game.id);
    assert.equal(storage.isFavorite('user1', game.id), false);
});

test('stats calcula totais por categoria', () => {
    seed();
    const s = storage.stats();
    assert.equal(s.total, 4);
    assert.equal(s.byCategory.xex, 2);
    assert.equal(s.byCategory.god, 2);
});
