# RafaHatesRats — design (current source of truth)

A 2D auto-runner rhythm game for the browser, iPhone landscape first. Phaser 3.90 + TypeScript + Vite. All text in Brazilian Portuguese. It is an inside joke among friends and should not take itself seriously.

Roles: the designer/director (Fable) owns this document and reviews; engineers (Opus agents) write all code. Where code and this document disagree about *as-built mechanics*, `src/types.ts` and `src/config.ts` win; where they disagree about *what the game should be*, this document wins.

## 1. Story and levels

Rafa and Fabinho compete for first place in Gym Rats. She wins, and wrecks her knee doing it. Next she is bridesmaid (madrinha) at Nathalia and Murilo's wedding, on a crutch, walked in by Giovanni. Then comes the wedding party, in a wheelchair, where a knockoff spider-hero dancer arrives on a party train.

| | 1 — Campeonato Gym Rats | 2 — A Madrinha | 3 — A Festa |
|---|---|---|---|
| id / theme / songId | `gym` | `church` | `party` |
| Place | The gym | The church, down the aisle | The wedding reception |
| Rafa (`LevelDef.rafa`) | `standing` — gym clothes (`rafaGym`) | `crutches` — sage dress, as in level 3 (`rafaMuleta`) | `wheelchair` — sage dress (`rafaView`) |
| With / against | Boss: **Fabinho** (in gym clothes) | Companion: **Giovanni**. **No boss** — reach the altar before the bride, **Nathalia**, who runs in behind her as a cosmetic chaser; **Murilo** waits at the altar | Boss: **O Aranha da Carreta** on his party train |
| BPM / length | 120 / 144 beats | 132 / 176 beats | 144 / 208 beats |
| Timing margin (solver) | ±110 ms | ±75 ms | ±55 ms |
| Ending | "1º LUGAR!" … then her knee goes: "LCA destruído." | She takes her place at the altar beside Nathalia and Murilo: "Chegou a tempo, madrinha!" | Gelol, she rams him into the train's speaker, then dances |

Section template for every level (names are shared with the songs): `intro` (count-in, no hazards) → `warmup` (single obstacles, "TOQUE!" / "SEGURE!" hint signs in level 1) → `main` (combos, Whey, Pré-treino) → `gelol` (Gelol corridor) → `bossEnter` → `boss1` → `boss2` → `boss3` → `finale`. Level 2 has no boss: its `bossEnter`…`boss3` are the final dash ("A noiva tá chegando!").

## 1b. Difficulty (decided after the first playtest: "level 1 is too difficult")

The players are casual, on phones. Every level must be beatable using only big jumps (the hop is optional, for coins): no hop-only traps, any jump length clears a small obstacle. Big-jump-only obstacles are at most ~1.2–1.3 blocks of hitbox and signposted the first time. Each "don't jump" moment stands alone with clear floor on both sides. Minimum spacing between required actions: level 1 — 2 beats (1.5 in the boss); level 2 — 1.5 (1.25 in the dash); level 3 — 1.25 (1 in the boss). Three Whey shields per level. One new idea at a time.

**Power-ups must show their time left where the player is looking:** a draining bar above Rafa's head (red and blinking on the last 3 beats of Gelol, last 2 of Pré-treino), a large HUD timer, and countdown ticks in the audio.

**Modes** (`Settings.hard`, the switch under JOGAR and on the Fases header). **Fácil** (default): 3 hearts; a hit costs one and gives 2 beats of invulnerability (Rafa blinks), the Whey still absorbs first, holes still kill. Checkpoints are the section starts after beat 0 (`checkpoints()` in `src/sim/sim.ts`) except sections flagged `checkpoint: false` (the gym and church finales, which need the Gelol picked up just before them); passing one refills the hearts. Game over after a checkpoint offers CONTINUAR: a bar of run-in before it, invulnerable until it, with the coins she had there and the run-in's power-ups back. **Difícil**: the game as charted, one hit and back to the start; a win there marks the level (`LevelSave.hard`). The charts are the same in both modes; the solver proves them with 1 heart, and `levels.test.ts` proves every checkpoint winnable by a fresh Rafa.

## 2. Core rules (as built)

