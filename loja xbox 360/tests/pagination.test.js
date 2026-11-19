const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    gameLetter,
    buildListChunks,
    buildListPages,
    buildPagesFromFields,
} = require('../src/pagination');

function g(name, category = 'xex', subcategory = null) {
    return { id: name, name, category, subcategory };
}

test('gameLetter agrupa letras com acento na letra base', () => {
    assert.equal(gameLetter('Álbum'), 'A');
    assert.equal(gameLetter('Éden'), 'E');
    assert.equal(gameLetter('1942'), '#');
    assert.equal(gameLetter('!sem'), '#');
    assert.equal(gameLetter(''), '#');
    assert.equal(gameLetter('zelda'), 'Z');
});

test('buildListPages respeita limite de 25 campos', () => {
    const games = [];
    for (let i = 0; i < 400; i++) {
        games.push(g(`Jogo ${String.fromCharCode(65 + (i % 26))}${i}`));
    }
    const pages = buildListPages(games);
    assert.ok(pages.length > 1, 'deveria gerar múltiplas páginas');
    for (const page of pages) {
        assert.ok(page.length <= 25, `página com ${page.length} campos (máx 25)`);
    }
});

test('buildListPages com lista vazia retorna uma página vazia', () => {
    const pages = buildListPages([]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].length, 0);
});

test('buildListChunks agrupa por letra e não passa de 1000 chars por chunk', () => {
    const games = [
        g('Alpha'), g('Âlfa'), g('Beta'), g('123'),
    ];
    const chunks = buildListChunks(games);
    for (const chunk of chunks) {
        assert.ok(chunk.text.length <= 1001, `chunk de ${chunk.letter} com ${chunk.text.length} chars`);
    }
    const letters = chunks.map(c => c.letter);
    assert.ok(letters.includes('A'));
    assert.ok(letters.includes('B'));
    assert.ok(letters.includes('#'));
});

test('buildPagesFromFields agrupa fields respeitando limites', () => {
    const fields = [];
    for (let i = 0; i < 60; i++) {
        fields.push({ name: `Campo ${i}`, value: 'x'.repeat(100) });
    }
    const pages = buildPagesFromFields(fields);
    assert.ok(pages.length >= 3);
    for (const page of pages) {
        assert.ok(page.length <= 25);
        const chars = page.reduce((acc, f) => acc + f.name.length + f.value.length, 0);
        assert.ok(chars <= 6000, `página com ${chars} chars`);
    }
    const total = pages.flat().length;
    assert.equal(total, 60, 'todos os fields devem ser preservados');
});

test('buildPagesFromFields com lista vazia retorna uma página vazia', () => {
    const pages = buildPagesFromFields([]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].length, 0);
});
