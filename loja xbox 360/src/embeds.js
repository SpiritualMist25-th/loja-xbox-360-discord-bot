const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

function withMeta(embed, meta, { big = false } = {}) {
    if (meta && meta.image) {
        if (big) embed.setImage(meta.image); else embed.setThumbnail(meta.image);
    }
    return embed;
}

function buildDownloadEmbed(game, { viewCount = 0, favCount = 0, viewerFavorited = false, meta = null } = {}) {
    const subLabel = config.subcategoryLabel(game.subcategory);
    const embed = new EmbedBuilder()
        .setColor(config.categoryColor(game.category))
        .setTitle(`📥 Download: ${game.name}`)
        .setDescription(`**Categoria:** ${config.categoryLabel(game.category)}${subLabel ? ` — ${subLabel}` : ''}${meta && meta.description ? `\n\n${meta.description}` : ''}`)
        .addFields(
            { name: '🔗 Link', value: game.link },
            { name: '👤 Adicionado por', value: game.addedBy || 'desconhecido' }
        )
        .setTimestamp();

    if (config.passwords.length > 0) {
        embed.addFields({ name: '🔑 Senhas possíveis (teste nesta ordem)', value: config.passwords.map(p => `\`${p}\``).join('\n') });
    }

    withMeta(embed, meta);

    if (game.addedAt) {
        embed.addFields({ name: '📅 Adicionado em', value: new Date(game.addedAt).toLocaleDateString('pt-BR'), inline: true });
    }
    if (viewCount > 0) {
        embed.addFields({ name: '👀 Visualizações', value: String(viewCount), inline: true });
    }
    if (favCount > 0) {
        embed.addFields({ name: '⭐ Favoritado por', value: `${favCount} usuário(s)`, inline: true });
    }

    embed.setFooter({ text: viewerFavorited ? '⭐ Este jogo está nos seus favoritos' : 'Use /favoritos adicionar para salvar' });

    return embed;
}

function buildVersionButtons(versions) {
    const rows = [];
    for (let i = 0; i < versions.length && i < 25; i += 5) {
        const row = new ActionRowBuilder();
        versions.slice(i, i + 5).forEach(v => {
            const subLabel = config.subcategoryLabel(v.subcategory);
            const label = `${config.categoryLabel(v.category)}${subLabel ? ` ${subLabel}` : ''}`.slice(0, 80);
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ver_${v.id}`)
                    .setLabel(label)
                    .setStyle(ButtonStyle[config.categoryButtonStyle(v.category)] || ButtonStyle.Secondary)
            );
        });
        rows.push(row);
    }
    return rows;
}

function buildGameInfoEmbed(game, { viewCount = 0, favCount = 0, versionCount = 1, meta = null } = {}) {
    const subLabel = config.subcategoryLabel(game.subcategory);
    const embed = new EmbedBuilder()
        .setColor(config.categoryColor(game.category))
        .setTitle(`ℹ️ ${game.name}`)
        .addFields(
            { name: '📂 Categoria', value: `${config.categoryLabel(game.category)}${subLabel ? ` — ${subLabel}` : ''}`, inline: true },
            { name: 'Versões no catálogo', value: String(versionCount), inline: true },
            { name: '👀 Visualizações', value: String(viewCount), inline: true },
            { name: '⭐ Favoritos', value: String(favCount), inline: true },
            { name: '👤 Adicionado por', value: game.addedBy || 'desconhecido', inline: true },
            { name: '📅 Adicionado em', value: game.addedAt ? new Date(game.addedAt).toLocaleDateString('pt-BR') : '—', inline: true },
            { name: '🔗 Link', value: game.link }
        )
        .setTimestamp();

    if (meta && meta.description) embed.setDescription(meta.description);
    if (meta && meta.genres && meta.genres.length) {
        embed.addFields({ name: '🏷️ Gênero', value: meta.genres.join(', '), inline: true });
    }
    withMeta(embed, meta, { big: true });

    return embed;
}

function buildHelpEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📚 Comandos do Bot')
        .setDescription('Aqui estão todos os comandos disponíveis:')
        .addFields(
            {
                name: '👑 Comandos de Admin',
                value: '`/addgame` - Adicionar jogo (categorias XEX, GOD e Ports Xbox; aceita subcategoria: DLC, Disco 1/2, Parte 1-4)\n`/removegame` - Remover jogo (use categoria/subcategoria se houver mais de uma versão)\n`/gerarinfo` - IA gera descrição e imagem (um jogo ou todos que faltam)\n`/editarinfo` - Corrigir manualmente descrição/imagem de um jogo'
            },
            {
                name: '👤 Comandos de Usuário',
                value: '`/buscar` - Buscar jogo (aceita várias palavras e filtros)\n`/listar` - Listar jogos\n`/info` - Detalhes de um jogo\n`/favoritos` - Gerenciar favoritos\n`/sugerir` - Sugerir um jogo novo\n`/top` - Jogos mais vistos\n`/stats` - Estatísticas\n`/ajuda` - Ver comandos'
            },
            {
                name: '💡 Dica',
                value: 'Use `/buscar` com o nome do jogo para ver todas as versões (XEX/GOD, discos, partes, DLC) e seus links!'
            }
        )
        .setFooter({ text: 'Bot de Jogos' })
        .setTimestamp();
}

module.exports = {
    buildDownloadEmbed,
    buildVersionButtons,
    buildGameInfoEmbed,
    buildHelpEmbed,
};
