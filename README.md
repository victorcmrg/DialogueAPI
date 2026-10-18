# DialogueAPI

Editor web de diálogos do plugin **NotEnoughDialogues** (Minecraft / Paper 1.21.10).

Blueprint com todos os diálogos e seus balões: arraste para organizar, ligue saídas em entradas,
edite texto, skin, animação, tom da voz, requisitos de entrada, gatilhos e salve direto no servidor.

Abas do editor:

- **Diálogos**: grafo de balões, requisitos, **paywall** (pagar para ver) e **comando de abertura**
  (`/falar_ferreiro` abre o diálogo sem aparecer no chat nem no console).
- **NPCs**: cena 3D estilo Blockbench com prévia do NPC — player (manequim com skin), qualquer mob vanilla
  ou modelo do **BetterModel** (lista todos os `.bbmodel` de `plugins/BetterModel/models`). Nome, tamanho,
  posição, olhar para o jogador, animações (idle em loop, aleatórias a cada N segundos, ao clicar) com
  linha do tempo para tocar cada animação, e lista de diálogos em ordem ("só depois de", "pode repetir").
- **Quests**: quadro de etapas. Cada etapa tem objetivos (matar mob/MythicMobs, entregar itens com custom
  model data, entrar em mundo, região do WorldGuard, ir até local, falar com NPC, nível, dinheiro, quebrar,
  colocar, pescar, fabricar, flag, placeholder...), NPC de entrega, conversas e recompensas.
- **Skins** e **Speakers**.

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
| `viewer3d.js` | prévia 3D dos NPCs em WebGL puro (lê `.bbmodel`, toca animações, boneco de player com skin) |
| `npcs.js` | abas de NPCs e Quests |
| `server.js` | servidor + ponte para a API do plugin |
| `.env` | endereço do plugin e token |
| `start.bat` | atalho para iniciar no Windows |

## Rotas da API do plugin

| Rota | |
|---|---|
| `GET /api/state` | diálogos (formato grafo), speakers, skins, animações, NPCs, quests, modelos do BetterModel, mundos e jogadores online |
| `POST /api/save` | grava diálogos, speakers, `npcs.yml` e `quests.yml` e recarrega o plugin |
| `GET /api/model?name=` | `.bbmodel` da pasta `plugins/BetterModel/models` (prévia 3D) |
| `POST /api/npc-move` | põe o NPC na posição de um jogador online `{id, player}` |
| `GET /api/skin?name=` | PNG de uma skin salva |
| `POST /api/skin` | salva skin `{name, slim, data: base64}` |
| `POST /api/skin-delete` | apaga skin `{name}` |

Todas pedem `?s=<token>`.
