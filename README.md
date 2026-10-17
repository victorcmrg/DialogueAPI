# DialogueAPI

Editor web de diálogos do plugin **NotEnoughDialogues** (Minecraft / Paper 1.21.10).

Blueprint com todos os diálogos e seus balões: arraste para organizar, ligue saídas em entradas,
edite texto, skin, animação, tom da voz, requisitos de entrada, gatilhos e salve direto no servidor.

## Iniciar

```bash
npm start
```

ou dê dois cliques em `start.bat` (abre o navegador sozinho).
O editor abre em **http://127.0.0.1:5173/**. Não precisa de `npm install`: só Node 18+.

## Conectar ao servidor (uma vez)

Tudo já está no `.env`. Só confira:

1. **No plugin** (`plugins/NotEnoughDialogues/config.yml`), coloque o mesmo token do `.env`:

   ```yaml
   web-editor:
     port: 8166
     api-token: "01d97db6b2ee84bd13a35c82eefb0a81124ff5ed48c169b8"
   ```

   e rode `/ned reload` (ou reinicie). Com o token definido, o editor do plugin liga junto com o servidor.

2. **No `.env`**, `PLUGIN_URL` precisa apontar para o servidor: `http://IP-DO-HOST:8166`
   (está `http://localhost:8166`, que só funciona com o servidor rodando no seu PC).
   A porta 8166 precisa estar liberada no host.

## Como funciona

```
navegador ──> server.js (127.0.0.1:5173) ──> plugin NotEnoughDialogues (PLUGIN_URL/api/*)
                 serve o editor              lê/grava os diálogos e skins
                 + coloca o API_TOKEN        e recarrega o plugin ao salvar
```

O token fica só no `server.js`; o navegador nunca vê.

| Arquivo | O quê |
|---|---|
| `index.html`, `editor.css`, `editor.js` | o editor (sem dependências) |
| `server.js` | servidor + ponte para a API do plugin |
| `.env` | endereço do plugin, token e porta |
| `start.bat` | atalho para iniciar no Windows |

Sem este repositório, o mesmo editor também abre pelo próprio plugin: `/ned web-editor` no jogo.

## Rotas da API do plugin

| Rota | |
|---|---|
| `GET /api/state` | diálogos (formato grafo), speakers, skins e animações |
| `POST /api/save` | grava diálogos e speakers e recarrega o plugin |
| `GET /api/skin?name=` | PNG de uma skin salva |
| `POST /api/skin` | salva skin `{name, slim, data: base64}` |
| `POST /api/skin-delete` | apaga skin `{name}` |

Todas pedem `?s=<token>`.
