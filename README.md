# Central de Aplicações

Criado por **Carlos Arvela** · © Todos os direitos reservados

Painel com duas páginas: **Sites** (principal) e **Manuais**. O admin pode adicionar,
editar e remover sites e criar/editar manuais. Os dados ficam guardados no servidor,
por isso todos veem o mesmo.

## Estrutura

    server.js        servidor Node.js (sem dependências)
    seed.json        dados iniciais (usados só na primeira execução)
    public/          página (index.html, style.css, app.js)
    render.yaml      configuração para publicar no Render
    data/data.json   criado automaticamente com os dados em uso

## Correr no computador

    node server.js
    # abre http://localhost:3000

Requer Node.js 18 ou superior. Não é preciso `npm install`.

## Login de admin

Verificado **no servidor** (cookie HttpOnly, assinado, 12 h; 5 tentativas falhadas bloqueiam 15 min).
Por defeito: utilizador `admin`, palavra-passe `adminabsol`.
Para os alterar sem mexer no código, define as variáveis de ambiente:

    ADMIN_USER   utilizador
    ADMIN_PASS   palavra-passe
    SESSION_SECRET   texto aleatório longo (mantém a sessão após reiniciar)
    DATA_DIR     pasta onde ficam os dados (por defeito ./data)

> Em produção define sempre `ADMIN_PASS` e `SESSION_SECRET`. A palavra-passe por defeito
> está escrita neste código e deve ser considerada pública.

## Publicar no Render

1. Coloca esta pasta num repositório (GitHub).
2. No Render: **New → Blueprint** e escolhe o repositório (usa o `render.yaml`),
   ou **New → Web Service** com *Build* `npm install` e *Start* `node server.js`.
3. Em **Environment**, define `ADMIN_PASS` (e `SESSION_SECRET`, se não for gerado).
4. **Importante:** o disco do Render é apagado a cada reinício/deploy. Para os dados
   persistirem, adiciona um **Persistent Disk** (plano pago) montado em `/var/data`
   e define `DATA_DIR=/var/data` (o `render.yaml` já faz isto).

Também funciona em qualquer servidor com Node 18+ (VPS, Railway, Fly.io): `node server.js`
atrás de HTTPS.

## API

    GET  /api/data     sites e manuais (público)
    GET  /api/me       { admin: true|false }
    POST /api/login    { user, pass }
    POST /api/logout
    PUT  /api/data     substitui sites e manuais (só admin)
    GET  /healthz      verificação de saúde