Everything is in **beats and blocks**. 1 block = 96 px at the logical 1080 px view height; Rafa is pinned 28% from the left; x = beat × 4 blocks, so an event charted at beat N is met exactly on beat N.

- **Tap = hop**, **hold = big jump** (1.0 beat, 3.0 blocks high, 4 long). The cutoff is 150 ms of real time at any tempo (`PHYS.minHoldMs`), so a natural phone tap is always a hop; the hop is ~0.9 beat, ~2.7 high, ~3.6 long. Buffer 0.25 beat, coyote 0.15 beat.
- Hitboxes are forgiving: player 0.7 × 1.3; small hazards ≤ 0.7 × 0.6; big ≤ 1.4 × 1.2. **High hazards** (bottom ≥ 1.7 blocks): stay on the ground.
- Hazard behaviours, each a pure function of the beat: `static`, `drop`, `run`, `bounce`, `lob`, `fly`, `pulse`. `drop`/`lob` land `lead` beats before Rafa arrives, with a ground shadow as warning.
- One-way platforms (static or moving) and ground holes exist in the engine. Levels 1–3 use **no holes**; platforms are optional.
- Death → 250 ms crash → game-over card → tap anywhere retries from beat 0 (Fácil: from the last checkpoint), no reload.
- **Gelol** (signature): from the next whole beat, 12 beats of overdrive — clock ×1.3 (music speeds up too), small hazards are smashed, fire trail, glow. **Whey**: one-hit shield. **Pré-treino**: 8 beats of one mid-air jump, never required. **Golden dumbbell**: collectible in every level.
- The solver (`src/sim/solver.ts`) proves each level beatable at its margin and feeds the autoplay bot (`?bot=1`). It is conservative: no buffered presses, no air jump, shield break = death.

## 3. Level content

Hazard kinds below are the `HazardKind` names and the art frame names (`HAZARDS[kind].art`). Sizes are hitboxes in blocks, w × h.

