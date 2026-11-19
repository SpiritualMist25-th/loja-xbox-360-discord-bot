const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('./config');
const logger = require('./logger');
const storage = require('./storage');
const notify = require('./notify');
const searchState = require('./searchstate');
const gameinfo = require('./gameinfo');
const { safeReply, safeUpdate, sendError } = require('./safe');
const {
    buildDownloadEmbed,
    buildVersionButtons,
    buildGameInfoEmbed,
    buildHelpEmbed,
} = require('./embeds');
const {
    buildListPages,
    buildListEmbed,
    buildListComponents,
    buildPagesFromFields,
} = require('./pagination');

function canManageGames(member) {
    if (!member) return false;
    if (member.permissions && member.permissions.has && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (!config.adminRoleId) return false;
    return member.roles && member.roles.cache && member.roles.cache.has(config.adminRoleId);
}

// Gera descrição/imagem para um jogo recém-adicionado, sem nunca travar o fluxo principal.
async function autoEnrich(game) {
    try {
        await Promise.race([
            gameinfo.enrichGame(game),
            new Promise(resolve => setTimeout(resolve, 25000)),
        ]);
    } catch (err) {
        logger.warn(`Não foi possível gerar info de "${game.name}": ${err.message}`);
    }
}

function formatGameLine(g) {
    const sub = config.subcategoryLabel(g.subcategory);
    return sub ? `${g.name} (${sub})` : g.name;
}

function buildSearchComponents(stateKey, pageIndex, totalPages) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`busca_${stateKey}_${pageIndex - 1}`)
            .setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex <= 0),
        new ButtonBuilder()
            .setCustomId(`busca_pagina_${pageIndex + 1}/${totalPages}`)
            .setLabel(`Página ${pageIndex + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`busca_${stateKey}_${pageIndex + 1}`)
            .setLabel('Próxima ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex >= totalPages - 1)
    )];
}

async function showGameVersions(interaction, name, versions) {
    const meta = storage.getMeta(name);
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`🎮 ${name}`)
        .setDescription(`${meta && meta.description ? `${meta.description}\n\n` : ''}**${versions.length} versão(ões) disponível(is).** Clique num botão para ver o link:`)
        .setTimestamp();
    if (meta && meta.image) embed.setThumbnail(meta.image);

    versions.forEach(v => {
        const subLabel = config.subcategoryLabel(v.subcategory);
        embed.addFields({
            name: `${config.categoryLabel(v.category)}${subLabel ? ` — ${subLabel}` : ''}`,
            value: `Adicionado por ${v.addedBy || 'desconhecido'}`,
            inline: true
        });
    });

    const rows = buildVersionButtons(versions);
    await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleChatInputCommand(interaction) {
    const { commandName, options } = interaction;

    if (commandName === 'addgame') {
        if (!canManageGames(interaction.member)) {
            return sendError(interaction, '❌ Você não tem permissão para usar este comando!');
        }

        const name = options.getString('nome');
        const link = options.getString('link');
        const category = options.getString('categoria');
        const subcategory = options.getString('subcategoria') || null;

        const result = await storage.addGameRecord({
            id: storage.generateId(),
            name,
            link,
            category,
            subcategory,
            addedBy: interaction.user.username,
            addedAt: new Date().toISOString(),
        });

        if (!result.ok) {
            const subLabel = config.subcategoryLabel(subcategory);
            return sendError(interaction, `❌ O jogo "${name}" já está cadastrado na categoria ${config.categoryLabel(category)}${subLabel ? ` (${subLabel})` : ''}!`);
        }

        const subLabel = config.subcategoryLabel(subcategory);
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Jogo Adicionado!')
            .addFields(
                { name: '🎮 Jogo', value: name },
                { name: '📂 Categoria', value: config.categoryLabel(category) + (subLabel ? ` — ${subLabel}` : '') },
                { name: '👤 Adicionado por', value: interaction.user.username }
            )
            .setTimestamp();

        await safeReply(interaction, { embeds: [embed] });
        await autoEnrich(result.game);
        notify.notifyNewGame(result.game);
        return;
    }

    if (commandName === 'removegame') {
        if (!canManageGames(interaction.member)) {
            return sendError(interaction, '❌ Você não tem permissão para usar este comando!');
        }

        const gameName = options.getString('nome');
        const categoria = options.getString('categoria');
        const subcategoria = options.getString('subcategoria');

        let matches = storage.getGames().filter(g => g.name.toLowerCase() === gameName.toLowerCase());
        if (categoria) matches = matches.filter(g => g.category === categoria);
        if (subcategoria) matches = matches.filter(g => (g.subcategory || null) === subcategoria);

        if (matches.length === 0) {
            return sendError(interaction, `❌ Nenhum jogo "${gameName}" encontrado com esses filtros!`);
        }

        if (matches.length > 1) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Existe mais de uma versão com esse nome')
                .setDescription('Rode `/removegame` de novo especificando categoria e/ou subcategoria para escolher qual remover:')
                .addFields(matches.map(g => ({
                    name: g.name,
                    value: `Categoria: ${config.categoryLabel(g.category)}${config.subcategoryLabel(g.subcategory) ? ` — ${config.subcategoryLabel(g.subcategory)}` : ''}`
                })));
            return safeReply(interaction, { embeds: [embed], ephemeral: true });
        }

        const removedGame = matches[0];
        await storage.removeGameRecord(removedGame.id);

        const subLabel = config.subcategoryLabel(removedGame.subcategory);
        return safeReply(interaction, `✅ Jogo "${removedGame.name}" (${config.categoryLabel(removedGame.category)}${subLabel ? ` — ${subLabel}` : ''}) removido com sucesso!`);
    }

    if (commandName === 'buscar') {
        const searchTerm = options.getString('jogo') || '';
        const categoria = options.getString('categoria');
        const subcategoria = options.getString('subcategoria');

        await storage.incrementCounter('searches');

        const results = storage.searchGames(searchTerm, {
            category: categoria || undefined,
            subcategory: subcategoria || undefined,
        });
        const names = storage.uniqueNames(results);

        if (names.length === 0) {
            return sendError(interaction, `❌ Nenhum jogo encontrado com "${searchTerm}"`);
        }

        if (names.length === 1) {
            const versions = results.filter(g => g.name === names[0]);
            await storage.incrementCounter(`search:${names[0].toLowerCase()}`);
            return showGameVersions(interaction, names[0], versions);
        }

        await Promise.all(names.slice(0, 20).map(n =>
            storage.incrementCounter(`search:${n.toLowerCase()}`)
        ));

        const fields = names.map(name => {
            const versions = results.filter(g => g.name === name);
            return {
                name,
                value: versions.map(v => `${config.categoryLabel(v.category)}${config.subcategoryLabel(v.subcategory) ? ` (${config.subcategoryLabel(v.subcategory)})` : ''}`).join(', '),
            };
        });

        const pages = buildPagesFromFields(fields);
        const pageIndex = 0;
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🔍 Jogos Encontrados')
            .setDescription(`Encontramos ${names.length} jogos com "${searchTerm}"${pages.length > 1 ? ` — Página ${pageIndex + 1}/${pages.length}` : ''}. Refine a busca ou use \`/info\` para ver os links:`)
            .setTimestamp();

        pages[pageIndex].forEach(f => embed.addFields({ name: f.name, value: f.value || '—', inline: false }));

        let components = [];
        if (pages.length > 1) {
            const stateKey = searchState.create({ term: searchTerm, cat: categoria, sub: subcategoria });
            components = buildSearchComponents(stateKey, pageIndex, pages.length);
        }

        return safeReply(interaction, { embeds: [embed], components });
    }

    if (commandName === 'listar') {
        const categoryFilter = options.getString('categoria') || 'todos';
        let filteredGames = storage.getGames();

        if (categoryFilter !== 'todos') {
            filteredGames = storage.getGames().filter(g => g.category === categoryFilter);
        }

        if (filteredGames.length === 0) {
            return sendError(interaction, '📭 Nenhum jogo cadastrado nesta categoria!');
        }

        const pages = buildListPages(filteredGames);
        const embed = buildListEmbed(filteredGames, pages, 0, categoryFilter);
        const components = buildListComponents(categoryFilter, 0, pages.length);

        return safeReply(interaction, { embeds: [embed], components });
    }

    if (commandName === 'info') {
        const name = options.getString('jogo');
        const matches = storage.getGames().filter(g => g.name.toLowerCase() === name.toLowerCase());

        if (matches.length === 0) {
            return sendError(interaction, `❌ Jogo "${name}" não encontrado!`);
        }

        const game = matches[0];
        await storage.incrementCounter(`view:${game.id}`);
        await storage.incrementCounter(`search:${game.name.toLowerCase()}`);

        const embed = buildGameInfoEmbed(game, {
            viewCount: storage.getCounter(`view:${game.id}`),
            favCount: storage.favoriteCount(game.id),
            versionCount: matches.length,
            meta: storage.getMeta(game.name),
        });

        const rows = matches.length > 1 ? buildVersionButtons(matches) : buildVersionButtons([game]);
        return safeReply(interaction, { embeds: [embed], components: rows });
    }

    if (commandName === 'favoritos') {
        const sub = options.getSubcommand();

        if (sub === 'adicionar') {
            const name = options.getString('jogo');
            const matches = storage.getGames().filter(g => g.name.toLowerCase() === name.toLowerCase());
            if (matches.length === 0) {
                return sendError(interaction, `❌ Jogo "${name}" não encontrado!`);
            }

            const game = matches[0];
            const result = await storage.addFavorite(interaction.user.id, game);

            if (!result.ok && result.reason === 'exists') {
                return sendError(interaction, `⭐ "${game.name}" já está nos seus favoritos!`);
            }
            if (!result.ok && result.reason === 'limit') {
                return sendError(interaction, '❌ Você atingiu o limite de 25 favoritos. Remova alguns com `/favoritos remover`.');
            }

            return safeReply(interaction, `⭐ "${game.name}" adicionado aos seus favoritos! Use \`/favoritos lista\` para ver.`);
        }

        if (sub === 'remover') {
            const name = options.getString('jogo');
            const favs = storage.getFavorites(interaction.user.id);
            const target = favs.find(f => f.name.toLowerCase() === name.toLowerCase()) ||
                favs.find(f => f.name.toLowerCase().includes(name.toLowerCase()));

            if (!target) {
                return sendError(interaction, `❌ "${name}" não está nos seus favoritos!`);
            }

            await storage.removeFavorite(interaction.user.id, target.gameId);
            return safeReply(interaction, `🗑️ "${target.name}" removido dos seus favoritos.`);
        }

        if (sub === 'lista') {
            const favs = storage.getFavorites(interaction.user.id);
            if (favs.length === 0) {
                return sendError(interaction, '📭 Você ainda não tem favoritos. Use `/favoritos adicionar`!');
            }

            const fields = favs.map(f => ({
                name: f.name,
                value: `${config.categoryLabel(f.category)}${config.subcategoryLabel(f.subcategory) ? ` — ${config.subcategoryLabel(f.subcategory)}` : ''}`,
                inline: true,
            }));

            const pages = buildPagesFromFields(fields);
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`⭐ Seus Favoritos (${favs.length})`)
                .setDescription('Clique num botão abaixo para ver o link de download:')
                .setTimestamp();

            pages[0].forEach(f => embed.addFields(f));

            const liveGames = favs.map(f => storage.findGame(f.gameId)).filter(Boolean);
            const rows = buildVersionButtons(liveGames);

            if (pages.length > 1) {
                logger.debug(`Favoritos com mais de uma página: ${pages.length}`);
            }

            return safeReply(interaction, { embeds: [embed], components: rows });
        }
    }

    if (commandName === 'sugerir') {
        const name = options.getString('nome');
        const link = options.getString('link');
        const category = options.getString('categoria');
        const subcategory = options.getString('subcategoria') || null;

        const existing = storage.getGames().find(g =>
            g.name.toLowerCase() === name.toLowerCase() &&
            g.category === category &&
            (g.subcategory || null) === subcategory
        );
        if (existing) {
            return sendError(interaction, `❌ O jogo "${name}" já está no catálogo!`);
        }

        if (!config.suggestionChannelId) {
            return sendError(interaction, '❌ Sistema de sugestões não configurado (SUGGESTION_CHANNEL_ID não definido).');
        }

        const sug = await storage.createSuggestion({
            name,
            link,
            category,
            subcategory,
            suggestedBy: interaction.user.username,
            suggestedById: interaction.user.id,
        });

        await safeReply(interaction, `💡 Sugestão enviada! Os admins vão revisar em breve. ID: \`${sug.id}\``);

        const msg = await notify.sendSuggestion(sug, `${interaction.user.tag}`);
        if (msg) {
            await storage.updateSuggestion(sug.id, { messageId: msg.id, channelId: msg.channel.id });
        }
        return;
    }

    if (commandName === 'top') {
        const views = storage.topCounters('view:', 10);
        const searches = storage.topCounters('search:', 10);

        if (views.length === 0 && searches.length === 0) {
            return sendError(interaction, '📭 Ainda não há dados de visualização. Use `/buscar` e `/info` para começar!');
        }

        const medals = ['🥇', '🥈', '🥉'];
        const viewLines = views.map((v, i) => {
            const game = storage.findGame(v.key);
            const name = game ? game.name : `(removido) ${v.key}`;
            return `${medals[i] || `${i + 1}.`} ${name} — ${v.count} views`;
        });
        const searchLines = searches
            .slice(0, 10)
            .map((s, i) => `${medals[i] || `${i + 1}.`} ${s.key} — ${s.count} buscas`);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 Top Jogos')
            .setTimestamp();

        if (viewLines.length > 0) {
            embed.addFields({ name: '👀 Mais vistos', value: viewLines.join('\n') || '—' });
        }
        if (searchLines.length > 0) {
            embed.addFields({ name: '🔍 Mais buscados', value: searchLines.join('\n') || '—' });
        }

        return safeReply(interaction, { embeds: [embed] });
    }

    if (commandName === 'stats') {
        const s = storage.stats();
        const catLines = Object.entries(s.byCategory)
            .map(([k, v]) => `${config.categoryLabel(k)}: ${v}`)
            .join('\n') || '—';
        const subLines = Object.entries(s.bySubcategory)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n') || '—';

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📊 Estatísticas do Catálogo')
            .addFields(
                { name: '🎮 Total de jogos', value: String(s.total), inline: true },
                { name: '⭐ Favoritos salvos', value: String(s.favorites), inline: true },
                { name: '💡 Sugestões pendentes', value: String(s.suggestionsPending), inline: true },
                { name: '🔍 Buscas realizadas', value: String(s.searches), inline: true },
                { name: 'Por categoria', value: catLines, inline: true },
                { name: 'Por subcategoria', value: subLines, inline: true }
            )
            .setTimestamp();

        return safeReply(interaction, { embeds: [embed] });
    }

    if (commandName === 'gerarinfo') {
        if (!canManageGames(interaction.member)) {
            return sendError(interaction, '❌ Você não tem permissão para usar este comando!');
        }

        const name = options.getString('jogo');
        const force = options.getBoolean('refazer') || false;

        // --- um jogo só ---
        if (name) {
            const game = storage.getGames().find(g => g.name.toLowerCase() === name.toLowerCase());
            if (!game) return sendError(interaction, `❌ Jogo "${name}" não encontrado!`);

            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
            const r = await gameinfo.enrichGame(game, { force: true }).catch(err => ({ ok: false, reason: err.message }));
            if (!r.ok) {
                return safeReply(interaction, `⚠️ Não consegui achar informações confiáveis para "${game.name}" (${r.reason}). Use \`/editarinfo\` para preencher manualmente.`);
            }
            const embed = buildGameInfoEmbed(game, {
                versionCount: storage.getGames().filter(g => g.nameLower === game.nameLower).length,
                viewCount: storage.getCounter(`view:${game.id}`),
                favCount: storage.favoriteCount(game.id),
                meta: storage.getMeta(game.name),
            });
            return safeReply(interaction, { content: `✅ Informações geradas para "${game.name}" (fonte: ${r.source || 'cache'}):`, embeds: [embed] });
        }

        // --- todos os jogos ---
        if (gameinfo.isBulkRunning()) {
            return sendError(interaction, '⏳ Já existe uma geração em lote em andamento. Aguarde terminar.');
        }

        const channel = interaction.channel;
        await safeReply(interaction, {
            content: `🤖 Gerando descrição e imagem ${force ? 'de TODOS os jogos' : 'dos jogos que ainda não têm'}... Isso roda em segundo plano (cerca de 1 jogo por segundo). Aviso aqui quando terminar.`,
            ephemeral: true,
        });

        gameinfo.enrichAll({
            force,
            onProgress: (p) => {
                if (p.done + p.failed > 0 && (p.done + p.failed) % 25 === 0) {
                    logger.info(`🤖 gerarinfo: ${p.done + p.failed}/${p.total} (ok ${p.done}, falhas ${p.failed})`);
                }
            },
        }).then(async (summary) => {
            logger.info(`🤖 gerarinfo concluído: ${summary.done} ok, ${summary.failed} sem resultado, de ${summary.total}.`);
            if (channel && channel.send) {
                await channel.send(`🤖 <@${interaction.user.id}> geração concluída: **${summary.done}** jogos atualizados, **${summary.failed}** sem resultado (de ${summary.total}). Os sem resultado podem ser preenchidos com \`/editarinfo\`.`).catch(() => null);
            }
        }).catch(err => logger.error('❌ gerarinfo em lote falhou:', err));
        return;
    }

    if (commandName === 'editarinfo') {
        if (!canManageGames(interaction.member)) {
            return sendError(interaction, '❌ Você não tem permissão para usar este comando!');
        }

        const name = options.getString('jogo');
        const description = options.getString('descricao');
        const image = options.getString('imagem');

        const game = storage.getGames().find(g => g.name.toLowerCase() === name.toLowerCase());
        if (!game) return sendError(interaction, `❌ Jogo "${name}" não encontrado!`);
        if (!description && !image) {
            return sendError(interaction, '❌ Informe pelo menos a descrição ou a imagem.');
        }
        if (image && !gameinfo.isHttpUrl(image)) {
            return sendError(interaction, '❌ A imagem precisa ser uma URL válida começando com http:// ou https://');
        }

        const patch = { metaSource: 'manual', metaAt: new Date().toISOString(), metaTriedAt: null };
        if (description) patch.description = gameinfo.truncate(description, 600);
        if (image) patch.image = image;
        await storage.updateGameMeta(game.name, patch);

        const embed = buildGameInfoEmbed(game, {
            versionCount: storage.getGames().filter(g => g.nameLower === game.nameLower).length,
            viewCount: storage.getCounter(`view:${game.id}`),
            favCount: storage.favoriteCount(game.id),
            meta: storage.getMeta(game.name),
        });
        return safeReply(interaction, { content: `✅ Informações de "${game.name}" atualizadas:`, embeds: [embed], ephemeral: true });
    }

    if (commandName === 'ajuda') {
        return safeReply(interaction, { embeds: [buildHelpEmbed()] });
    }
}

