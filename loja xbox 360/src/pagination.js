const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

const LIST_MAX_FIELDS = 25;
const LIST_MAX_CHARS = 5000;

function formatListLine(g) {
    const sub = config.subcategoryLabel(g.subcategory);
    return `${g.name}${sub ? ` (${sub})` : ''} — ${config.categoryLabel(g.category)}`;
}

function gameLetter(name) {
    const first = (name || '').trim()[0] || '#';
    const ascii = first.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /^[A-Z]$/.test(ascii) ? ascii : '#';
}

function buildListChunks(filteredGames) {
    const sorted = [...filteredGames].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
    );

    const groups = new Map();
    for (const g of sorted) {
        const key = gameLetter(g.name);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(g);
    }

    const chunks = [];
    for (const [letter, list] of groups) {
        let part = 0;
        let lines = [];
        let size = 0;

        const flush = () => {
            if (lines.length === 0) return;
            chunks.push({
                letter,
                count: list.length,
                part,
                text: lines.join('\n')
            });
            part += 1;
            lines = [];
            size = 0;
        };

        for (const g of list) {
            const line = formatListLine(g);
            if (size + line.length + 1 > 1000 && lines.length > 0) flush();
            lines.push(line);
            size += line.length + 1;
        }
        flush();
    }

    return chunks;
}

function buildListPages(filteredGames) {
    const chunks = buildListChunks(filteredGames);
    const pages = [];
    let current = [];
    let chars = 0;

    for (const chunk of chunks) {
        const name = chunk.part === 0
            ? `${chunk.letter} (${chunk.count})`
            : `${chunk.letter} (continuação)`;
        const cost = name.length + chunk.text.length + 20;

        if (current.length > 0 && (current.length >= LIST_MAX_FIELDS || chars + cost > LIST_MAX_CHARS)) {
            pages.push(current);
            current = [];
            chars = 0;
        }

        current.push({ name, value: chunk.text });
        chars += cost;
    }

    if (current.length > 0) pages.push(current);
    if (pages.length === 0) pages.push([]);

    return pages;
}

function buildListEmbed(filteredGames, pages, pageIndex, categoryFilter) {
    const filtro = categoryFilter !== 'todos' ? ` (filtro: ${config.categoryLabel(categoryFilter)})` : '';
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🎮 Jogos Disponíveis')
        .setDescription(`Total: ${filteredGames.length} jogos${filtro} — Página ${pageIndex + 1}/${pages.length}\nOrdenados por letra (A → Z)`)
        .setTimestamp();

    const page = pages[pageIndex] || [];
    page.forEach(field => {
        embed.addFields({ name: field.name, value: field.value || '—', inline: false });
    });

    return embed;
}

function buildListComponents(categoryFilter, pageIndex, totalPages) {
    if (totalPages <= 1) return [];

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`listar_${categoryFilter}_${pageIndex - 1}`)
            .setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex <= 0),
        new ButtonBuilder()
            .setCustomId(`listar_pagina_${categoryFilter}`)
            .setLabel(`Página ${pageIndex + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`listar_${categoryFilter}_${pageIndex + 1}`)
            .setLabel('Próxima ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex >= totalPages - 1)
    );

    return [row];
}

function buildPagesFromFields(fields) {
    const pages = [];
    let current = [];
    let chars = 0;

    for (const field of fields) {
        const cost = field.name.length + field.value.length + 20;
        if (current.length > 0 && (current.length >= LIST_MAX_FIELDS || chars + cost > LIST_MAX_CHARS)) {
            pages.push(current);
            current = [];
            chars = 0;
        }
        current.push(field);
        chars += cost;
    }

    if (current.length > 0) pages.push(current);
    if (pages.length === 0) pages.push([]);

    return pages;
}

module.exports = {
    formatListLine,
    gameLetter,
    buildListChunks,
    buildListPages,
    buildListEmbed,
    buildListComponents,
    buildPagesFromFields,
};
