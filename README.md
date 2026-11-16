# Aniversários Automatizados — Ministério de Mídia

[![CI](https://github.com/ssiury/AniversariosAutomatizados/actions/workflows/ci.yml/badge.svg)](https://github.com/ssiury/AniversariosAutomatizados/actions/workflows/ci.yml)

Sistema que, no dia do aniversário de cada membro, gera uma arte personalizada (com foto, nome e
mensagem) e a posta no grupo do WhatsApp do ministério. Inclui um painel web para cadastrar membros,
editar os 3 templates de arte, acompanhar o histórico de envios e configurar o WhatsApp.

A arquitetura completa (decisões, módulos, modelo de dados, fluxos, segurança e operação) está em
[`docs/arquitetura.md`](docs/arquitetura.md).

## Visão geral

- **Monólito modular** em Node.js 22 + Express 5, um processo e um deploy.
- **Telas renderizadas no servidor** com [Eta](https://eta.js.org) e [htmx](https://htmx.org), sem SPA e sem build.
- **SQLite** (`better-sqlite3`) com migrações `.sql` versionadas, e a pasta `storage/` para as imagens.
- **WhatsApp embutido** com [Baileys](https://github.com/WhiskeySockets/Baileys) (conexão por QR Code).
- **Artes** geradas com [sharp](https://sharp.pixelplumbing.com) (JPEG 1080×1350).
- **Docker + Caddy** na VM e2-micro gratuita do Google Cloud, com HTTPS automático e imagem publicada pelo CI.
- **Monitoramento** por healthchecks.io e **backup** diário enviado para fora da VM.

## Módulos (`src/modulos/`)

| Módulo         | Responsabilidade                                                                     |
| -------------- | ------------------------------------------------------------------------------------ |
| `membros`      | Cadastro, validação e campos calculados (idade, próximo aniversário, template)       |
| `templates`    | Regra de escolha do template, legenda e edição dos templates                         |
| `configuracao` | Ajustes do painel (grupo, horário, idade limite, nome do ministério)                 |
| `disparo`      | Ciclo diário, "Enviar agora" e histórico: decide quem recebe, gera, envia e registra |
| `painel`       | Login, dashboard e histórico                                                         |
| `arte`         | Gerador da imagem (fundo, foto circular ou iniciais, textos)                         |
| `whatsapp`     | Conexão Baileys, QR Code, reconexão e envio                                          |
| `agendador`    | Roda o ciclo a cada 15 min e logo após o WhatsApp conectar                           |
| `monitor`      | Avisa o monitor externo do resultado de cada ciclo                                   |

Cada módulo expõe só o seu `index.js`. O ESLint garante que nenhum módulo use os internals de outro.

## Regras de negócio

**Escolha do template** (vale a primeira verdadeira):

1. Membro tem template fixo → template fixo
2. Idade no dia do aniversário < `idade_limite_infantil` (padrão 12) → Infantil
3. Sexo F → Feminino
4. Sexo M → Masculino

**Disparo**: a cada 15 minutos o ciclo verifica se o envio está ativo, se já passou do horário e se o
WhatsApp está conectado com um grupo definido. Para cada aniversariante ativo do dia, pula quem já
recebeu ou já falhou 3 vezes. Uma falha é registrada e o ciclo segue para o próximo; a nova tentativa
ocorre no ciclo seguinte. Um índice único no banco e uma trava compartilhada com o "Enviar agora"
impedem envio duplicado. Quem nasceu em 29/02 é homenageado em 28/02 nos anos não bissextos.

**Legenda do WhatsApp** aceita `{nome}`, `{idade}`, `{data}` e `{ministerio}`.

**"Enviar agora"** no cadastro: no dia do aniversário conta como o envio do dia; em outro dia é
registrado como `teste` e não interfere no envio automático.

## Desenvolvimento

Requer Node.js 22 (veja `.nvmrc`).

```bash
npm install
cp .env.example .env               # opcional em desenvolvimento
WHATSAPP_DESATIVADO=1 npm run dev  # sem WhatsApp
npm run dev                        # com WhatsApp: escaneie o QR em /configuracoes
```

Acesse <http://localhost:3000> (em desenvolvimento, usuário `admin` e senha `admin`).

| Comando                  | O que faz                                                  |
| ------------------------ | ---------------------------------------------------------- |
| `npm run verificar`      | Tudo o que o CI roda: lint, formatação, tipos e testes     |
| `npm test`               | Testes (`node:test`)                                       |
| `npm run test:cobertura` | Testes com relatório de cobertura                          |
| `npm run lint`           | ESLint, incluindo as regras de fronteira entre módulos     |
| `npm run format`         | Formata o código com o Prettier                            |
| `npm run typecheck`      | Checagem de tipos do JavaScript via JSDoc (`tsc --noEmit`) |

Para mudar o banco, crie o próximo arquivo em `src/compartilhado/banco/migracoes/`
(ex.: `003_descricao.sql`). Nunca altere uma migração já publicada.

## Deploy na VM e2-micro (Google Cloud, camada gratuita)

1. Crie uma VM **e2-micro** em `us-west1`, `us-central1` ou `us-east1` (regiões gratuitas), com Debian 12
   e disco padrão de 30 GB. Libere as portas 80 e 443 no firewall ("Permitir tráfego HTTP/HTTPS").
2. Aponte um domínio para o IP externo da VM (um subdomínio gratuito do DuckDNS funciona).
3. Se o pacote da imagem no GitHub for privado, autentique a VM no GHCR com um token que tenha
   apenas `read:packages`:

   ```bash
   echo "$TOKEN" | sudo docker login ghcr.io -u ssiury --password-stdin
   ```

4. Na VM:

   ```bash
   git clone git@github.com:ssiury/AniversariosAutomatizados.git
   cd AniversariosAutomatizados
   bash deploy/instalar-vm.sh     # cria swap, instala Docker e gera o .env
   nano .env                      # defina ADMIN_SENHA, SESSAO_SEGREDO, DOMINIO e MONITOR_URL
   bash deploy/instalar-vm.sh     # baixa a imagem e sobe app + Caddy
   ```

5. Entre no painel, vá em **Configurações**, escaneie o QR Code com o WhatsApp que vai postar,
   escolha o grupo, o horário e salve.

### Atualização e rollback

Cada push na `main` que passa no CI publica a imagem `ghcr.io/ssiury/aniversariosautomatizados`
com as tags `latest` e `sha-<commit>`.

```bash
bash deploy/atualizar.sh               # última versão
bash deploy/atualizar.sh sha-1a2b3c4   # versão específica (rollback)
bash deploy/atualizar.sh --build       # compila na própria VM, sem CI
```

### Monitoramento

1. Crie um check em [healthchecks.io](https://healthchecks.io) (gratuito) com **período de 15 min**
   e **tolerância de 30 min**, e configure o alerta por e-mail ou Telegram.
2. Coloque a URL de ping em `MONITOR_URL` no `.env` e rode `bash deploy/atualizar.sh`.

Você recebe um alerta se o sistema parar, se um envio falhar ou se o WhatsApp desconectar.

### Backup

```bash
crontab -e
# 0 3 * * * /home/USUARIO/AniversariosAutomatizados/deploy/backup.sh >> /home/USUARIO/AniversariosAutomatizados/backups/backup.log 2>&1
```

O backup fica em `backups/` por 30 dias. Para também copiá-lo para fora da VM, instale e configure
o rclone (`sudo apt install rclone && rclone config`) e defina `BACKUP_REMOTO` no `.env`
(ex.: `gcs:meu-bucket/aniversarios`).

## Estrutura

```
src/
  server.js              inicialização (config, banco, HTTP, WhatsApp, agendador)
  app.js                 Express: segurança, logs, sessão, rotas
  config.js              variáveis de ambiente, com validação
  compartilhado/         banco (conexão + migrações .sql), datas, logger, views, upload
  modulos/               os módulos descritos acima (index · rotas · servico · repositorio)
views/                   telas Eta, uma pasta por módulo
public/                  CSS
test/                    unidade/ e integracao/ (node:test + supertest)
deploy/                  Caddyfile e scripts da VM (instalação, atualização, backup)
docs/                    arquitetura
storage/                 dados em tempo de execução (fora do git)
```

## Pergunta em aberto

Até que idade a arte é infantil? O padrão é **abaixo de 12 anos**, ajustável em Configurações.
Por isso a data de nascimento é obrigatória com o ano completo.
