# Aniversários Automatizados — Ministério de Mídia

Sistema que, no dia do aniversário de cada membro, gera uma arte personalizada (com foto, nome e
mensagem) e a posta no grupo do WhatsApp do ministério. Inclui um painel web para cadastrar membros,
editar os 3 templates de arte, acompanhar o histórico de envios e configurar o WhatsApp.

A arquitetura completa está em [`docs/arquitetura.md`](docs/arquitetura.md).

## Visão geral

- **Monólito modular** em Node.js 22 + Express, um processo e um deploy.
- **Telas renderizadas no servidor** com [Eta](https://eta.js.org) e [htmx](https://htmx.org) — sem SPA e sem build.
- **SQLite** (`better-sqlite3`) e a pasta `storage/` para fotos, fundos, artes geradas e sessão do WhatsApp.
- **WhatsApp embutido** com [Baileys](https://github.com/WhiskeySockets/Baileys) (conexão por QR Code).
- **Artes** geradas com [sharp](https://sharp.pixelplumbing.com) (JPEG 1080×1350).
- **Docker + Caddy** na VM e2-micro gratuita do Google Cloud, com HTTPS automático.

## Módulos (`src/modulos/`)

| Módulo      | Responsabilidade                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `dados`     | SQLite: migrações, valores padrão e repositórios (`membros`, `templates`, `envios`, `configuracao`) |
| `membros`   | Validação do cadastro, listagem com idade/template calculados e rotas `/membros`                    |
| `templates` | Regra de escolha do template, montagem da legenda e rotas `/templates`                              |
| `arte`      | Gerador da imagem (fundo, foto circular ou iniciais, textos)                                        |
| `whatsapp`  | Conexão Baileys. Expõe só `enviarImagem` e `listarGrupos` (+ `status`, `iniciar`, `desconectar`)    |
| `disparo`   | Ciclo diário: decide quem recebe, gera, envia e registra cada tentativa                             |
| `agendador` | Roda o ciclo a cada 15 min e logo após o WhatsApp conectar                                          |
| `painel`    | Login, dashboard, histórico e configurações                                                         |

## Regras de negócio

**Escolha do template** (vale a primeira verdadeira):

1. Membro tem template fixo → template fixo
2. Idade no dia do aniversário < `idade_limite_infantil` (padrão 12) → Infantil
3. Sexo F → Feminino
4. Sexo M → Masculino

**Disparo** — a cada 15 minutos o ciclo verifica: envio ativo? já passou do horário? WhatsApp
conectado e grupo definido? Para cada aniversariante ativo do dia: já recebeu hoje? já falhou 3 vezes?
Uma falha é registrada e o ciclo segue para o próximo; a nova tentativa ocorre no ciclo seguinte.
Um índice único parcial em `envio(membro_id, data_aniversario) WHERE status = 'enviado'` impede envio duplicado.
Quem nasceu em 29/02 é homenageado em 28/02 nos anos não bissextos.

**Legenda do WhatsApp** aceita `{nome}`, `{idade}`, `{data}` e `{ministerio}`.

**"Enviar agora"** no cadastro: no dia do aniversário conta como o envio do dia; em outro dia é
registrado como `teste` e não interfere no envio automático.

## Rodando localmente

```bash
npm install
cp .env.example .env               # opcional em desenvolvimento
WHATSAPP_DESATIVADO=1 npm run dev  # sem WhatsApp
npm run dev                        # com WhatsApp: escaneie o QR em /configuracoes
```

Acesse <http://localhost:3000> (em desenvolvimento, usuário `admin` e senha `admin`).

Testes:

```bash
npm test
```

## Deploy na VM e2-micro (Google Cloud, camada gratuita)

1. Crie uma VM **e2-micro** em `us-west1`, `us-central1` ou `us-east1` (regiões gratuitas), com Debian 12
   e disco padrão de 30 GB. Libere as portas 80 e 443 no firewall ("Permitir tráfego HTTP/HTTPS").
2. Aponte um domínio para o IP externo da VM (um subdomínio gratuito do DuckDNS funciona).
3. Na VM:

   ```bash
   git clone git@github.com:ssiury/AniversariosAutomatizados.git
   cd AniversariosAutomatizados
   bash deploy/instalar-vm.sh     # cria swap, instala Docker e gera o .env
   nano .env                      # defina ADMIN_SENHA, SESSAO_SEGREDO e DOMINIO
   bash deploy/instalar-vm.sh     # sobe app + Caddy
   ```

4. Entre no painel, vá em **Configurações**, escaneie o QR Code com o WhatsApp que vai postar,
   escolha o grupo, o horário e salve.

Atualizar: `git pull && sudo docker compose up -d --build`.
Backup diário: `deploy/backup.sh` (copia o banco e as imagens para `backups/`).

## Estrutura

```
src/
  server.js        inicialização (banco, WhatsApp, agendador, HTTP)
  app.js           Express: sessão, rotas, arquivos estáticos
  config.js        variáveis de ambiente
  lib/             datas, views (Eta), upload
  modulos/         os 8 módulos descritos acima
views/             telas Eta
public/            CSS
storage/           dados em tempo de execução (fora do git)
deploy/            Caddyfile e scripts da VM
test/              testes (node:test)
```

## Pergunta em aberto

Até que idade a arte é infantil? O padrão é **abaixo de 12 anos**, ajustável em Configurações.
Por isso a data de nascimento é obrigatória com o ano completo.
