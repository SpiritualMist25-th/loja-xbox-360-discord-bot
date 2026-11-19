const config = require('./config');
const logger = require('./logger');
const storage = require('./storage');

let clientRef = null;

function setClient(client) {
    clientRef = client;
}

async function notifyNewGame(game) {
    if (!config.newGameChannelId || !clientRef) return;
    try {
        const channel = await clientRef.channels.fetch(config.newGameChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            logger.warn('NEW_GAME_CHANNEL_ID inválido ou canal não é de texto:', config.newGameChannelId);
            return;
        }

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const subLabel = config.subcategoryLabel(game.subcategory);
        const meta = storage.getMeta(game.name);
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🆕 Novo jogo no catálogo!')
            .setDescription(`**${game.name}**${meta && meta.description ? `\n\n${meta.description}` : ''}`)
            .addFields(
                { name: '📂 Categoria', value: `${config.categoryLabel(game.category)}${subLabel ? ` — ${subLabel}` : ''}`, inline: true },
                { name: '👤 Adicionado por', value: game.addedBy || 'desconhecido', inline: true }
            )
            .setTimestamp();
        if (meta && meta.image) embed.setImage(meta.image);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ver_${game.id}`)
                .setLabel('📥 Ver download')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });
    } catch (err) {
        logger.error('Erro ao notificar novo jogo:', err.message);
    }
}

async function sendSuggestion(suggestion, suggestedByTag) {
    if (!config.suggestionChannelId || !clientRef) return null;
    try {
        const channel = await clientRef.channels.fetch(config.suggestionChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            logger.warn('SUGGESTION_CHANNEL_ID inválido ou canal não é de texto:', config.suggestionChannelId);
            return null;
        }

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const subLabel = config.subcategoryLabel(suggestion.subcategory);
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('💡 Sugestão de jogo')
            .setDescription(`**${suggestion.name}**`)
            .addFields(
                { name: '📂 Categoria', value: `${config.categoryLabel(suggestion.category)}${subLabel ? ` — ${subLabel}` : ''}`, inline: true },
                { name: '👤 Sugestão de', value: suggestedByTag, inline: true },
                { name: '🔗 Link', value: suggestion.link },
                { name: '🆔 ID', value: `\`${suggestion.id}\``, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sug_aprovar_${suggestion.id}`)
                .setLabel('✅ Aprovar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`sug_rejeitar_${suggestion.id}`)
                .setLabel('❌ Rejeitar')
                .setStyle(ButtonStyle.Danger)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        return msg;
    } catch (err) {
        logger.error('Erro ao enviar sugestão:', err.message);
        return null;
    }
}

module.exports = {
    setClient,
    notifyNewGame,
    sendSuggestion,
};
