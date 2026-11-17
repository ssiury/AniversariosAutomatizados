# Guia de Implantação — Google Cloud

| | |
| --- | --- |
| **Sistema** | Aniversários Automatizados — Ministério de Mídia |
| **Versão do documento** | 1.0 |
| **Última revisão** | 16/11/2026 |
| **Público** | Quem vai criar e manter a infraestrutura |
| **Tempo estimado** | 1 a 2 horas, na primeira vez |

> Este guia monta, do zero, toda a infraestrutura de produção no Google Cloud: projeto, rede, VM,
> domínio com HTTPS, aplicação, WhatsApp, monitoramento e backup externo. A arquitetura que ele
> implementa está descrita em [`arquitetura.md`](arquitetura.md), seção 5.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [GitHub: imagem e acesso](#3-github-imagem-e-acesso)
4. [Projeto no Google Cloud](#4-projeto-no-google-cloud)
5. [Rede: firewall e IP fixo](#5-rede-firewall-e-ip-fixo)
6. [Conta de serviço e bucket de backup](#6-conta-de-serviço-e-bucket-de-backup)
7. [Máquina virtual](#7-máquina-virtual)
8. [Domínio](#8-domínio)
9. [Preparação da VM](#9-preparação-da-vm)
10. [Instalação da aplicação](#10-instalação-da-aplicação)
11. [Configuração do WhatsApp](#11-configuração-do-whatsapp)
12. [Monitoramento](#12-monitoramento)
13. [Backup](#13-backup)
14. [Endurecimento do acesso SSH (recomendado)](#14-endurecimento-do-acesso-ssh-recomendado)
15. [Operação do dia a dia](#15-operação-do-dia-a-dia)
16. [Checklist final](#16-checklist-final)
17. [Solução de problemas](#17-solução-de-problemas)

---

## 1. Visão geral

### 1.1 O que será criado

| Recurso | Nome usado neste guia | Finalidade |
| --- | --- | --- |
| Projeto | `aniversarios-midia` | Agrupa todos os recursos e o faturamento |
| Alerta de orçamento | `Aniversarios` | Avisa por e-mail se surgir qualquer cobrança |
| Regra de firewall | `permitir-web` | Libera as portas 80 e 443 da VM |
| IP externo fixo | `aniversarios-ip` | Endereço estável para o domínio |
| Conta de serviço | `aniversarios-vm` | Identidade da VM, com acesso só ao bucket de backup |
| Bucket | `aniversarios-midia-backup` | Cópia externa diária do banco e das imagens |
| VM | `aniversarios` | e2-micro, Debian 12, disco padrão de 30 GB |
| Domínio | `aniversarios-midia.duckdns.org` | Endereço do painel, com HTTPS automático |
| Monitor | check no healthchecks.io | Alerta se o envio parar ou falhar |

Troque os nomes se quiser, mas mantenha-os consistentes em todos os comandos. O ID do projeto
precisa ser único no Google Cloud inteiro, então talvez você precise de um sufixo
(ex.: `aniversarios-midia-2026`).

### 1.2 Custos

O sistema foi dimensionado para a camada **Always Free** do Google Cloud.

| Item | Camada gratuita | Uso esperado |
| --- | --- | --- |
| VM e2-micro | 1 instância/mês em `us-west1`, `us-central1` ou `us-east1` | 1 instância em `us-east1` |
| Disco | 30 GB de disco **padrão** (`pd-standard`) | 30 GB `pd-standard` |
| Tráfego de saída | 1 GB/mês (América do Norte → demais destinos, exceto China e Austrália) | Algumas dezenas de MB (artes de ~200 KB) |
| Cloud Storage | 5 GB/mês em regiões dos EUA | Poucos MB por backup diário, retidos por 90 dias |

> [!WARNING]
> **IP externo.** O Google cobra por endereços IPv4 externos em uso (cerca de US$ 0,005 por hora,
> ou ~US$ 3,65/mês), e a documentação da camada gratuita é ambígua sobre a isenção para a e2-micro.
> Trate esse valor como o custo provável do sistema e confirme no relatório de faturamento depois
> dos primeiros dias (seção [4.3](#43-alerta-de-orçamento)).

> [!CAUTION]
> Três erros comuns geram cobrança: criar a VM fora das três regiões gratuitas, aceitar o disco
> **balanceado** sugerido pelo console (só o **padrão** é gratuito) ou criar uma segunda VM.
> Os comandos deste guia já evitam os três.

**Região escolhida:** `us-east1` (Carolina do Sul), a de menor latência para o Brasil entre as
três gratuitas.

---

## 2. Pré-requisitos

| Item | Observação |
| --- | --- |
| Conta Google | Será a dona do projeto. De preferência, uma conta do ministério e não pessoal |
| Cartão de crédito | Exigido pelo Google para ativar o faturamento, mesmo na camada gratuita |
| Acesso ao repositório no GitHub | Com permissão para ver Actions e Packages |
| Celular com o WhatsApp que vai publicar | De preferência um número dedicado (ver risco R-01 na arquitetura) |
| Google Cloud CLI (`gcloud`) | Instalado no seu computador, ou use o **Cloud Shell** no navegador, que já vem com ele |

Para instalar o `gcloud` localmente, siga <https://cloud.google.com/sdk/docs/install>. A forma mais
simples é usar o **Cloud Shell**: no console (<https://console.cloud.google.com>), clique no ícone
`>_` no canto superior direito.

Todos os comandos `gcloud` deste guia usam as variáveis abaixo. Defina-as uma vez por sessão do
terminal:

```bash
export PROJETO=aniversarios-midia        # ID do projeto (único no Google Cloud)
export REGIAO=us-east1
export ZONA=us-east1-b
export BUCKET=aniversarios-midia-backup  # nome do bucket (único no Google Cloud)
```

---

## 3. GitHub: imagem e acesso

A VM não compila a aplicação: ela baixa a imagem que o CI publica no GitHub Container Registry
(GHCR). Por isso, o primeiro passo é garantir que a imagem existe.

### 3.1 Publicar a imagem

1. Faça o merge do código na branch `main` e envie para o GitHub (`git push origin main`).
2. Em **GitHub → repositório → Actions**, aguarde o workflow **CI** terminar com sucesso. O job
   **Imagem Docker** publica `ghcr.io/ssiury/aniversariosautomatizados:latest`.
3. Confira em **GitHub → seu perfil → Packages** que o pacote `aniversariosautomatizados` aparece.

> [!NOTE]
> Se o job falhar com erro de permissão ao publicar, vá em **Settings → Actions → General →
> Workflow permissions** e marque **Read and write permissions**.

### 3.2 Token de leitura da imagem

O pacote herda a visibilidade do repositório. Se o repositório for **privado**, a VM precisa de um
token para baixar a imagem:

1. GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic)
   → Generate new token (classic)**.
2. Nome: `aniversarios-vm-ghcr`. Validade: a maior disponível. Escopo: **apenas `read:packages`**.
3. Guarde o token: ele será usado na seção [10.3](#103-autenticação-no-ghcr).

### 3.3 Chave de leitura do repositório

A VM precisa clonar o repositório para obter o `docker-compose.yml`, o `Caddyfile` e os scripts. Se
o repositório for privado, ela vai usar uma **deploy key** (somente leitura). A chave é gerada na
VM, na seção [9.3](#93-acesso-ao-repositório).

---

## 4. Projeto no Google Cloud

### 4.1 Criar o projeto

```bash
gcloud auth login                       # dispensável no Cloud Shell
gcloud projects create "$PROJETO" --name="Aniversarios Midia"
gcloud config set project "$PROJETO"
```

### 4.2 Vincular o faturamento e ativar as APIs

```bash
gcloud billing accounts list            # copie o ACCOUNT_ID (formato 0X0X0X-0X0X0X-0X0X0X)
gcloud billing projects link "$PROJETO" --billing-account=ACCOUNT_ID

gcloud services enable compute.googleapis.com storage.googleapis.com
```

Se ainda não houver conta de faturamento, crie uma em **Console → Faturamento → Criar conta**.

### 4.3 Alerta de orçamento

O alerta não limita gastos, mas avisa por e-mail assim que surgir qualquer cobrança.

1. Console → **Faturamento → Orçamentos e alertas → Criar orçamento**.
2. Nome: `Aniversarios`. Escopo: o projeto `aniversarios-midia`.
3. Valor: **R$ 30** (ou US$ 5). Limites de alerta: **50 %, 90 % e 100 %**.
4. Marque o envio de e-mail para os administradores de faturamento.

Depois de 2 ou 3 dias da VM no ar, abra **Faturamento → Relatórios**, filtre pelo projeto e
confirme o que está sendo cobrado (o esperado é zero, ou apenas o IP externo).

---

## 5. Rede: firewall e IP fixo

### 5.1 Liberar HTTP e HTTPS

A porta 80 é necessária para o Caddy emitir o certificado e redirecionar para HTTPS. A porta 443
UDP habilita HTTP/3.

```bash
gcloud compute firewall-rules create permitir-web \
  --network=default \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:80,tcp:443,udp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=web
```

### 5.2 Reservar o IP externo

Um IP reservado não muda quando a VM reinicia, então o domínio continua válido.

```bash
gcloud compute addresses create aniversarios-ip \
  --region="$REGIAO" \
  --network-tier=STANDARD

gcloud compute addresses describe aniversarios-ip --region="$REGIAO" --format='value(address)'
```

Anote o IP exibido: ele será usado no domínio.

O nível de rede **Standard** tem IP mais barato que o Premium (o padrão do Google), e a diferença
de latência é irrelevante para um painel com poucos acessos e um envio por dia.

> [!IMPORTANT]
> Um IP reservado que **não** esteja ligado a uma VM em execução é sempre cobrado. Se um dia apagar
> a VM, apague o IP também (`gcloud compute addresses delete aniversarios-ip --region="$REGIAO"`).

---

## 6. Conta de serviço e bucket de backup

A VM recebe uma identidade própria, sem nenhuma permissão no projeto, só com acesso de escrita ao
bucket de backup. Assim, mesmo que a VM seja comprometida, o invasor não alcança o resto da conta.

### 6.1 Conta de serviço

```bash
gcloud iam service-accounts create aniversarios-vm \
  --display-name="VM dos aniversarios"

export CONTA_VM="aniversarios-vm@${PROJETO}.iam.gserviceaccount.com"
```

### 6.2 Bucket

```bash
gcloud storage buckets create "gs://$BUCKET" \
  --location="$REGIAO" \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access \
  --public-access-prevention

# Apaga automaticamente os backups com mais de 90 dias.
cat > /tmp/ciclo-vida.json <<'EOF'
{ "rule": [ { "action": { "type": "Delete" }, "condition": { "age": 90 } } ] }
EOF
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=/tmp/ciclo-vida.json

# Só a conta da VM escreve no bucket.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$CONTA_VM" \
  --role=roles/storage.objectAdmin
```

O bucket fica na mesma região da VM, então a transferência entre os dois não tem custo de saída.

---

## 7. Máquina virtual

### 7.1 Criar a VM

```bash
gcloud compute instances create aniversarios \
  --zone="$ZONA" \
  --machine-type=e2-micro \
  --network-tier=STANDARD \
  --address=aniversarios-ip \
  --tags=web \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --service-account="$CONTA_VM" \
  --scopes=cloud-platform \
  --shielded-secure-boot \
  --shielded-vtpm \
  --shielded-integrity-monitoring \
  --metadata=enable-oslogin=TRUE
```

| Opção | Por quê |
| --- | --- |
| `e2-micro`, `us-east1-b` | Tipo e região da camada gratuita |
| `pd-standard`, 30 GB | O único disco gratuito, no tamanho máximo gratuito |
| `--address`, `--network-tier=STANDARD` | Usa o IP reservado na seção 5.2 |
| `--tags=web` | Aplica a regra de firewall da seção 5.1 |
| `--service-account` | Identidade mínima da seção 6.1 |
| `--scopes=cloud-platform` | Deixa as permissões a cargo do IAM, que só concede o bucket |
| `--shielded-*` | Inicialização verificada, contra rootkits |
| `enable-oslogin` | O acesso SSH segue as contas e permissões do Google, sem chaves soltas no projeto |

### 7.2 Conferir

```bash
gcloud compute instances describe aniversarios --zone="$ZONA" \
  --format='table(name,machineType.basename(),status,disks[0].diskSizeGb,networkInterfaces[0].accessConfigs[0].natIP)'
```

O tipo de máquina deve ser `e2-micro`, o status `RUNNING` e o IP igual ao reservado. Para conferir o
tipo do disco:

```bash
gcloud compute disks describe aniversarios --zone="$ZONA" --format='value(type.basename())'
# esperado: pd-standard
```

---

## 8. Domínio

O Caddy só emite o certificado HTTPS se o domínio já apontar para o IP da VM. Faça este passo antes
de instalar a aplicação.

### Opção A — subdomínio gratuito no DuckDNS

1. Acesse <https://www.duckdns.org> e entre com uma conta Google ou GitHub.
2. Em **sub domain**, crie `aniversarios-midia` (ou outro nome disponível).
3. No campo **current ip**, coloque o IP reservado na seção 5.2 e clique em **update ip**.

O domínio será `aniversarios-midia.duckdns.org`. Como o IP é reservado, não é preciso atualizá-lo
de novo.

### Opção B — domínio próprio

No painel do seu provedor de DNS, crie um registro:

| Tipo | Nome | Valor | TTL |
| --- | --- | --- | --- |
| A | `aniversarios` (ou `@`) | IP reservado | 300 |

### Conferir

```bash
dig +short aniversarios-midia.duckdns.org   # deve mostrar o IP reservado
```

A propagação costuma levar poucos minutos.

---

## 9. Preparação da VM

### 9.1 Acessar por SSH

```bash
gcloud compute ssh aniversarios --zone="$ZONA"
```

Na primeira vez, o `gcloud` gera uma chave SSH e a associa à sua conta Google (OS Login). O usuário
na VM é derivado do seu e-mail (ex.: `fulano_gmail_com`). **Todos os comandos das seções 9 a 13
rodam dentro da VM**, exceto onde indicado.

Para dar acesso SSH a outra pessoa, conceda a ela o papel **Compute OS Admin Login** no projeto
(IAM). Para revogar, basta remover o papel.

### 9.2 Atualizações automáticas de segurança

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y git unattended-upgrades dnsutils curl unzip
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
```

O `unattended-upgrades` aplica sozinho as correções de segurança do Debian.

Instale o rclone pelo instalador oficial. A versão do repositório do Debian é antiga e não usa a
identidade da VM para acessar o bucket:

```bash
curl -fsSL https://rclone.org/install.sh | sudo bash
rclone version    # 1.6x ou mais recente
```

### 9.3 Acesso ao repositório

**Repositório público:** pule para a seção 9.4 e clone com HTTPS.

**Repositório privado:** gere uma deploy key na VM.

```bash
ssh-keygen -t ed25519 -N "" -C "vm-aniversarios" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

No GitHub: **repositório → Settings → Deploy keys → Add deploy key**. Título: `VM Google Cloud`.
Cole a chave pública e **não** marque "Allow write access".

```bash
ssh -T git@github.com    # responda "yes"; a mensagem deve dizer que a chave foi autenticada
```

### 9.4 Clonar

```bash
cd ~
git clone git@github.com:ssiury/AniversariosAutomatizados.git      # privado
# git clone https://github.com/ssiury/AniversariosAutomatizados.git # público
cd AniversariosAutomatizados
```

---

## 10. Instalação da aplicação

### 10.1 Primeira execução do instalador

```bash
bash deploy/instalar-vm.sh
```

Nesta primeira execução, o script:

- cria 2 GB de swap;
- instala o Docker e adiciona seu usuário ao grupo `docker`;
- ajusta o fuso horário da VM para `America/Sao_Paulo`;
- cria o `.env` a partir do `.env.example` e para, pedindo que você o edite.

### 10.2 Preencher o `.env`

Gere os segredos:

```bash
echo "SESSAO_SEGREDO=$(openssl rand -hex 32)"
echo "ADMIN_SENHA=$(openssl rand -base64 18)"
```

Edite o arquivo:

```bash
nano .env
```

| Variável | Valor |
| --- | --- |
| `ADMIN_USUARIO` | O usuário do painel (ex.: `midia`) |
| `ADMIN_SENHA` | A senha gerada acima. **Guarde-a num gerenciador de senhas** |
| `SESSAO_SEGREDO` | O segredo gerado acima |
| `DOMINIO` | `aniversarios-midia.duckdns.org` |
| `MONITOR_URL` | Deixe para a seção 12 |
| `BACKUP_REMOTO` | Deixe para a seção 13 |

Salve com `Ctrl+O`, `Enter` e saia com `Ctrl+X`. Proteja o arquivo:

```bash
chmod 600 .env
```

### 10.3 Autenticação no GHCR

Só se o pacote for privado (seção 3.2). Cole o token quando o terminal pedir:

```bash
read -rs TOKEN && echo "$TOKEN" | sudo docker login ghcr.io -u ssiury --password-stdin; unset TOKEN
```

Sem esse login, o instalador não consegue baixar a imagem e compila a aplicação na própria VM,
o que funciona, mas leva vários minutos.

### 10.4 Subir a aplicação

```bash
bash deploy/instalar-vm.sh
```

Agora o script baixa a imagem do GHCR e sobe a aplicação e o Caddy. Se a imagem não estiver
acessível, ele compila na própria VM (alguns minutos, com o swap).

### 10.5 Conferir

```bash
sudo docker compose ps                    # app deve estar "healthy" e caddy "running"
sudo docker compose logs --tail=30 app    # sem erros de configuração
sudo docker compose logs --tail=30 caddy  # deve registrar "certificate obtained successfully"
```

No navegador, abra `https://aniversarios-midia.duckdns.org`. A página de login deve abrir com o
cadeado de HTTPS. Entre com o usuário e a senha do `.env`.

---

## 11. Configuração do WhatsApp

1. No painel, vá em **Configurações**.
2. No celular que vai publicar: **WhatsApp → Configurações → Dispositivos conectados → Conectar
   dispositivo**, e leia o QR Code da tela.
3. Quando a página recarregar, escolha o **grupo** de destino, o **horário de envio**, a **idade
   limite** da arte infantil e o **nome do ministério**. Salve.
4. Cadastre um membro de teste e use **Enviar agora** no cadastro dele. Fora do dia do aniversário,
   o envio é registrado como `teste` e não interfere no envio automático.
5. Confira a mensagem no grupo e o registro em **Histórico**.

> [!NOTE]
> A sessão do WhatsApp fica em `storage/whatsapp/` e sobrevive a reinícios e atualizações. Ela só
> precisa ser refeita se o aparelho for desconectado pelo próprio celular.

---

## 12. Monitoramento

O monitoramento avisa se o sistema parar, se um envio falhar ou se o WhatsApp desconectar.

1. Crie uma conta gratuita em <https://healthchecks.io>.
2. **Add Check** com:
   - Name: `Aniversarios`;
   - Schedule: **Simple**, Period **15 minutes**, Grace Time **30 minutes**.
3. Em **Integrations**, ative o e-mail (já vem ativo) e, se quiser, Telegram ou WhatsApp.
4. Copie a **Ping URL** (formato `https://hc-ping.com/<uuid>`).
5. Na VM, coloque a URL no `.env` e reinicie a aplicação:

   ```bash
   nano .env                         # MONITOR_URL=https://hc-ping.com/<uuid>
   sudo docker compose up -d
   ```

6. Em até 15 minutos, o check deve ficar verde (**Up**) no healthchecks.io.

**Teste do alerta:** pare a aplicação com `sudo docker compose stop app`. Depois do período mais a
tolerância (até 45 minutos), o check fica vermelho (**Down**) e o alerta chega. Suba de novo com
`sudo docker compose start app` e confirme que o check volta para **Up**.

Não use o botão **Desconectar** do painel para esse teste: ele encerra a sessão do WhatsApp, e
seria preciso ler o QR Code de novo.

---

## 13. Backup

O `deploy/backup.sh` faz uma cópia consistente do banco e das imagens em `backups/` (30 dias) e,
com `BACKUP_REMOTO` definido, a envia para o bucket.

### 13.1 Configurar o rclone

O rclone usa a identidade da própria VM (seção 6), então não há chave para guardar:

```bash
rclone config create gcs "google cloud storage" \
  env_auth=true bucket_policy_only=true location=us-east1 storage_class=STANDARD

rclone lsd gcs:aniversarios-midia-backup   # não deve dar erro (o bucket ainda está vazio)
```

### 13.2 Ativar o envio externo

```bash
echo "BACKUP_REMOTO=gcs:aniversarios-midia-backup" >> .env
```

### 13.3 Testar

```bash
bash deploy/backup.sh
ls backups/
rclone ls gcs:aniversarios-midia-backup
```

Devem aparecer `dados.sqlite` e `imagens.tar.gz` na pasta do dia, tanto localmente quanto no bucket.

### 13.4 Agendar

```bash
crontab -e
```

Adicione a linha abaixo (backup diário às 03:00, horário de Brasília):

```cron
0 3 * * * $HOME/AniversariosAutomatizados/deploy/backup.sh >> $HOME/AniversariosAutomatizados/backups/backup.log 2>&1
```

### 13.5 Restauração

Faça um teste de restauração logo após a implantação. Backup que nunca foi restaurado não é backup
confiável.

```bash
cd ~/AniversariosAutomatizados
sudo docker compose stop app
DIA=AAAA-MM-DD                              # pasta do backup a restaurar
rclone copy "gcs:aniversarios-midia-backup/$DIA" "backups/$DIA"   # se não estiver local
sudo cp "backups/$DIA/dados.sqlite" storage/dados.sqlite
sudo rm -f storage/dados.sqlite-wal storage/dados.sqlite-shm
sudo tar -xzf "backups/$DIA/imagens.tar.gz" -C storage
sudo chown -R 1000:1000 storage
sudo docker compose start app
```

Numa VM nova, siga este guia até a seção 10 antes de restaurar. Depois, leia o QR Code do WhatsApp
de novo (a sessão não entra no backup).

---

## 14. Endurecimento do acesso SSH (recomendado)

A rede padrão do Google Cloud deixa a porta 22 aberta para a internet inteira. Com o
**Identity-Aware Proxy (IAP)**, o SSH passa a aceitar conexões só pela infraestrutura do Google,
autenticadas pela sua conta. Rode no seu computador ou no Cloud Shell:

```bash
gcloud services enable iap.googleapis.com

# SSH só a partir do IAP.
gcloud compute firewall-rules create permitir-ssh-iap \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:22 --source-ranges=35.235.240.0/20

# Remove o SSH aberto para qualquer origem.
gcloud compute firewall-rules delete default-allow-ssh --quiet

# Daqui em diante, conecte assim:
gcloud compute ssh aniversarios --zone="$ZONA" --tunnel-through-iap
```

Aproveite e remova também as regras padrão que o sistema não usa:

```bash
gcloud compute firewall-rules delete default-allow-rdp --quiet
```

---

## 15. Operação do dia a dia

Todos os comandos rodam na VM, dentro de `~/AniversariosAutomatizados`.

| Tarefa | Comando |
| --- | --- |
| Atualizar para a última versão | `bash deploy/atualizar.sh` |
| Voltar para uma versão anterior | `bash deploy/atualizar.sh sha-1a2b3c4` (tags em GitHub → Packages) |
| Ver o estado dos contêineres | `sudo docker compose ps` |
| Ver os logs da aplicação | `sudo docker compose logs -f --tail=100 app` |
| Ver só os erros | `sudo docker compose logs app \| grep '"level":50'` |
| Reiniciar a aplicação | `sudo docker compose restart app` |
| Aplicar mudanças do `.env` | `sudo docker compose up -d` |
| Fazer um backup agora | `bash deploy/backup.sh` |
| Espaço em disco | `df -h /` e `sudo du -sh storage/* backups` |
| Limpar imagens antigas | `sudo docker image prune -f` (o `atualizar.sh` já faz) |

**Rotina sugerida:**

| Quando | O quê |
| --- | --- |
| Ao receber alerta do healthchecks.io | Ver os logs e o painel "Saúde do sistema" |
| Mensalmente | Conferir o relatório de faturamento e o espaço em disco |
| A cada 3 meses | Testar a restauração de um backup (seção 13.5) |
| Quando o token do GHCR expirar | Gerar outro e repetir a seção 10.3 |

---

## 16. Checklist final

- [ ] Projeto criado, com faturamento vinculado e alerta de orçamento configurado
- [ ] VM `e2-micro` em `us-east1`, disco `pd-standard` de 30 GB
- [ ] IP reservado no nível Standard e ligado à VM
- [ ] Firewall com 80/443 liberadas e SSH restrito ao IAP
- [ ] Domínio apontando para o IP, e painel abrindo com HTTPS
- [ ] `.env` com senha e segredo fortes, protegido com `chmod 600`, e senha guardada num gerenciador
- [ ] WhatsApp conectado, grupo escolhido e envio de teste conferido no grupo
- [ ] healthchecks.io verde, e alerta testado
- [ ] Backup local e no bucket funcionando, agendado no cron e restauração testada
- [ ] Relatório de faturamento conferido após os primeiros dias

---

## 17. Solução de problemas

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| O navegador não abre o painel | DNS ainda não aponta para o IP, ou firewall sem a tag | `dig +short <domínio>` deve mostrar o IP. Confira se a VM tem a tag `web` |
| Erro de certificado / Caddy não obtém HTTPS | Domínio errado no `.env` ou porta 80 bloqueada | `sudo docker compose logs caddy`. Corrija o `DOMINIO` e rode `sudo docker compose up -d` |
| `app` não fica `healthy` | Configuração inválida | `sudo docker compose logs app`: a primeira linha diz qual variável está errada |
| `permission denied` ao gravar em `storage/` | Dono errado da pasta | `sudo chown -R 1000:1000 storage` |
| `docker compose pull` falha com `denied` | Pacote privado sem login, ou token expirado | Repita a seção 10.3 |
| `git pull` falha no `atualizar.sh` | Deploy key ausente ou removida | Repita a seção 9.3 |
| O backup não sobe para o bucket | Conta de serviço sem permissão, ou rclone sem configuração | `rclone lsd gcs:<bucket>`. Revise as seções 6.2 e 13.1 |
| healthchecks.io em **Down** | WhatsApp desconectado, grupo não configurado ou processo parado | Abra o painel e veja "Saúde do sistema"; depois os logs |
| Envio falhou 3 vezes no dia | WhatsApp instável ou número bloqueado | Veja o **Histórico** (coluna detalhe) e os logs. Corrija e use **Enviar agora** |
| Cobrança inesperada | Disco balanceado, região errada ou IP sem VM | Revise as seções 1.2 e 7.2 |
| VM lenta ou travando | Pouca memória | `free -h` e `sudo docker stats`. O swap de 2 GB deve estar ativo (`swapon --show`) |

---

**Referências:** [Camada gratuita do Google Cloud](https://cloud.google.com/free/docs/free-cloud-features) ·
[Compute Engine na camada gratuita](https://cloud.google.com/free/docs/compute-getting-started) ·
[Preços de IP externo](https://cloud.google.com/vpc/network-pricing#ipaddress) ·
[IAP para SSH](https://cloud.google.com/iap/docs/using-tcp-forwarding) ·
[rclone e Google Cloud Storage](https://rclone.org/googlecloudstorage/)