async function handleButton(interaction) {
    const id = interaction.customId;

    if (id.startsWith('listar_')) {
        const parts = id.split('_');
        const categoryFilter = parts[1];
        const targetPage = parseInt(parts[2], 10);

        if (categoryFilter === 'pagina' || Number.isNaN(targetPage)) {
            return interaction.deferUpdate().catch(() => null);
        }

        const filteredGames = categoryFilter === 'todos'
            ? storage.getGames()
            : storage.getGames().filter(g => g.category === categoryFilter);

        if (filteredGames.length === 0) {
            return safeUpdate(interaction, {
                content: '📭 Nenhum jogo cadastrado nesta categoria!',
                embeds: [],
                components: []
            });
        }

        const pages = buildListPages(filteredGames);
        const pageIndex = Math.min(Math.max(targetPage, 0), pages.length - 1);
        const embed = buildListEmbed(filteredGames, pages, pageIndex, categoryFilter);
        const components = buildListComponents(categoryFilter, pageIndex, pages.length);

        return safeUpdate(interaction, { embeds: [embed], components });
    }

    if (id.startsWith('busca_')) {
        const parts = id.split('_');
        if (parts[1] === 'pagina') {
            return interaction.deferUpdate().catch(() => null);
        }

        const state = searchState.get(parts[1]);
        if (!state) {
            return sendError(interaction, '❌ Esta busca expirou (10 min). Use `/buscar` novamente.');
        }

        const targetPage = parseInt(parts[2], 10);
        const results = storage.searchGames(state.term || '', {
            category: state.cat || undefined,
            subcategory: state.sub || undefined,
        });
        const names = storage.uniqueNames(results);
        const fields = names.map(name => {
            const versions = results.filter(g => g.name === name);
            return {
                name,
                value: versions.map(v => `${config.categoryLabel(v.category)}${config.subcategoryLabel(v.subcategory) ? ` (${config.subcategoryLabel(v.subcategory)})` : ''}`).join(', '),
            };
        });
        const pages = buildPagesFromFields(fields);
        const pageIndex = Math.min(Math.max(Number.isNaN(targetPage) ? 0 : targetPage, 0), pages.length - 1);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🔍 Jogos Encontrados')
            .setDescription(`Encontramos ${names.length} jogos com "${state.term}" — Página ${pageIndex + 1}/${pages.length}. Refine a busca ou use \`/info\` para ver os links:`)
            .setTimestamp();
        pages[pageIndex].forEach(f => embed.addFields({ name: f.name, value: f.value || '—', inline: false }));

        return safeUpdate(interaction, { embeds: [embed], components: buildSearchComponents(parts[1], pageIndex, pages.length) });
    }

    if (id.startsWith('sug_aprovar_') || id.startsWith('sug_rejeitar_')) {
        const aprovar = id.startsWith('sug_aprovar_');
        const sugId = id.split('_')[2];

        if (!canManageGames(interaction.member)) {
            return sendError(interaction, '❌ Apenas admins podem aprovar/rejeitar sugestões!');
        }

        const sug = storage.findSuggestion(sugId);
        if (!sug) {
            return sendError(interaction, '❌ Sugestão não encontrada (pode já ter sido processada).');
        }
        if (sug.status !== 'pending') {
            return sendError(interaction, `❌ Esta sugestão já foi ${sug.status === 'approved' ? 'aprovada' : 'rejeitada'}.`);
        }

        if (!aprovar) {
            await storage.updateSuggestion(sugId, {
                status: 'rejected',
                resolvedBy: interaction.user.username,
                resolvedAt: new Date().toISOString(),
            });

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0xFF0000)
                .setDescription(`**${sug.name}** — ❌ Rejeitada por ${interaction.user.username}`)
                .setFooter({ text: `Rejeitada em ${new Date().toLocaleString('pt-BR')}` });

            return safeUpdate(interaction, { embeds: [embed], components: [] });
        }

        const result = await storage.addGameRecord({
            id: storage.generateId(),
            name: sug.name,
            link: sug.link,
            category: sug.category,
            subcategory: sug.subcategory,
            addedBy: `${sug.suggestedBy} (sugestão)`,
            addedAt: new Date().toISOString(),
        });

        if (!result.ok) {
            return sendError(interaction, `❌ O jogo "${sug.name}" já está no catálogo! A sugestão foi marcada como aprovada.`);
        }

        await storage.updateSuggestion(sugId, {
            status: 'approved',
            resolvedBy: interaction.user.username,
            resolvedAt: new Date().toISOString(),
        });

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x00FF00)
            .setDescription(`**${sug.name}** — ✅ Aprovada por ${interaction.user.username}`)
            .setFooter({ text: `Aprovada em ${new Date().toLocaleString('pt-BR')}` });

        await safeUpdate(interaction, { embeds: [embed], components: [] });
        await autoEnrich(result.game);
        notify.notifyNewGame(result.game);
        return;
    }

    if (id.startsWith('ver_')) {
        const gameId = id.slice('ver_'.length);
        const game = storage.findGame(gameId);

        if (!game) {
            return sendError(interaction, '❌ Este link não está mais disponível (o jogo pode ter sido removido).');
        }

        await storage.incrementCounter(`view:${game.id}`);

        const favorited = storage.isFavorite(interaction.user.id, game.id);
        const embed = buildDownloadEmbed(game, {
            viewCount: storage.getCounter(`view:${game.id}`),
            favCount: storage.favoriteCount(game.id),
            viewerFavorited: favorited,
            meta: storage.getMeta(game.name),
        });

        return safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
}

