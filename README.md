# DialogueAPI

Editor web de diálogos do plugin **NotEnoughDialogues** (Minecraft / Paper 1.21.10).

Blueprint com todos os diálogos e seus balões: arraste para organizar, ligue saídas em entradas,
edite texto, skin, animação, tom da voz, requisitos de entrada, gatilhos e salve direto no servidor.

## Iniciar

```bash
npm start
```

No PC: use o `start.bat` (abre em **http://localhost:5173/**). Não precisa de `npm install`: só Node 18+.

## Entrar no editor

O site pede um token (o plugin é quem confere):

- **Link do jogo:** `/ned web-editor` manda um link `.../editor/?s=...` que já entra direto.
- **Token fixo:** na tela de entrada, cole o `API_TOKEN` do `.env` (o mesmo de `web-editor.api-token` no plugin).

Sem token válido o site não mostra nada, então ele pode ficar público.

## Plugin (`plugins/NotEnoughDialogues/config.yml`)

```yaml
web-editor:
  port: 8166                                  # precisa estar LIBERADA no host do Minecraft
  public-url: "https://majoriadialog.squareweb.app/"   # endereço deste site (para o link do /ned web-editor)
  api-token: "01d97db6b2ee84bd13a35c82eefb0a81124ff5ed48c169b8"
```

## Square Cloud

Variáveis de ambiente do app:

| Chave | Valor |
|---|---|
| `PLUGIN_URL` | `http://IP-DO-HOST-DO-MINECRAFT:8166` (nunca `localhost`) |

O `.env` já traz `HOST=0.0.0.0` e `PORT=80`, que é o que a Square precisa. Não crie `HOST=127.0.0.1`
no painel: com ele o site fica inacessível. Depois de mudar variáveis no painel, clique em **Salvar** e reinicie.
No console tem que aparecer `escutando em 0.0.0.0:80`.

## Como funciona

```
navegador ──(token)──> server.js ──(token)──> plugin NotEnoughDialogues (PLUGIN_URL/api/*)
                       serve o editor          confere o token, lê/grava diálogos e skins,
                       e repassa /api/*         recarrega o plugin ao salvar
```

| Arquivo | O quê |
|---|---|
| `index.html`, `editor.css`, `editor.js` | o editor (sem dependências) |
| `server.js` | servidor + ponte para a API do plugin |
| `.env` | endereço do plugin e token |
| `start.bat` | atalho para iniciar no Windows |

## Rotas da API do plugin

| Rota | |
|---|---|
| `GET /api/state` | diálogos (formato grafo), speakers, skins e animações |
| `POST /api/save` | grava diálogos e speakers e recarrega o plugin |
| `GET /api/skin?name=` | PNG de uma skin salva |
| `POST /api/skin` | salva skin `{name, slim, data: base64}` |
| `POST /api/skin-delete` | apaga skin `{name}` |

Todas pedem `?s=<token>`.
