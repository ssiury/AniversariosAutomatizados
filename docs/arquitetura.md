# Arquitetura — Aniversários do Ministério de Mídia

Nov 12, 2026 · @Iury Sousa dos Santos

## Visão geral

Um único processo Node.js, rodando numa VM e2-micro gratuita do Google Cloud, lista os membros, escolhe entre 3 templates de arte e posta a imagem com uma mensagem no grupo do WhatsApp no dia de cada aniversário.

**Requisitos**

| Requisito | Como o sistema atende |
| --- | --- |
| Listar membros com nome, data de nascimento, sexo e ativo | Tela de membros com busca e filtros. A foto também é cadastrada, porque vai na arte |
| 3 templates de arte: masculino, feminino e infantil | Tabela `template` com fundo, cor e textos de cada um, editáveis no painel |
| No aniversário, disparar a arte com a foto e uma mensagem | Agendador + módulo de disparo + WhatsApp embutido, com registro de cada envio |
| Dashboard | Página inicial com os aniversariantes do dia, os próximos, os totais e os últimos envios |

**Decisões principais**

- **Monólito modular**: um processo e um deploy, com módulos separados por responsabilidade. Uma pessoa mantém, e a infra tem 1 GB de RAM.
- **Node.js + Express**: a biblioteca do WhatsApp (Baileys) só existe em JavaScript, então tudo roda junto, sem um segundo serviço.
- **Telas renderizadas no servidor** com templates Eta e htmx para interatividade pontual. Não há SPA nem build.
- **SQLite** para os dados e a pasta `storage/` para fotos, fundos, artes geradas e a sessão do WhatsApp.
- **Docker + Caddy** na VM, com HTTPS automático e gratuito.

**Pergunta em aberto:** até que idade a arte é infantil? A proposta é abaixo de 12 anos, configurável no painel. Para isso, a data de nascimento precisa ter o ano completo.

## Modelo de arquitetura

A aplicação é um monólito modular: 8 módulos num único processo Node.js, atrás do Caddy, numa VM e2-micro gratuita.

&#91;embedded content: arquitetura · 8 módulos num processo\]

A equipe usa o painel pelo navegador. O agendador aciona o disparo, que pede a arte ao gerador (com a foto do membro e o fundo do template) e a entrega pelo WhatsApp embutido. Todos os módulos leem e gravam na camada de dados.

Cada módulo é uma pasta com uma interface pequena. O envio, por exemplo, só expõe `enviarImagem` e `listarGrupos`. Se um dia precisar trocar o WhatsApp embutido por outra solução, só esse módulo muda.

## Modelo lógico

São 4 tabelas: `membro` e `template` guardam o cadastro, `envio` registra cada disparo, e `configuracao` guarda os ajustes do painel.

&#91;embedded content: modelo lógico · 4 tabelas\]

Um membro tem muitos envios (um por aniversário e tentativa), e um template aparece em muitos envios. O template fixo é uma ligação opcional do membro direto com um template.

**membro**

| Campo | Tipo | Regras |
| --- | --- | --- |
| id | INTEGER | Chave primária |
| nome | TEXT | Obrigatório |
| data\_nascimento | DATE | Obrigatório, AAAA-MM-DD com ano completo (a idade decide o template infantil) |
| sexo | CHAR(1) | `M` ou `F` |
| ativo | BOOLEAN | Padrão verdadeiro. Inativo não recebe arte |
| foto | TEXT | Opcional. Caminho em `storage/`. Sem foto, a arte mostra as iniciais |
| template\_fixo\_id | INTEGER | Opcional. FK para `template`, para exceções à regra |
| criado\_em, atualizado\_em | DATETIME | Preenchidos pelo sistema |

**template**

| Campo | Tipo | Regras |
| --- | --- | --- |
| id | INTEGER | Chave primária |
| tipo | TEXT | Único: `masculino`, `feminino` ou `infantil` |
| nome | TEXT | Nome exibido no painel |
| fundo | TEXT | Opcional. Imagem 1080×1350 px em `storage/` |
| cor\_destaque | TEXT | Cor do anel da foto e do título, em hexadecimal |
| mensagem\_arte | TEXT | Frase escrita na imagem, até 2 linhas |
| legenda | TEXT | Mensagem do WhatsApp. Aceita `{nome}`, `{idade}`, `{data}` e `{ministerio}` |
| atualizado\_em | DATETIME | Preenchido pelo sistema |

