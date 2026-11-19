require('dotenv').config();

const DEFAULT_SUBCATEGORIES = {
    dlc: '🧩 DLC',
    disco1: '💿 Disco 1',
    disco2: '💿 Disco 2',
    parte1: '1️⃣ Parte 1',
    parte2: '2️⃣ Parte 2',
    parte3: '3️⃣ Parte 3',
    parte4: '4️⃣ Parte 4',
};

// Para adicionar outra categoria no futuro, basta incluir uma linha aqui.
const DEFAULT_CATEGORIES = {
    xex:   { label: 'XEX',        choice: '📦 XEX',        color: 0x5865F2, button: 'Primary' },
    god:   { label: 'GOD',        choice: '📀 GOD',        color: 0x57F287, button: 'Success' },
    ports: { label: 'PORTS XBOX', choice: '🕹️ Ports Xbox', color: 0xED4245, button: 'Danger' },
};

// Personalização sem mexer no código: defina CATEGORIES_JSON / SUBCATEGORIES_JSON no .env.
// Ex.: CATEGORIES_JSON={"pc":{"label":"PC","choice":"💻 PC","color":5793266,"button":"Primary"}}
// "button" aceita: Primary, Secondary, Success ou Danger. "color" é um número (decimal).
function loadJsonEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) return parsed;
        console.warn(`[config] ${name} precisa ser um objeto JSON não vazio; usando o padrão.`);
    } catch (err) {
        console.warn(`[config] ${name} não é um JSON válido (${err.message}); usando o padrão.`);
    }
    return fallback;
}

const SUBCATEGORIES = loadJsonEnv('SUBCATEGORIES_JSON', DEFAULT_SUBCATEGORIES);
const CATEGORIES = loadJsonEnv('CATEGORIES_JSON', DEFAULT_CATEGORIES);

const CATEGORY_CHOICES = Object.entries(CATEGORIES)
    .map(([value, c]) => ({ name: c.choice, value }));

const LIST_CATEGORY_CHOICES = [
    ...CATEGORY_CHOICES,
    { name: '🎮 Todos', value: 'todos' },
];

function subcategoryLabel(sub) {
    return sub ? (SUBCATEGORIES[sub] || sub) : null;
}

function subcategoryChoices() {
    return Object.entries(SUBCATEGORIES).map(([value, name]) => ({ name, value }));
}

function categoryLabel(cat) {
    if (!cat) return '???';
    return CATEGORIES[cat] ? CATEGORIES[cat].label : cat.toUpperCase();
}

function categoryColor(cat) {
    return CATEGORIES[cat] ? CATEGORIES[cat].color : 0x0099FF;
}

// Nome do estilo de botão do discord.js (ButtonStyle[nome])
function categoryButtonStyle(cat) {
    return CATEGORIES[cat] ? CATEGORIES[cat].button : 'Secondary';
}

const envPasswords = (process.env.DOWNLOAD_PASSWORDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

module.exports = {
    token: process.env.DISCORD_TOKEN,
    guildId: process.env.GUILD_ID,
    port: Number(process.env.PORT) || 8080,
    mongoUri: process.env.MONGODB_URI,
    mongoDb: process.env.MONGODB_DB || 'discord_bot',
    adminRoleId: process.env.GAME_ADMIN_ROLE_ID,
    newGameChannelId: process.env.NEW_GAME_CHANNEL_ID,
    suggestionChannelId: process.env.SUGGESTION_CHANNEL_ID,

    // IA / metadados (todos opcionais)
    // Qualquer IA compatível com o formato da OpenAI (Groq, Gemini, OpenRouter, Ollama, etc.)
    aiKey: process.env.AI_API_KEY,
    aiUrl: process.env.AI_API_URL,
    aiModel: process.env.AI_MODEL,
    // Limite de chamadas à IA por minuto (planos grátis são baixos; Gemini grátis ~5-15)
    aiRpm: Number(process.env.AI_REQUESTS_PER_MINUTE) || 8,
    // Opcional ('low', 'medium'...): reduz o "pensamento" de modelos que raciocinam e acelera a resposta
    aiReasoning: process.env.AI_REASONING_EFFORT || null,
    // Opcional: Claude (Anthropic), usado só se AI_API_KEY/AI_API_URL não estiverem definidos
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
    rawgKey: process.env.RAWG_API_KEY,
    // Senhas de arquivos compactados (opcional). Defina DOWNLOAD_PASSWORDS=senha1,senha2 no .env
    passwords: envPasswords,

    SUBCATEGORIES,
    CATEGORY_CHOICES,
    LIST_CATEGORY_CHOICES,
    subcategoryLabel,
    subcategoryChoices,
    categoryLabel,
    categoryColor,
    categoryButtonStyle,
    CATEGORIES,
};
