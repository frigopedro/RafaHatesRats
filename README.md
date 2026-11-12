# RafaHatesRats

Jogo de ritmo para o navegador, feito para iPhone na horizontal: a Rafa corre sozinha e você pula no tempo da música.
Três fases (academia, igreja, festa), uma piada interna entre amigos. O documento de design está em `docs/DESIGN.md`.

Phaser 3 + TypeScript + Vite. O áudio é todo sintetizado (sem arquivos de som).

## Rodar

```sh
npm install
npm run dev -- --host
```

O Vite mostra um endereço `Network` (algo como `http://192.168.0.10:5173/`). Abra esse endereço no celular, na mesma
rede Wi-Fi, e vire o celular na horizontal.

## Build

```sh
npm run build      # checa os tipos e gera dist/
npx vite preview   # serve dist/ localmente para conferir
```

`dist/` é um site estático: basta publicar a pasta em qualquer hospedagem.

## Testes e verificações

- `npm test` — simulação, solver e as três fases. O solver prova que cada fase é vencível com a folga de tempo
  dela (`src/levels/levels.test.ts` e os testes por fase).
- `npx tsc --noEmit` — tipos.
- `npm run shots` — o bot joga as três fases no Chromium headless até 100%, e cada fase também é rodada sem
  ninguém pular (game over); screenshots em `shots/run/<fase>/`.
- `npm run shots:ui` — todas as telas (menu, fases, ajustes, HUD, pausa, game over, vitória) em dois tamanhos de
  iPhone; screenshots em `shots/ui/`.
- `npm run shots:gallery` — a galeria de animações (`gallery.html`) em `shots/gallery/`.
- `npm run audio:check` — renderiza as músicas e efeitos offline e confere sincronia e mixagem.

`shots/` não vai para o git.

## Flags de desenvolvimento

Na URL do jogo:

- `?level=gym|church|party` (ou `?level=1..3`) — começa direto na fase.
- `?bot=1` — o bot joga sozinho (a solução do solver).
- `?t=<batida>` — começa a fase nessa batida.
- `?debug=1` — mostra as hitboxes.

Só no servidor de desenvolvimento: `?screen=menu|fases|ajustes|pause|hud|over|victory` abre uma tela direto (usado
pelo `shots:ui`), `?notch=1` simula o notch. Páginas só de desenvolvimento, fora do build: `gallery.html` (animações
dos personagens) e `audio.html` (músicas e efeitos).

## Fases

Cada fase é um arquivo em `src/levels/` (`level1-gym.ts`, `level2-church.ts`, `level3-party.ts`), escrito com a DSL
de `src/levels/dsl.ts` e registrado em `src/levels/index.ts`. Depois de mexer numa fase, rode `npm test`: se o solver
não conseguir vencer, o teste falha e diz em que batida.

## Trocar um personagem

Os personagens vêm das folhas de sprites em `art-src/characters/`. Para trocar um:

1. Coloque a folha nova em `art-src/characters/` (mesmo layout da antiga).
2. Em `scripts/slice-sheet.mjs`, a tabela do personagem (`RAFAGYM`, `RAFAMULETA_SHEET`, `FABINHOGYM_SHEET`,
   `GIOVANNI_SHEET`, …) lista cada sprite da folha em ordem, linha por linha, com a caixa esperada. Ajuste os nomes e
   as caixas (`null` pula a checagem da caixa; o script diz quando a contagem ou uma caixa não bate).
3. `KEEP` no mesmo arquivo lista os quadros que o jogo usa; só eles vão para o atlas. As folhas de contato em
   `shots/slice-*.png` mostram todos os sprites recortados.
4. `npm run slice` gera `public/art/<personagem>.png/.json` e as imagens das telas em `public/art/ui/`.

A arte desenhada em código (cenários, obstáculos, o Aranha) é gerada com `npm run bake:bg`, `bake:props` e
`bake:bosses` a partir de `art-src/`.
