// dedupe-games.js
// Remove jogos duplicados (mesmo nome + categoria + subcategoria) do MongoDB.
// Mantém sempre o registro mais antigo (menor addedAt) de cada grupo e apaga o resto.
//
// Como usar:
//   1) Coloque este arquivo na mesma pasta do index.js (onde está o .env)
//   2) Rode: node dedupe-games.js
//   3) Ele mostra o que vai apagar e pede confirmação antes de apagar de verdade.

require('dotenv').config();
const { MongoClient } = require('mongodb');
const readline = require('readline');

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer.trim().toLowerCase());
    }));
}

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI não encontrada no .env. Esse script só funciona com MongoDB.');
        process.exit(1);
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'discord_bot');
    const collection = db.collection('games');

    const games = await collection.find({}).toArray();
    console.log(`📊 Total de registros encontrados: ${games.length}`);

    // Agrupa por nome (case-insensitive) + categoria + subcategoria
    const groups = new Map();
    for (const g of games) {
        const key = `${(g.name || '').toLowerCase().trim()}|${g.category || ''}|${g.subcategory || 'null'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(g);
    }

    // Filtra só os grupos com mais de 1 registro (duplicados)
    const duplicateGroups = [...groups.values()].filter(group => group.length > 1);

    if (duplicateGroups.length === 0) {
        console.log('✅ Nenhum jogo duplicado encontrado. Nada a fazer.');
        await client.close();
        return;
    }

    let totalToDelete = 0;
    const idsToDelete = [];

    console.log(`\n⚠️  Encontrados ${duplicateGroups.length} jogo(s) com duplicatas:\n`);

    for (const group of duplicateGroups) {
        // Ordena por data de adição (mais antigo primeiro); se não tiver addedAt, mantém a ordem original
        const sorted = [...group].sort((a, b) => {
            const da = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            const db_ = b.addedAt ? new Date(b.addedAt).getTime() : 0;
            return da - db_;
        });

        const keep = sorted[0];
        const remove = sorted.slice(1);

        console.log(`🎮 ${keep.name} [${(keep.category || '').toUpperCase()}${keep.subcategory ? ' - ' + keep.subcategory : ''}]`);
        console.log(`   Mantém: id=${keep.id}  addedAt=${keep.addedAt || 'desconhecido'}`);
        remove.forEach(r => {
            console.log(`   Apaga:  id=${r.id}  addedAt=${r.addedAt || 'desconhecido'}`);
            idsToDelete.push(r.id);
        });
        totalToDelete += remove.length;
        console.log('');
    }

    console.log(`\n📌 Resumo: ${totalToDelete} registro(s) duplicado(s) serão apagados, mantendo ${duplicateGroups.length} jogo(s) únicos.\n`);

    const answer = await ask('Confirma a exclusão? Digite "sim" para continuar: ');

    if (answer !== 'sim') {
        console.log('❌ Cancelado. Nenhum dado foi apagado.');
        await client.close();
        return;
    }

    const result = await collection.deleteMany({ id: { $in: idsToDelete } });
    console.log(`✅ ${result.deletedCount} registro(s) duplicado(s) apagados com sucesso!`);

    await client.close();
}

main().catch(err => {
    console.error('❌ Erro ao rodar o script:', err);
    process.exit(1);
});
