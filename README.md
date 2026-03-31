# Monitor Caixa Imóveis SP

Robô que monitora diariamente os imóveis da Caixa Econômica Federal em São Paulo e envia um e-mail quando aparecem **novos imóveis com desconto a partir de 50%**.

---


```
Todo dia às 8h (Brasília)
  → Baixa o CSV oficial da Caixa (SP)
  → Filtra imóveis com desconto >= 50%
  → Compara com a lista do dia anterior
  → Se houver novidades → envia e-mail HTML
  → Salva a lista atual no repositório (previous.json)
```

O e-mail lista cada imóvel com cidade, bairro, endereço, preço de venda, valor de avaliação, desconto e link direto para a página da Caixa.

---

## Estrutura

```
caixa-monitor/
├── .github/
│   └── workflows/
│       └── caixa-monitor.yml   # agendamento no GitHub Actions
├── src/
│   ├── index.js                # ponto de entrada
│   ├── config.js               # variáveis e logger
│   ├── downloader.js           # download do CSV com retry
│   ├── parser.js               # parse e filtragem por desconto
│   ├── comparator.js           # detecta imóveis novos
│   └── mailer.js               # envio do e-mail via SMTP
├── templates/
│   └── email.hbs               # template HTML do e-mail
├── data/
│   └── previous.json           # IDs da última execução (versionado)
└── .env                        # credenciais locais (não sobe ao git)
```

---

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/caixa-monitor.git
cd caixa-monitor
npm install
```

### 2. Configure o `.env`

Crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
# SMTP (exemplo com Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@gmail.com
SMTP_PASS=sua_senha_de_app
EMAIL_FROM=seu@gmail.com
EMAIL_TO=destinatario@gmail.com

# Agendamento local (opcional)
CRON_SCHEDULE=0 8 * * *

# Log
LOG_LEVEL=info
```

> Para Gmail, use uma **senha de app** gerada em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) — não a senha da conta.

### 3. Configure os Secrets no GitHub

No repositório, vá em **Settings → Secrets and variables → Actions** e adicione:

| Secret | Valor |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | seu e-mail |
| `SMTP_PASS` | senha de app |
| `EMAIL_FROM` | remetente |
| `EMAIL_TO` | destinatário |

---

## Executando localmente

```bash
node src/index.js
```

Em modo local, o processo fica rodando em background com `node-cron` e executa automaticamente no horário definido em `CRON_SCHEDULE`.

---

## GitHub Actions

O workflow em `.github/workflows/caixa-monitor.yml` roda:

- **Automaticamente** todo dia às 11h UTC (8h de Brasília)
- **Manualmente** pelo botão *Run workflow* na aba Actions do repositório

Após cada execução, o `data/previous.json` é commitado de volta no repositório para que a próxima execução saiba quais imóveis já foram vistos.

---

## Detalhes técnicos

- **Fonte dos dados:** [CSV oficial da Caixa — SP](https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv)
- **Encoding:** ISO-8859-1 (convertido para UTF-8 via `iconv-lite`)
- **Retry:** até 3 tentativas com backoff exponencial via `axios-retry`
- **Primeira execução:** salva o baseline sem enviar e-mail (evita spam na estreia)
- **E-mail:** template HTML responsivo via Handlebars (`templates/email.hbs`)
- **Logs:** gravados em `logs/app.log` (ignorado pelo git)
