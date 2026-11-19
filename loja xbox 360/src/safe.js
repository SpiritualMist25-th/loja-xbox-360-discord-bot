const { MessageFlags } = require('discord.js');
const logger = require('./logger');

function isExpiredError(err) {
    const code = err?.code;
    if (code === 10062 || code === 40060 || code === 10015) return true;
    const msg = String(err?.message || '');
    return /unknown interaction|interaction has already been acknowledged|expired|Invalid Webhook Token/i.test(msg);
}

function stripEphemeral(payload) {
    if (!payload || typeof payload !== 'object' || !('ephemeral' in payload)) return payload;
    const { ephemeral, ...rest } = payload;
    return rest;
}

// discord.js novo: `ephemeral` virou `flags: MessageFlags.Ephemeral`
function toFlags(payload) {
    if (!payload || typeof payload !== 'object' || !('ephemeral' in payload)) return payload;
    const { ephemeral, ...rest } = payload;
    return ephemeral ? { ...rest, flags: MessageFlags.Ephemeral } : rest;
}

async function safeReply(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(stripEphemeral(payload));
        }
        return await interaction.reply(toFlags(payload));
    } catch (err) {
        if (isExpiredError(err)) {
            logger.warn(`Interação expirada ao responder (${interaction.commandName || interaction.customId}) de ${interaction.user?.tag}`);
            return null;
        }
        throw err;
    }
}

async function safeUpdate(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(stripEphemeral(payload));
        }
        return await interaction.update(payload);
    } catch (err) {
        if (isExpiredError(err)) {
            logger.warn(`Interação expirada ao atualizar (${interaction.customId}) de ${interaction.user?.tag}`);
            return null;
        }
        throw err;
    }
}

async function sendError(interaction, content) {
    const payload = stripEphemeral({ content, ephemeral: true });
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }
        return await interaction.reply(toFlags({ content, ephemeral: true }));
    } catch (err) {
        logger.warn(`Não foi possível enviar erro para ${interaction.user?.tag}: ${err.message}`);
        return null;
    }
}

module.exports = { safeReply, safeUpdate, sendError, isExpiredError };
