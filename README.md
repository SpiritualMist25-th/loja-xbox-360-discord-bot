# Bot de Catálogo de Jogos para Discord

Bot em Node.js ([discord.js](https://discord.js.org) v14) para organizar um catálogo de jogos dentro de um servidor do Discord. Os admins cadastram jogos por **categoria** e **subcategoria**, e os membros buscam, veem detalhes, favoritam e sugerem novos jogos. O bot ainda pode preencher **capa e descrição** automaticamente.

> Este repositório contém apenas o código do bot. Ele não inclui nem hospeda nenhum conteúdo: os links cadastrados são de responsabilidade de quem administra o servidor. Cadastre somente conteúdo que você tem direito de compartilhar.

## Sumário

1. [Recursos](#recursos)
2. [Comandos](#comandos)
3. [Requisitos](#requisitos)
4. [Passo 1: criar o bot no Discord](#passo-1-criar-o-bot-no-discord)
5. [Passo 2: instalar e rodar](#passo-2-instalar-e-rodar)
6. [Passo 3: configurar o `.env`](#passo-3-configurar-o-env)
7. [Banco de dados (MongoDB)](#banco-de-dados-mongodb)
8. [Capas e descrições automáticas (IA)](#capas-e-descrições-automáticas-ia)
9. [Personalizar categorias e subcategorias](#personalizar-categorias-e-subcategorias)
10. [Deixar o bot online 24h](#deixar-o-bot-online-24h)
11. [Problemas comuns](#problemas-comuns)
12. [Estrutura do projeto](#estrutura-do-projeto)
13. [Testes](#testes)
14. [Licença](#licença)

## Recursos

- Cadastro de jogos com categoria e subcategoria (DLC, disco, parte etc.).
- Busca por várias palavras, com autocomplete e paginação por botões.
- Favoritos por usuário.
- Sugestões da comunidade, com botões de **aprovar** e **rejeitar** para os admins.
- Aviso automático em um canal quando um jogo novo entra no catálogo.
- Capa e descrição automáticas (RAWG, Steam, Wikipedia e IA opcional), com edição manual.
- Estatísticas e ranking dos jogos mais vistos e buscados.
- Armazenamento em MongoDB ou em arquivos `.json` locais.
- Tudo configurável pelo `.env`, sem mexer no código.

## Comandos

### Para todos os membros

| Comando | O que faz |
| --- | --- |
| `/buscar jogo [categoria] [subcategoria]` | Busca um jogo pelo nome (várias palavras, com autocomplete) |
| `/listar [categoria]` | Lista os jogos do catálogo, com paginação |
| `/info jogo` | Mostra os detalhes e o link de download de um jogo |
| `/favoritos adicionar` / `remover` / `lista` | Gerencia seus jogos favoritos |
| `/sugerir nome link categoria [subcategoria]` | Sugere um jogo para os admins avaliarem |
| `/top` | Jogos mais vistos e mais buscados |
| `/stats` | Estatísticas do catálogo |
| `/ajuda` | Lista os comandos |

### Só para admins

Quem tem a permissão **Administrador** no servidor, ou o cargo definido em `GAME_ADMIN_ROLE_ID`.

| Comando | O que faz |
| --- | --- |
| `/addgame nome link categoria [subcategoria]` | Adiciona um jogo ao catálogo |
| `/removegame nome [categoria] [subcategoria]` | Remove um jogo |
| `/gerarinfo [jogo] [refazer]` | Gera descrição e imagem. Sem `jogo`, preenche todos que ainda não têm |
| `/editarinfo jogo [descricao] [imagem]` | Edita a descrição (até 600 caracteres) e/ou a imagem manualmente |

Também são admins os botões **Aprovar** e **Rejeitar** que aparecem no canal de sugestões.

## Requisitos

- **Node.js 18 ou superior** (baixe em https://nodejs.org)
- **Git** (para clonar o repositório)
- Uma conta no Discord com permissão para criar um bot
- *(Opcional)* Uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/atlas) para guardar os dados de forma permanente

## Passo 1: criar o bot no Discord

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications) e clique em **New Application**. Dê um nome e confirme.
2. No menu lateral, abra **Bot**.
3. Clique em **Reset Token** e copie o token. Ele vai para `DISCORD_TOKEN` no `.env`. **Nunca compartilhe nem publique o token.**
4. Ainda na aba **Bot**, em **Privileged Gateway Intents**, ative **Message Content Intent** e salve. Sem isso o bot não consegue entrar (erro `Used disallowed intents`).
5. Para convidar o bot, abra **OAuth2 → URL Generator**:
   - Em **Scopes**, marque `bot` e `applications.commands`.
   - Em **Bot Permissions**, marque `View Channels`, `Send Messages`, `Embed Links` e `Read Message History`.
   - Copie a URL gerada no fim da página, abra no navegador e escolha o servidor.
6. Pegue os IDs de que vai precisar. No Discord, vá em **Configurações → Avançado** e ative o **Modo desenvolvedor**. Depois clique com o botão direito no servidor, num cargo ou num canal e escolha **Copiar ID**.

## Passo 2: instalar e rodar

```bash
git clone <url-do-seu-repositorio>
cd <pasta-do-repositorio>
npm install
cp .env.example .env     # no Windows: copy .env.example .env
```

Abra o arquivo `.env` e preencha pelo menos `DISCORD_TOKEN`, `GUILD_ID` e `GAME_ADMIN_ROLE_ID` (veja o [próximo passo](#passo-3-configurar-o-env)). Depois inicie:

```bash
npm start
```

Se tudo deu certo, o terminal mostra algo como `Bot online como NomeDoBot#0000` e `slash commands registrados`. Digite `/` no servidor e os comandos aparecem.

Para desenvolver com reinício automático ao salvar arquivos, use `npm run dev`.

## Passo 3: configurar o `.env`

O arquivo `.env` guarda todas as configurações e **não vai para o GitHub** (já está no `.gitignore`). O modelo completo está em [`.env.example`](.env.example).

### Obrigatórias

| Variável | Descrição |
| --- | --- |
| `DISCORD_TOKEN` | Token do bot (Passo 1) |

### Recomendadas

| Variável | Descrição |
| --- | --- |
| `GUILD_ID` | ID do servidor. Com ele, os comandos aparecem na hora. Sem ele, os comandos são globais e podem levar até cerca de 1 hora para aparecer |
| `GAME_ADMIN_ROLE_ID` | ID do cargo que pode usar os comandos de admin (quem tem permissão de Administrador já pode) |
| `MONGODB_URI` | Conexão do MongoDB. Sem ela o bot usa arquivos `.json` locais |
| `NEW_GAME_CHANNEL_ID` | Canal onde o bot avisa quando um jogo novo é adicionado |
| `SUGGESTION_CHANNEL_ID` | Canal que recebe as sugestões, com botões de aprovar e rejeitar. **Sem ele, o `/sugerir` não funciona** |

### Opcionais

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `MONGODB_DB` | Nome do banco no MongoDB | `discord_bot` |
| `DOWNLOAD_PASSWORDS` | Senhas de arquivos compactados mostradas no embed de download, separadas por vírgula. Vazio = não mostra | vazio |
| `STREAM_TEXT` | Texto do status "Transmitindo". Vazio = bot sem atividade | vazio |
| `STREAM_URL` | URL do status de transmissão (precisa ser twitch.tv ou youtube.com) | `https://www.twitch.tv/discord` |
| `PORT` | Porta do servidor HTTP interno | `8080` |
| `LOG_LEVEL` | `debug`, `info`, `warn` ou `error` | `info` |
| `DATA_DIR` | Pasta dos arquivos `.json` quando não usa MongoDB | pasta do projeto |
| `CATEGORIES_JSON` | Categorias personalizadas (veja [abaixo](#personalizar-categorias-e-subcategorias)) | categorias padrão |
| `SUBCATEGORIES_JSON` | Subcategorias personalizadas | subcategorias padrão |
| `CLEAR_GLOBAL_COMMANDS` | Coloque `true` **uma vez** se os comandos aparecerem duplicados, depois remova | `false` |

As variáveis de IA e capas estão na [seção própria](#capas-e-descrições-automáticas-ia).

### Exemplo de `.env` mínimo

```env
DISCORD_TOKEN=cole_o_token_aqui
GUILD_ID=123456789012345678
GAME_ADMIN_ROLE_ID=123456789012345678
SUGGESTION_CHANNEL_ID=123456789012345678
NEW_GAME_CHANNEL_ID=123456789012345678
```

## Banco de dados (MongoDB)

O bot guarda jogos, favoritos, sugestões e contadores. Há duas opções:

- **Arquivos `.json` locais** (padrão, sem configurar nada). Bom para testar no seu PC. **Não use em hospedagens que apagam os arquivos a cada reinício** (muitos planos grátis), porque você perderia tudo.
- **MongoDB** (recomendado para ficar online). Crie um cluster gratuito no [MongoDB Atlas](https://www.mongodb.com/atlas):
  1. Crie o cluster e um usuário de banco (nome e senha).
  2. Em **Network Access**, libere o IP de onde o bot vai rodar. Em hospedagens com IP variável, costuma-se liberar `0.0.0.0/0`.
  3. Em **Connect → Drivers**, copie a string de conexão (`mongodb+srv://...`), troque `<password>` pela senha do usuário e cole em `MONGODB_URI`.

As coleções e os índices são criados automaticamente. Se a conexão falhar, o bot avisa no log e cai para os arquivos locais.

**Remover duplicados.** Se o catálogo tiver jogos repetidos, rode `node dedupe-games.js`. O script mostra o que vai apagar e pede confirmação. Ele mantém o registro mais antigo de cada grupo e só funciona com MongoDB.

## Capas e descrições automáticas (IA)

Tudo aqui é opcional. O bot busca dados do jogo em fontes públicas na ordem **RAWG**, **Steam** e **Wikipedia**. Uma IA, se configurada, resume o texto em português. Sem IA, o bot usa o texto da própria fonte.

- **Capas melhores:** crie uma chave gratuita em https://rawg.io/apidocs e coloque em `RAWG_API_KEY`.
- **IA (qualquer provedor compatível com o formato da OpenAI):** defina `AI_API_KEY` e, conforme o provedor, `AI_API_URL` e `AI_MODEL`.

| Provedor | Configuração |
| --- | --- |
| Groq (padrão) | Só `AI_API_KEY` (modelo padrão `llama-3.1-8b-instant`) |
| Google Gemini | `AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `AI_API_KEY=...`, `AI_MODEL=gemini-2.5-flash-lite` |
| OpenRouter | `AI_API_URL=https://openrouter.ai/api/v1`, `AI_API_KEY=...`, `AI_MODEL=<modelo>:free` |
| Ollama (local) | `AI_API_URL=http://localhost:11434/v1`, `AI_MODEL=llama3.2` |
| Claude (Anthropic) | `ANTHROPIC_API_KEY=...` (usado só se `AI_API_KEY` e `AI_API_URL` estiverem vazios; modelo em `ANTHROPIC_MODEL`) |

Se definir `AI_API_URL`, o `AI_MODEL` passa a ser obrigatório. Outros ajustes: `AI_REQUESTS_PER_MINUTE` (padrão 8, planos grátis têm limite baixo) e `AI_REASONING_EFFORT` (`low` acelera modelos que "pensam" antes de responder).

**Como usar:** como admin, rode `/gerarinfo` para preencher todos os jogos que ainda não têm dados, ou `/gerarinfo jogo:Halo 3` para um só. Use `refazer:true` para gerar de novo. Se o resultado não ficou bom, ajuste na mão com `/editarinfo`.

## Personalizar categorias e subcategorias

Por padrão o bot vem com algumas categorias de exemplo (`xex`, `god`, `ports`) e subcategorias (DLC, discos e partes). Para trocar, defina no `.env` um JSON **em uma única linha**.

**Categorias:**

```env
CATEGORIES_JSON={"pc":{"label":"PC","choice":"💻 PC","color":5793266,"button":"Primary"},"console":{"label":"CONSOLE","choice":"🎮 Console","color":5763719,"button":"Success"}}
```

Cada categoria tem:

- a **chave** (`pc`), que é o identificador interno. Use letras minúsculas, sem espaço
- `label`: nome mostrado nos embeds
- `choice`: texto que aparece na lista de opções dos comandos
- `color`: cor do embed, como **número decimal** (por exemplo, `5793266` é `#5865F2`)
- `button`: estilo do botão, um entre `Primary`, `Secondary`, `Success` e `Danger`

**Subcategorias** (chave e texto exibido):

```env
SUBCATEGORIES_JSON={"dlc":"🧩 DLC","atualizacao":"🔄 Atualização"}
```

Depois de mudar, reinicie o bot. Os comandos são registrados de novo no início, e as novas opções aparecem. Se o JSON estiver inválido, o bot avisa no log e usa o padrão. Jogos já cadastrados com uma categoria que você removeu continuam no banco e aparecem com o nome da chave em maiúsculas.

## Deixar o bot online 24h

O bot precisa ficar rodando para responder. Escolha uma das opções.

### Opção A: VPS ou PC/servidor Linux com PM2 (recomendado)

[PM2](https://pm2.keymetrics.io) mantém o bot ligado, reinicia se cair e sobe junto com o sistema.

```bash
npm install -g pm2
pm2 start index.js --name bot-jogos
pm2 save
pm2 startup        # siga a instrução que ele imprimir, para iniciar no boot
```

Comandos úteis: `pm2 logs bot-jogos`, `pm2 restart bot-jogos`, `pm2 stop bot-jogos`, `pm2 status`.

Para atualizar o bot: `git pull && npm install && pm2 restart bot-jogos`.

### Opção B: Docker

O repositório já inclui um `Dockerfile`. Basta rodar:

```bash
docker build -t bot-jogos .
docker run -d --name bot-jogos --restart unless-stopped --env-file .env bot-jogos
```

Se não usar MongoDB, monte um volume para os dados não se perderem e aponte `DATA_DIR` para ele:

```bash
docker run -d --name bot-jogos --restart unless-stopped --env-file .env \
  -e DATA_DIR=/data -v bot-jogos-data:/data bot-jogos
```

### Opção C: hospedagens na nuvem (Render, Railway, Discloud e similares)

Os passos variam de plataforma para plataforma, mas a ideia é a mesma:

1. Envie o projeto para o GitHub (ou faça upload, conforme a plataforma).
2. Configure o comando de instalação como `npm install` e o de início como `npm start`.
3. Cadastre as variáveis do `.env` no painel da plataforma (**não** envie o arquivo `.env`).
4. **Use MongoDB.** Planos grátis costumam apagar os arquivos locais a cada reinício.
5. O bot abre um servidor HTTP na porta definida em `PORT` (padrão `8080`) e responde `200` na raiz. Plataformas que exigem uma porta aberta usam isso. Algumas hospedagens grátis colocam o serviço para dormir sem tráfego, e nesse caso um serviço de ping periódico na URL do serviço ajuda a mantê-lo acordado. Veja as regras de cada plataforma.

### Opção D: seu próprio PC (só para testar)

`npm start` funciona, mas o bot fica offline quando você fecha o terminal ou desliga o computador.

## Problemas comuns

| Sintoma | Causa e solução |
| --- | --- |
| `Used disallowed intents` ao iniciar | Ative **Message Content Intent** no Developer Portal (Passo 1, item 4) |
| `DISCORD_TOKEN não definido` | O `.env` não existe, está em outra pasta ou a variável está vazia |
| Token inválido no login | Gere um novo token em **Bot → Reset Token** e atualize o `.env` |
| Os comandos `/` não aparecem | Confira se convidou o bot com o scope `applications.commands`. Sem `GUILD_ID` pode demorar até cerca de 1 hora. Reinicie o bot e o Discord |
| Comandos aparecem duplicados | Rode uma vez com `CLEAR_GLOBAL_COMMANDS=true` e depois remova a linha |
| "Apenas admins..." para você | Dê a si mesmo o cargo de `GAME_ADMIN_ROLE_ID` ou a permissão de Administrador |
| `/sugerir` diz que não está configurado | Defina `SUGGESTION_CHANNEL_ID` com o ID de um canal de texto onde o bot possa enviar mensagens |
| Os jogos somem depois de reiniciar | Você está usando arquivos locais numa hospedagem que não os guarda. Configure `MONGODB_URI` |
| Não conecta no MongoDB | Confira usuário e senha, caracteres especiais da senha (codifique-os na URL) e a liberação de IP no Atlas |
| Capas e descrições não aparecem | Rode `/gerarinfo`. Para capas melhores, configure `RAWG_API_KEY`. Se usa IA, confira `AI_API_KEY`, `AI_API_URL` e `AI_MODEL` |
| Erros de limite (rate limit) na IA | Reduza `AI_REQUESTS_PER_MINUTE` ou troque de provedor |

Para ver mais detalhes nos logs, coloque `LOG_LEVEL=debug`.

## Estrutura do projeto

```
index.js            Inicialização, login, registro dos slash commands e servidor HTTP
dedupe-games.js     Script para remover duplicados do MongoDB
src/
  config.js         Leitura do .env, categorias e subcategorias
  commands.js       Definição dos slash commands
  handler.js        Lógica de cada comando e botão
  storage.js        Persistência (MongoDB ou arquivos .json)
  gameinfo.js       Busca de capa e descrição (RAWG, Steam, Wikipedia, IA)
  embeds.js         Montagem dos embeds
  notify.js         Avisos de jogo novo e envio de sugestões
  pagination.js     Paginação por botões
  searchstate.js    Estado temporário das buscas
  safe.js           Respostas seguras a interações
  logger.js         Logs com nível
tests/              Testes automatizados
```

## Testes

```bash
npm test
```

## Contribuindo

Pull requests são bem-vindos. Rode `npm test` antes de enviar e nunca inclua tokens, senhas ou o arquivo `.env`.

## Licença

MIT. Veja o arquivo [LICENSE](LICENSE) e troque `SpiritualMist25` pelo seu nome.