async function handleAutocomplete(interaction) {
    const { commandName, options } = interaction;
    const focused = options.getFocused(true);
    const value = String(focused.value || '');

    let choices = [];

    if (commandName === 'favoritos') {
        const sub = options.getSubcommand();
        if (sub === 'remover') {
            const favs = storage.getFavorites(interaction.user.id);
            choices = favs
                .map(f => f.name)
                .filter(n => n.toLowerCase().includes(value.toLowerCase()))
                .slice(0, 25);
        } else {
            choices = storage.autocompleteNames(value, 25);
        }
    } else if (commandName === 'removegame' && canManageGames(interaction.member)) {
        choices = storage.autocompleteNames(value, 25);
    } else {
        choices = storage.autocompleteNames(value, 25);
    }

    try {
        await interaction.respond(choices.map(c => ({ name: c.slice(0, 100), value: c })));
    } catch (err) {
        logger.warn(`Erro no autocomplete de ${commandName}: ${err.message}`);
    }
}

async function handleInteraction(interaction) {
    if (interaction.isAutocomplete()) {
        return handleAutocomplete(interaction);
    }
    if (interaction.isChatInputCommand()) {
        return handleChatInputCommand(interaction);
    }
    if (interaction.isButton()) {
        return handleButton(interaction);
    }
}

module.exports = {
    handleInteraction,
    canManageGames,
    showGameVersions,
    formatGameLine,
};
