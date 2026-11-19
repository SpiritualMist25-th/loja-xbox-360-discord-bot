const { SlashCommandBuilder } = require('discord.js');
const config = require('./config');

function buildCommands() {
    return [
        new SlashCommandBuilder()
            .setName('addgame')
            .setDescription('➕ Adicionar um novo jogo (Admin)')
            .addStringOption(option =>
                option.setName('nome')
                    .setDescription('Nome do jogo')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('link')
                    .setDescription('Link de download')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('categoria')
                    .setDescription('Categoria do jogo')
                    .setRequired(true)
                    .addChoices(...config.CATEGORY_CHOICES))
            .addStringOption(option =>
                option.setName('subcategoria')
                    .setDescription('DLC, disco ou parte (opcional)')
                    .setRequired(false)
                    .addChoices(...config.subcategoryChoices())),

        new SlashCommandBuilder()
            .setName('removegame')
            .setDescription('🗑️ Remover um jogo (Admin)')
            .addStringOption(option =>
                option.setName('nome')
                    .setDescription('Nome do jogo a remover')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('categoria')
                    .setDescription('Categoria (opcional, ajuda a desambiguar)')
                    .setRequired(false)
                    .addChoices(...config.CATEGORY_CHOICES))
            .addStringOption(option =>
                option.setName('subcategoria')
                    .setDescription('DLC, disco ou parte (opcional, ajuda a desambiguar)')
                    .setRequired(false)
                    .addChoices(...config.subcategoryChoices())),

        new SlashCommandBuilder()
            .setName('buscar')
            .setDescription('🔍 Buscar um jogo pelo nome')
            .addStringOption(option =>
                option.setName('jogo')
                    .setDescription('Nome do jogo (pode usar várias palavras)')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('categoria')
                    .setDescription('Filtrar por categoria')
                    .setRequired(false)
                    .addChoices(...config.LIST_CATEGORY_CHOICES))
            .addStringOption(option =>
                option.setName('subcategoria')
                    .setDescription('Filtrar por subcategoria')
                    .setRequired(false)
                    .addChoices(...config.subcategoryChoices())),

        new SlashCommandBuilder()
            .setName('listar')
            .setDescription('📋 Listar todos os jogos disponíveis')
            .addStringOption(option =>
                option.setName('categoria')
                    .setDescription('Filtrar por categoria')
                    .setRequired(false)
                    .addChoices(...config.LIST_CATEGORY_CHOICES)),

        new SlashCommandBuilder()
            .setName('info')
            .setDescription('ℹ️ Ver detalhes de um jogo')
            .addStringOption(option =>
                option.setName('jogo')
                    .setDescription('Nome do jogo')
                    .setRequired(true)
                    .setAutocomplete(true)),

        new SlashCommandBuilder()
            .setName('favoritos')
            .setDescription('⭐ Gerenciar seus jogos favoritos')
            .addSubcommand(sub =>
                sub.setName('adicionar')
                    .setDescription('Adicionar um jogo aos seus favoritos')
                    .addStringOption(option =>
                        option.setName('jogo')
                            .setDescription('Nome do jogo')
                            .setRequired(true)
                            .setAutocomplete(true)))
            .addSubcommand(sub =>
                sub.setName('remover')
                    .setDescription('Remover um jogo dos seus favoritos')
                    .addStringOption(option =>
                        option.setName('jogo')
                            .setDescription('Nome do jogo')
                            .setRequired(true)
                            .setAutocomplete(true)))
            .addSubcommand(sub =>
                sub.setName('lista')
                    .setDescription('Ver seus jogos favoritos')),

        new SlashCommandBuilder()
            .setName('sugerir')
            .setDescription('💡 Sugerir um jogo para o catálogo')
            .addStringOption(option =>
                option.setName('nome')
                    .setDescription('Nome do jogo')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('link')
                    .setDescription('Link de download')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('categoria')
                    .setDescription('Categoria do jogo')
                    .setRequired(true)
                    .addChoices(...config.CATEGORY_CHOICES))
            .addStringOption(option =>
                option.setName('subcategoria')
                    .setDescription('DLC, disco ou parte (opcional)')
                    .setRequired(false)
                    .addChoices(...config.subcategoryChoices())),

        new SlashCommandBuilder()
            .setName('top')
            .setDescription('🏆 Top jogos mais vistos/buscados'),

        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('📊 Estatísticas do catálogo'),

        new SlashCommandBuilder()
            .setName('gerarinfo')
            .setDescription('🤖 IA gera descrição e imagem dos jogos (Admin)')
            .addStringOption(option =>
                option.setName('jogo')
                    .setDescription('Um jogo específico (deixe vazio para preencher todos que faltam)')
                    .setRequired(false)
                    .setAutocomplete(true))
            .addBooleanOption(option =>
                option.setName('refazer')
                    .setDescription('Gerar de novo mesmo que o jogo já tenha descrição/imagem')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('editarinfo')
            .setDescription('✏️ Editar descrição/imagem de um jogo manualmente (Admin)')
            .addStringOption(option =>
                option.setName('jogo')
                    .setDescription('Nome do jogo')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('descricao')
                    .setDescription('Nova descrição (até 600 caracteres)')
                    .setRequired(false)
                    .setMaxLength(600))
            .addStringOption(option =>
                option.setName('imagem')
                    .setDescription('URL da nova imagem (https://...)')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('ajuda')
            .setDescription('❓ Ver todos os comandos disponíveis'),
    ];
}

module.exports = { buildCommands };
