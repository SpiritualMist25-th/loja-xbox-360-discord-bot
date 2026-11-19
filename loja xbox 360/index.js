const http = require('http');
const config = require('./src/config');
const logger = require('./src/logger');
const storage = require('./src/storage');
const notify = require('./src/notify');
const { buildCommands } = require('./src/commands');
const { handleInteraction } = require('./src/handler');
const { sendError } = require('./src/safe');
const { Client, GatewayIntentBits, ActivityType, REST, Routes } = require('discord.js');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot Discord está rodando!');
});

server.listen(config.port, '0.0.0.0', () => {
    logger.info(`✅ HTTP server rodando na porta ${config.port}`);
});

// Status do bot (opcional). Defina STREAM_TEXT no .env para ativar o status "Transmitindo"
// (STREAM_URL precisa ser twitch.tv ou youtube.com; o canal NÃO precisa estar ao vivo).
// Sem STREAM_TEXT, o bot fica apenas online, sem atividade.
const STREAM_PRESENCE = process.env.STREAM_TEXT
    ? {
        status: 'online',
        activities: [{
            name: process.env.STREAM_TEXT,
            type: ActivityType.Streaming,
            url: process.env.STREAM_URL || 'https://www.twitch.tv/discord',
        }],
    }
    : { status: 'online', activities: [] };

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    presence: STREAM_PRESENCE,
});

notify.setClient(client);

// ============================================================
// LOGS DE ERRO / DIAGNÓSTICO
// ============================================================
client.on('error', (error) => {
    logger.error('❌ [discord.js] Erro no client:', error);
});

client.on('warn', (info) => {
    logger.warn('⚠️ [discord.js] Aviso:', info);
});

client.on('shardError', (error, shardId) => {
    logger.error(`❌ [discord.js] Erro no shard ${shardId} (problema de conexão com o gateway):`, error);
});

client.on('shardDisconnect', (event, shardId) => {
    logger.warn(`⚠️ [discord.js] Shard ${shardId} desconectado do gateway. Código: ${event?.code}, motivo: ${event?.reason || 'desconhecido'}`);
});

client.on('shardReconnecting', (shardId) => {
    logger.info(`🔄 [discord.js] Shard ${shardId} tentando reconectar...`);
});

client.on('shardResume', (shardId, replayedEvents) => {
    logger.info(`✅ [discord.js] Shard ${shardId} reconectado (${replayedEvents} eventos reprocessados).`);
});

process.on('unhandledRejection', (reason) => {
    logger.error('❌ [processo] Promise rejeitada sem tratamento:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('❌❌ [processo] Exceção não tratada — o processo vai reiniciar:', error);
    process.exit(1);
});

// ============================================================
// REGISTRO DE SLASH COMMANDS
// ============================================================
async function registerCommands(rest, scopeId = null) {
    const commands = buildCommands().map(c => c.toJSON());

    if (scopeId) {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, scopeId),
            { body: commands }
        );
    } else {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
    }
    return commands.length;
}

client.once('clientReady', async () => {
    logger.info(`✅ Bot online como ${client.user.tag}!`);
    client.user.setPresence(STREAM_PRESENCE);
    logger.info(`📊 ${storage.getGames().length} jogos carregados`);

    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        logger.info('🔄 Registrando slash commands...');
        const count = await registerCommands(rest, config.guildId || null);
        logger.info(`✅ ${count} slash commands registrados${config.guildId ? ` (guild ${config.guildId})` : ' (globais)'}!`);

        // Comandos GLOBAIS antigos + comandos do servidor = cada comando aparece 2x no Discord.
        // Defina CLEAR_GLOBAL_COMMANDS=true no .env para apagar os globais (rode uma vez e depois remova).
        if (config.guildId && process.env.CLEAR_GLOBAL_COMMANDS === 'true') {
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            logger.info('🧹 Comandos globais apagados (CLEAR_GLOBAL_COMMANDS=true). Pode remover essa linha do .env.');
        }
    } catch (error) {
        logger.error('❌ Erro ao registrar comandos:', error);
    }
});

client.on('guildCreate', async (guild) => {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        const count = await registerCommands(rest, guild.id);
        logger.info(`🆕 Novo servidor "${guild.name}" (${guild.id}) — ${count} slash command(s) registrados.`);
    } catch (error) {
        logger.error(`❌ Erro ao registrar comandos em "${guild.name}":`, error);
    }
});

// ============================================================
// INTERAÇÕES
// ============================================================
client.on('interactionCreate', async (interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        logger.error(`❌ Erro ao processar interação (${interaction.commandName || interaction.customId || 'desconhecida'}) de ${interaction.user?.tag}:`, error);
        await sendError(interaction, '❌ Ocorreu um erro interno ao processar seu comando. Tente novamente em alguns instantes.');
    }
});

// ============================================================
// STARTUP
// ============================================================
(async () => {
    if (!config.token) {
        logger.error('❌❌ DISCORD_TOKEN não definido no .env — o bot não pode iniciar.');
        process.exit(1);
    }

    await storage.initStorage();

    try {
        await client.login(config.token);
    } catch (error) {
        logger.error('❌❌ Falha ao fazer login no Discord (token inválido ou problema de rede):', error);
        process.exit(1);
    }
})();

setInterval(() => {
    logger.info(`💓 Bot ativo. Ping do gateway: ${client.ws.ping}ms. Jogos em memória: ${storage.getGames().length}.`);
}, 30 * 60 * 1000);