**envio**

| Campo | Tipo | Regras |
| --- | --- | --- |
| id | INTEGER | Chave primária |
| membro\_id | INTEGER | FK para `membro`, apagado junto com o membro |
| template\_id | INTEGER | FK para `template`: qual arte foi usada |
| data\_aniversario | DATE | Dia do aniversário a que o envio se refere |
| status | TEXT | `enviado`, `falhou` ou `teste` |
| tentativa | INTEGER | 1, 2 ou 3. Depois de 3 falhas no dia, desiste |
| detalhe | TEXT | ID da mensagem ou o erro |
| arquivo\_arte | TEXT | Caminho da imagem gerada |
| criado\_em | DATETIME | Momento do envio |

Índice em (`membro_id`, `data_aniversario`): é ele que impede enviar duas vezes no mesmo dia.

**configuracao** guarda pares chave → valor: `envio_ativo`, `grupo_whatsapp`, `horario_envio`, `idade_limite_infantil` e `nome_ministerio`.

## Regra de escolha do template

A idade decide primeiro e o sexo decide depois: quem tem menos de 12 anos recebe o infantil, e os demais recebem o masculino ou o feminino.

As condições são conferidas nesta ordem, e vale a primeira verdadeira:

| Ordem | Condição | Template |
| --- | --- | --- |
| 1 | O membro tem um template fixo escolhido no cadastro | O template fixo |
| 2 | Idade no dia do aniversário < `idade_limite_infantil` (padrão 12) | Infantil |
| 3 | Sexo = F | Feminino |
| 4 | Sexo = M | Masculino |

- **Idade** = anos completos na data do aniversário, calculada a partir de `data_nascimento`.
- **Template fixo** é opcional. Serve para exceções, como um adolescente de 11 anos que prefere a arte de adulto.
- **Template sem fundo cadastrado**: a arte usa o fundo padrão do sistema com a cor de destaque do template, e o envio não falha por isso.

## Fluxograma do disparo

A cada 15 minutos, depois do horário configurado, o sistema percorre os aniversariantes do dia e envia uma arte para cada um que ainda não recebeu.

&#91;embedded content: disparo diário · 5 decisões\]

Quem já recebeu no dia, ou já falhou 3 vezes, é pulado. Uma falha não trava o ciclo: o sistema registra, passa para o próximo aniversariante e tenta de novo no ciclo seguinte. O mesmo caminho também faz o servidor recuperar o envio do dia se ele reiniciar depois do horário.

## Telas

O painel tem 6 telas, todas atrás de login, e o dashboard é a página inicial.

| Rota | Tela | O que mostra e faz |
| --- | --- | --- |
| `/` | Dashboard | Os indicadores listados abaixo |
| `/membros` | Lista de membros | Colunas: nome, data de nascimento, idade, sexo, ativo e o template que ele vai receber. Busca por nome e filtros por sexo, situação e mês |
| `/membros/novo` e `/membros/:id` | Cadastro do membro | Nome, data de nascimento, sexo, ativo, foto e template fixo opcional. Prévia da arte e botão "Enviar agora" |
| `/templates` | Templates | Os 3 templates lado a lado: fundo, cor de destaque, frase da arte e mensagem do WhatsApp. Prévia com um membro de exemplo |
| `/historico` | Histórico | Todos os envios: data, membro, template, status, tentativa e link da arte |
| `/configuracoes` | Configurações | QR Code do WhatsApp, grupo de destino, horário do envio, idade limite do infantil e nome do ministério |

**Indicadores do dashboard**

- **Aniversariantes de hoje**: cada um com a prévia da arte, o template escolhido e o status do envio (aguardando, enviado ou falhou).
- **Próximos 7 dias**: nome, data e quantos dias faltam.
- **Aniversariantes do mês**: quantidade e lista.
- **Membros**: total de ativos e inativos.
- **Membros por template**: quantos receberão a arte masculina, a feminina e a infantil.
- **Saúde do sistema**: WhatsApp conectado ou não, grupo configurado, horário do próximo envio.
- **Últimos envios**: os 5 mais recentes, com as falhas em destaque.