### Level 1 — gym (art exists)
Small: `dumbbell`, `kettlebell`, `bottle`, `rat` (scurrying toward her — the title's payoff, this level only), `plate`, `ropeWave`. Big: `treadmill`, `bench`, `plateRack`, `barbellRack`, `plyo`. High: `bag` (hanging punching bag).

**Boss: Fabinho** — a boy in a black T-shirt, shorts and sneakers, from the user's gym sheet (`fabinho-v2-gym.PNG`). He runs just ahead of Rafa, trying to out-train her. A boss is a cosmetic actor driven by chart cues; his attacks are ordinary hazards.

| Attack | Hazard | Player does |
|---|---|---|
| Throws weight plates flat | `frisbee`, `fly` high or low | Stay down / jump |
| Leaps and lands hard | `shockwave`, `run` along the floor | Hop |
| Bowls a medicine ball | `medBall` 0.55 × 0.55, `bounce` | Under the high bounce or over the low one |

Between attacks he shows off (he's competing): in every idle window that fits one whole rep of the exercise due next (taunt breaks included) he does an exercise in time with the music, a different one per window in the order squats → push-ups → pull-ups → burpees, repeating. Whole reps from the window's first whole beat; the key frame lands on a beat (squat: deepest, 1 rep / 2 beats; push-up: chest down, 1 / beat; pull-up: chin over the bar, 1 / 2 beats; burpee: plank low on the middle beat, then crouch and jump, landed by the end, 1 / 2 beats). He is back in his run at least 1 beat before every telegraph, and windows stop at the `finale` section (the Gelol finale keeps its own behaviour). Floor exercises keep his spot ahead of Rafa, gliding with the scroll (skid dust); the pull-up bar hangs from the ceiling truss on two thin chains that travel with him. Level 1 as charted: squats 83–87, push-ups 103–107, pull-ups 116–120, one burpee 133–135 (running again before the finale at 136); the short gaps between attacks stay plain. Windows: `idleWindows` / `exercise` in `src/game/fabinhoGym.ts`. Finale: Gelol, she overtakes him, he ends face-down (`defeated`), then sulking.

### Level 2 — church (new art)
Rafa hurries down the aisle on a crutch. Giovanni walks half a step behind her as a cosmetic companion: he copies her jumps a moment late, reacts when she crashes, and cannot be hit.

| Size | Kinds (hitbox) |
|---|---|
| Small | `kneeler` 0.7 × 0.4 · `flowerBasket` 0.6 × 0.5 · `hymnBooks` 0.6 × 0.4 (also `drop` from the choir loft) · `rice` 0.6 × 0.4 (`lob`: a thrown handful that lands as a little pile) · `flowerGirl` 0.6 × 0.6 and `ringBearer` 0.6 × 0.6 (children running up the aisle, `run`) |
| Big | `pewEnd` 1.0 × 1.2 · `candleStand` 0.6 × 1.2 · `flowerStand` 0.9 × 1.2 · `photographer` 1.2 × 1.2 (crouched with a tripod, backing into the aisle) |
| High | `dove` 0.7 × 0.4 (`fly`) · `lantern` 0.6 × 0.8 (hanging on a chain) |

No boss. The last third is a Gelol dash through the densest part of the aisle. The level ends at the **altar set piece**: steps, floral arch, the couple standing there.

### Level 3 — party (new art, plus the existing spider-boss art)
| Size | Kinds (hitbox) |
|---|---|
| Small | `giftBox` 0.6 × 0.55 · `chair` 0.7 × 0.5 (knocked over) · `champagne` 0.35 × 0.6 (bottle on the floor) |
| Big | `table` 1.4 × 1.0 (round, with cloth) · `cakeTable` 1.2 × 1.2 · `champagneTower` 0.9 × 1.2 · `waiter` 0.9 × 1.2 (`run`, crossing with a tray) |
| High | `balloons` 0.8 × 0.9 (a bunch floating at head height) |
| Timed | `sparkler` 0.6 × 1.0 (`pulse`: a stage fountain that fires on the beat) |

Optional platforms: low stage risers (`plat_stage`).

**Boss: O Aranha da Carreta** — the kind of knockoff spider-hero dancer seen on a Brazilian *trenzinho da alegria*, dancing funk. Original off-model costume (red hood and torso, blue legs, lopsided white eyes, a wonky asterisk emblem, black high-top sneakers over the suit). Not Marvel's suit; no real group's name or livery. He arrives on the roof of the "CARRETA DA ALEGRIA" party train, which rolls ahead of Rafa as his stage; the music drops into a funk beat.

| Attack | Hazard | Player does |
|---|---|---|
| Flings a web blob mid-dance | `webBlob`, `lob` | Hop |
| Strings a web at head height | `webLine`, high `fly` | Stay down |
| Backflips off the train, wound up from pose 2 | `spiderDive`, low `fly` | Big jump |

**His two signature poses are mandatory** (they come from the user's reference photos): `aranha_pose1`, the deep one-sided squat, is his on-the-beat taunt between attacks; `aranha_pose2`, the wide low stance with one arm reaching, is the dive wind-up and appears on the level-3 game-over card beside Rafa's wheelchair. Defeat: tangled in his own web, he falls into the speaker. "Eu treino passinho, não perna!"

## 4. Characters and art

**From the user's sheets** (`art-src/characters/`, read-only, used 1:1 with smooth filtering, never re-pixelized):

| Sheet | Status | Gives |
|---|---|---|
| `rafa-sheet.png` | sliced → `public/art/rafa.*` | Wheelchair Rafa: push cycle with spinning wheels, idle, jump, arms-up, pointing, crash; 8 faces for HUD and cards; menu poses |
| `fabinho-sheet.png` | not sliced (the suit Fabinho is not in the game) | Run, leap, land, throw, push-ups, sit-ups, idle, defeated, sulk; faces |
| `rafa-sheet-gym.PNG` | present (45 sprites) → `public/art/rafagym.*`, view `src/game/rafaGym.ts` | Level-1 Rafa: black gym clothes and **glasses**. Run ×5, walk ×5, jump sequence, landing, arms-up cheer, squats, push-ups, stretches, sitting hugging her knees (the level-1 ending), 6 faces with glasses for the level-1 HUD and cards |
| `fabinho-v2-gym.PNG` | present (35 sprites) → `public/art/fabinhogym.*`, tables `FABINHOGYM` | The level-1 boss: Fabinho in a black T-shirt, shorts and sneakers. Replaces the earlier `fabinho-gym.PNG`. No push-up or lying poses: his taunts are laughing, arms crossed, checking his phone. The suit Fabinho is his wedding look |
| `fabinho-gym-exercise.PNG` | present (44, real alpha) → exercise frames only, into `public/art/fabinhogym.*`, tables `FABINHOGYM.squat/pushup/pullup/burpee` | Gym Fabinho's exercises: pull-ups (bar drawn in the sprite), squats, push-ups, burpee. Scaled ×1.51 so its standing squat frame stands 236 px like his other frames; pivots on the hands / front foot (floor) or the bar centre (pull-ups). His run, poses and faces still come from `fabinho-v2-gym.PNG` |
| `rafa-muleta.PNG` | present (40; the eight touching faces are split) → `public/art/rafamuleta.*`, view `src/game/rafaMuleta.ts` | Level-2 Rafa: two crutches, long sage dress (the one she wears in level 3), knee brace. Replaces the earlier `rafaela-muleta.PNG` (short brown dress). Upright walk ×4 (her gait), leaning walk ×5 (under Gelol), five dance poses used for her win |
| `giovanni-sheet.PNG` | present (35) → `public/art/giovanni.*` | Level-2 companion: curly hair, black suit. Walks behind Rafa; pulls out his phone when she crashes |
| `nathalia-sheet.PNG` | present (37) → `public/art/nathalia.*` | The bride: runs in behind Rafa during the final dash (cosmetic), then stands at the altar |
| `murilo-sheet.PNG` | present (38) → `public/art/murilo.*` | The groom, grey three-piece suit: waits at the altar |

The derived rigs (`rafaKits`, `kits` atlas) are retired: every Rafa now comes from a sheet. In-game scale is each sheet's small row used 1:1 (~170–200 px); the wedding cast's `g_` frames match that.

**Heights** (standing, relative to standing Rafa = 1.00, same in game and menus): Nathalia 0.95 · Rafa 1.00 · Giovanni 1.10 · Fabinho 1.18 = Murilo 1.18. Heads stay the same size across the cast. The wedding cast gets the height from a body stretch below the neck, head kept (`WEDDING.stretch` in `scripts/slice-sheet.mjs`). Fabinho's sheet draws him smaller than gym Rafa, head included, so his in-game frames are scaled up uniformly ×1.32 (head then ≈ hers). Menus: `RATIO` in `src/ui/screens.ts`.

Wedding-sheet frames share one naming scheme (`turn_*`, `pose_*`, `run_*`, `walk_*`, `face_*`); in-game-scale copies are prefixed `g_`. The generic drawn `bride`/`groom` in `public/art/bosses.*` are only a fallback if an atlas is missing.

**Drawn in code** (pixel art, 32 art px per block, stored 1× with `meta.scale: 3`, drawn ×3 nearest): the party train (`public/art/bosses.*`), O Aranha da Carreta (`public/art/aranha.*`: drawn at 4× that density to match the sheet characters, `meta.scale: 0.75`, smooth filtering), gym props, items, effects (`public/art/props.*`), backgrounds (`public/art/bg/`), logo. `spider-pos1.jpg` / `spider-pos2.jpg` are pose references of real people at a private party: never shipped, copied or committed.

**Art contract for code-drawn art:** palette from `art-src/palette.json`, outline `#140b09`; 16-bit arcade quality (≥ 3 tones per material, highlight, readable silhouette at phone size); sprites ~1.25–1.4× their hitbox; Phaser JSON-hash atlas with per-frame pivot/anchor (bottom-centre at ground contact for ground things, centre for flying things, items, effects). Size class must be readable from shape alone. **Backgrounds must never look jumpable:** anything near the floor line is rendered as low-contrast silhouettes in the wall's own tones, with its bottom faded out.

**Dropped:** Rei Rato, the street and arena themes, the knee-brace Rafa. Their art is removed from the shipped game.

## 5. Audio (no audio files)

WebAudio synth + step sequencer in `src/audio/`, driven by the game's `BeatClock` so notes and obstacles share one timeline. Songs are pattern data keyed by section name.

| Song | Character |
|---|---|
| `gym` (120) | Bouncy bright electro; boss sections are Fabinho's bratty taunt theme |
| `church` (132) | Up-tempo chiptune on the traditional bridal march (public domain) with organ and bells; the "boss" sections are the dash to the altar |
| `party` (144) | Dance track that drops into Brazilian funk (tamborzão, train horn, whistle) when the Aranha arrives |

Overdrive adds an intensity layer. SFX for jump, land, coin, Gelol, Whey, Pré-treino, shield break, smash, rat squeak, crash, boss enter/telegraph/beaten, win, UI.

## 6. Screens (DOM overlay, `src/ui/`, built)

Menu · Fases (three cards) · Ajustes (música, efeitos, reduzir efeitos, tela cheia, apagar progresso) · HUD (reactive Rafa portrait, progress, Gelol ring, indicators, dumbbells, attempt, pause) · Pausa · Game over (face, joke, progress bar with the best as a tick, tap anywhere to retry) · Vitória (stat tiles) · Vire o celular. Font: Jersey 15. Save: `localStorage` key `rhr.save.v1`.

**The menus are places in the game.** `.scene[data-theme]` is a level's backdrop as DOM, built from the bg manifest (layers, overlays, ground; `--px` from container height, `--top`/`--floor` crop it, ground on the bottom). The title shows the scene of the level JOGAR starts, drifting slowly with one beat-blinking detail (gym neon, church windows, party guests), the logo on a sign hanging from two chains, JOGAR naming that level, a progress strip, and the whole cast on the floor (one Rafa: that level's). Fases and Ajustes sit on the same scene dimmed; each Fases card is a window onto its own level's scene with its pair (RATIO heights), a numeral, a plaque, and the level's frame colour (gold + CONCLUÍDA when done). Pause, game over and victory keep overlaying the level, in the shared `.panel` (pixel bevel frame, dither, rivets, title tab, level colours). No scene exists during a run; motion is off with Reduzir efeitos / prefers-reduced-motion. JOGAR and a Fases card request fullscreen + landscape lock where the API exists; on iPhone (no API, not standalone) the title and Ajustes explain Adicionar à Tela de Início.

## 7. Architecture (as built)

```
src/types.ts, config.ts      shared contract and tuning
src/sim/                     pure deterministic sim + solver (no Phaser, no DOM)
src/levels/                  dsl.ts + one file per level
src/game/                    clock, createGame, GameScene, input, rafaView (wheelchair), rafaGym (level 1), rafaMuleta (level 2), bosses, companion, background, fx, views
src/art/sheets.ts            animation tables for sheet characters
src/audio/                   engine, voices, sequencer, songs, sfx
src/ui/, src/save.ts         screens and persistence
scripts/slice-sheet.mjs      user sheets → atlases (only the frames in its KEEP lists) + DOM images
scripts/bake-*.mjs           code-drawn art → atlases (libs: art-src/props/px.mjs, art-src/bg/lib.mjs, art-src/bosses/raster.mjs)
scripts/shots*.mjs           Playwright screenshot runs (bot, UI, gallery)
```

Background themes are described in `public/art/bg/manifest.json` under `themes.gym`, `themes.church`, `themes.party` (layers back-to-front with size, y, parallax, tiling; ground tiles; beat overlays; set-piece sprites), all in art px, drawn ×3. Its `_doc` array holds the assembly rules.

Code-drawn atlases: `props.*` (object hazards, items, platforms, effects — all levels), `bosses.*` (O Aranha, the train, rats, and the people who are hazards: photographer, children, waiter, plus the stand-in couple).

Dev flags: `?bot=1` (always Difícil), `?level=N`, `?t=<beat>`, `?debug=1`, `?hard=1` (Difícil for that page load, not saved). Dev server for the user's phone runs on port 5190.

## 8. Verification

`npm test` (sim + solver on every level) · `npm run build` · `npm run shots` (bot reaches 100% on each level) · `npm run shots:ui` · `npm run audio:check` · real-iPhone check for sound unlock, sync, scroll/zoom, safe areas.

## 9. Engineering rules

Smallest code that fully solves the task; no speculative abstraction; reuse what exists; comment only the why; a test for risky logic. Never cut validation at boundaries, accessibility, or mobile behaviour. Engineers work in parallel on disjoint paths given in their brief, never commit, never kill processes they didn't start, and only fix type errors in their own files.
