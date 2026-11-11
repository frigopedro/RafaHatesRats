# RafaHatesRats — design and build plan

## Context

The goal is a complete, playable 2D auto-runner rhythm game for the browser (iPhone first), built with Phaser 3 + TypeScript + Vite, with pixel art, original music and three levels ending in boss sequences. The project folder holds one file: your Rafa sprite sheet.

Roles: **Fable designs and directs** (this document, art/level/audio direction, screenshot reviews). **Opus subagents write all code** (Agent tool, `model: "opus"`). This file is copied into the repo as `docs/DESIGN.md` in milestone 0 so every Opus agent reads the same brief.

Your answers so far: text in **Português (BR)** · **pixel art** built around your characters, with animations · hosting **local only for now** (static `dist/`, playable on the iPhone over Wi-Fi).

## What your Rafa sheet gives us

`937F15EE-…C7CE.PNG` (1536×1024) already has a transparent background and separates cleanly into **40 sprites**. Rafa's look comes from it: brown-to-blonde wavy hair in a half ponytail, sage-green dress, black wheelchair.

| On the sheet | Used for |
|---|---|
| 5-frame wheelchair push cycle (row 3) | **In-game move animation**, one push per beat |
| 4 small side views (row 3) | In-game idle |
| Arms-up pose (row 2) | Jump apex / fall, and the victory celebration |
| Pointing pose | Gelol ignition and boss taunt |
| Waving, front and 3/4 views | Main menu and level cards |
| On-her-phone pose | Pause screen |
| Arms-crossed, chin-on-hand | Game over, rotate-your-phone screen |
| 8 face expressions | **Live HUD portrait** that reacts (grin under Gelol, angry at rats, shocked on a crash), game-over and victory cards, app icon |
| Loose wheel and chair parts | Crash debris (a wheel rolls away), spinning-wheel overlay |
| 3 back views | Level-complete exit |

**Still to derive (no source art):** Rafa on crutches and Rafa with the knee brace. Both reuse her exact head, hair and upper body from the sheet with a newly drawn standing lower half (the long dress hides the legs, which keeps this clean). The knee brace is strapped **over the dress** — visible, and funnier.

### Fabinho's sheet

`art-src/characters/fabinho-sheet.png` (1536×1024, transparent, **47 sprites**): a boy in a black suit and red tie. Used at 1:1 like Rafa (standing ~238 px, about 2.5 blocks — taller than seated Rafa, which is right).

| On the sheet | Used for |
|---|---|
| 5-frame run cycle (row 2) | **Chasing Rafa**, phase-locked to the beat |
| 2 leap frames, arms up (row 2) | Jumping ahead of Rafa |
| Crouch + half-squat (row 2, right) | Landing, attack wind-up |
| Wave (arm raised) → pointing (arm extended) (row 4) | **Throw**: wind-up then release |
| Push-ups, sit-ups, squat, lunge, stretches (row 3) | Taunts between attack phases (he works out mid-fight) |
| Arms crossed, thinking, thumbs up, on phone, drinking (row 4) | Boss entrance, idle, level card teaser |
| 3-frame walk + turnaround (row 1) | Entrance walk, level card |
| 9 faces: laughing ×5, shocked ×2, angry ×2 (row 5) | Boss portrait in the HUD; **laughing face on the level-2 game-over card**; shocked/angry when beaten |
| Lying face-down, sitting sulking (row 5, right) | Defeated |

### Spider boss: two reference poses (must be in the game)

`art-src/characters/spider-pos1.jpg` and `spider-pos2.jpg` are **pose references only** — photos of a costumed party performer dancing. They are never shipped, traced pixel-for-pixel, or copied into `public/`. The boss is drawn as original pixel art in the style of the two character sheets: **"O Aranha da Carreta"** — the kind of knockoff spider-hero dancer you see on a Brazilian *trenzinho da alegria*, **dancing funk**. Off-model red-and-blue costume that's a bit baggy and wrinkled, own simplified web pattern, own chest emblem, lopsided white eyes, and **sneakers worn over the suit** (as in photo 1). Not Marvel's suit design, and no real group's name, logo or truck livery.

**Everything he does is a dance move.** He arrives on the roof of an original little party train (coloured lights, big speakers pulsing on the beat) that crashes through the gym wall and rolls along ahead of Rafa — that is his stage for the whole fight. When he enters, the music switches to a funk beat.

| Pose | What it is | Used for |
|---|---|---|
| **Pose 1** (`spider-pos1.jpg`) | Deep one-sided squat on the dance floor: one knee up, other leg folded out, body turned 3/4, one arm braced down behind | **His idle/taunt** — he drops into it and bounces on every beat between attacks |
| **Pose 2** (`spider-pos2.jpg`) | Wide, low straddle stance facing sideways, torso leaning forward, one arm reaching out with the hand hanging, other hand planted on the knee | **Attack wind-up** before the swing-dive, and the **level-1 game-over card**: him in this pose right beside Rafa's wheelchair, as in the photo |

These two are the signature poses and get the most drawing care. The other states he needs are drawn to match: a funk two-step (2–4 frames, for when he isn't squatting), web shot with one arm flung out mid-dance, a tucked backflip (the dive), and wrapped up in defeat.

## Decisions that differ from the spec

| Spec | Plan | Why |
|---|---|---|
| "Recognizable Spider-Man" | **"O Aranha Genérico"**: a party performer in an off-model spider costume with sneakers over the suit, drawn as original pixel art in the two poses from your reference photos. | I won't reproduce Marvel's suit design. Your poses are kept exactly; the costume is a knockoff, which fits the humour. |
| React for menus "if useful" | Plain HTML/CSS overlay + TypeScript | Eight simple screens; React adds a build layer and nothing else. |
| Health via Whey | Whey = **one-hit shield** (no health bar) | Keeps "collision restarts the level" true. |
| Game-over screen vs. instant restart | Compact game-over card; **tap anywhere retries** | Shows the jokes without slowing the retry loop. |

## 1. Core rules

Everything is measured in **beats and blocks**, not seconds and pixels. The view shows about 11 blocks of height; width follows the screen (4:3 … 21:9); Rafa is pinned 28% from the left.

- Rafa's x = `beat × 4` blocks, always. An obstacle charted at beat N is exactly where she is on beat N, so the chart is music-synced by construction.
- **Tap = hop**, **hold = big jump** (releasing early cuts the rise). A press is buffered 0.25 beat before landing; coyote time 0.15 beat.
- Starting tuning (the solver in §6 is the authority):

| | Airtime | Apex | Distance |
|---|---|---|---|
| Big jump (hold) | 1.0 beat | 3.0 blocks | 4 blocks |
| Hop (tap, min hold 0.12 beat) | ~0.78 beat | ~1.7 blocks | ~3.1 blocks |

- Hitboxes are forgiving: player 0.7 × 1.3 blocks (her sprite is about 1.35 × 1.9); **small** hazards ≤ 0.7 × 0.6; **big** hazards ≤ 1.4 × 1.2.
- **High hazards** fly at 1.7–2.6 blocks: stay on the ground. These create "don't jump!" beats.
- Ground is a list of segments (gaps = holes, falling in = death). Platforms are one-way, static or moving.
- Death → 250 ms crash → game-over card → tap anywhere restarts at beat 0 with no page reload.

### Hazard behaviours (each a pure function of the beat)

`static` · `drop` (falls, lands on its beat, ground shadow warns 2 beats early) · `run` (moves along the ground: rats, cheese wheel, shockwave) · `bounce` (soccer ball) · `lob` (thrown arc landing on its beat) · `fly` (horizontal, low or high) · `pulse` (on/off with the beat: arena flame jets).

### Power-ups

| Item | Effect |
|---|---|
| **Gelol** (signature) | 12 beats of overdrive, starting on the next beat: the whole game clock runs ×1.3 (the music speeds up with it and charts stay valid), small hazards are smashed on contact, fire trail, heat glow, extra music layer, HUD portrait switches to the big grin. HUD shows a draining timer. |
| Whey | One-hit shield, max one held. Breaking it gives 1 beat of invulnerability. Does not save from holes. |
| Pré-treino | 8 beats of mid-air double jump (jittery caffeine shake). Reaches high lines of golden dumbbells; never required. |
| Halter dourado | Collectible coin. Lines of them trace the ideal jump arcs. Count shown on victory; best saved. |

**Rats** scurry toward Rafa as small hazards in every level (the title's payoff). Under Gelol they get punted off-screen.

## 2. Levels

Each level is one config file: BPM, theme, Rafa version, song, sections, chart. Sections are shared by chart and song so both change together.

| | 1 — Campeonato Gym Rats | 2 — A Vingança do Fabinho | 3 — A Última Rep |
|---|---|---|---|
| Rafa | Wheelchair | Crutches | Knee brace |
| BPM / length | 120 / 144 beats (72 s) | 132 / 176 beats (80 s) | 144 / 208 beats (87 s) |
| Small hazards | dumbbell, kettlebell, water bottle, rat | cone, hydrant, trash bag, rat | plate, battle-rope wave, rat |
| Big hazards | treadmill, bench, plate rack | car, street barrier, dumpster | barbell rack, plyo stack |
| Special | falling plates, hanging punching bag (high) | holes, open manholes, scaffold lifts (moving platforms), falling flowerpots | moving platforms over a foam pit, plate rain, flame jets on the beat |
| Timing margin (solver) | ±60 ms | ±45 ms | ±35 ms |
| Boss | Spider boss | Fabinho | Rei Rato |

Section template (level 1; 2 and 3 follow the same shape, longer): intro and count-in (0–8) → warm-up with "TOQUE!" / "SEGURE!" hint signs (8–40) → main combos, Whey, Pré-treino (40–72) → **Gelol corridor** (72–96) → boss entrance (96–100) → boss in three phases (100–136) → finale (136–144).

### Bosses

A boss is a **visual actor driven by the chart**. Its attacks are ordinary hazards with the behaviours above, so the simulation knows nothing about bosses and the solver covers boss sections too. Each attack is telegraphed 1–2 beats early and lands on a beat. Every finale is the same gag: a Gelol appears and Rafa rams the boss.

| Boss | Attacks (what the player does) | Defeat |
|---|---|---|
| **O Aranha da Carreta** — dances funk on the roof of a party train rolling ahead of Rafa; squat-dances on the beat (pose 1) between attacks | Web blob flung to the floor mid-dance (hop) · web line strung at head height (don't jump) · backflip dive off the train with his own body, wound up from pose 2 (big jump) | Tangled in his own web, he falls into the train's speaker. "Eu treino passinho, não perna!" |
| **Fabinho** — chases from behind, then leaps ahead | Water balloons lobbed over Rafa (hop the splash) · flip-flops thrown flat, high or low · bouncing soccer ball (under the high bounce or over the low one) · final tantrum mixing all three | A window opens: "FABINHO! JÁ PRA CASA!" He is dragged off by the ear. |
| **Rei Rato** (drawn by me) — giant swole rat, tiny crown, tiny legs | Ground-slam shockwave (hop) · weight plates thrown like frisbees, high/low · rat stampede (hop-hop-hop) · giant cheese wheel (big jump) with flame jets | Double Gelol, "A ÚLTIMA REP": he deflates into a normal rat and scurries off. Rafa's brace pops off, confetti, trophy. |

## 3. Art direction

**Your sheet sets the style and the scale.** It is detailed, soft-edged pixel art without a strict pixel grid, so sprites are used **exactly as drawn, at 1:1** — no re-pixelizing, which would wreck the faces. One block = 96 sheet pixels (the in-game Rafa is ~185 px tall, about 2 blocks); the view is 1080 px tall, which lands at 1:1 on current iPhones.

**Rafa's animations**

| State | Wheelchair (from the sheet) | Crutches and knee brace (derived) |
|---|---|---|
| Idle | Side-view frames + breathing bob | Upper body bob, dress hem sway |
| Move | 5-frame push cycle, one push per beat; wheels spin | Crutches: plant-and-swing gait. Brace: run holding the dress, slight limp |
| Jump | Wheelie tilt + stretch; arms-up frame at the top of a big jump | Vault off crutches / tuck |
| Fall | Arms-up frame, tilted forward | Same pose, skirt lifted |
| Land | Squash + dust puff | Squash + dust (crutches spark) |
| Gelol | Pointing pose at ignition, push cycle at double speed, fire trail, glowing outline | Same treatment |
| Death | Spins off, a wheel rolls away, HUD face goes shocked | Crutches / brace fly off |

Whole-sprite tilt, squash and stretch happen at runtime; because the art is soft-edged they stay clean. Poses borrowed from the larger rows are scaled to the in-game size at build time.

**Art I draw** (Rei Rato, rats, hazards, power-ups, backgrounds, effects, logo, plus the spider boss if you don't supply one): authored at 32 art pixels per block and enlarged ×3, with the palette, dark outline and three-tone shading sampled from your sheets so it sits next to Rafa and Fabinho without clashing. Drawn bosses get idle, attack wind-up, attack release, jump/swing or slam, and defeated animations.

**Themes:** Gym — teal walls, mirrors, joke posters ("SEM DOR, SEM GELOL"), neon signs flashing on the beat. Street — sunset sky, buildings with windows lighting on the beat, pharmacy sign "TEM GELOL". Arena — dark, magenta/cyan spotlights, crowd bouncing on the beat, confetti. Three or four parallax layers each.

**UI:** pixel font with Portuguese accents (Pixelify Sans, self-hosted, OFL), pixel borders, thumb-sized buttons, logo with Rafa's angry face and a crossed-out rat.

## 4. Audio

No audio files. A small WebAudio synth (kick, snare, hats, bass, lead, arp, pad) plus a step sequencer, chiptune-flavoured to match the art.

- **One clock for game and music:** game beat and note times both come from the same anchor, so notes are sample-exact and obstacles stay on the beat. Pause, restart and Gelol's ×1.3 tempo re-anchor the clock.
- Songs (pattern data, one file each): L1 bouncy electro in A minor whose **boss section drops into a Brazilian funk beat** (tamborzão-style drum pattern, original melody) for the Aranha; L2 mischievous chiptune in D minor with a cheeky lead; L3 fast hard-dance in F minor with a key lift for the final Gelol. Each has a distinct boss section.
- Overdrive layer (16th-note arp, open filter, double-time hats) while Gelol is active.
- Synth SFX: jump, land, collect, Gelol ignite, shield break, smash, crash, boss sting, victory jingle, UI click.
- iOS: audio unlocks on the JOGAR click; plays through the silent switch on iOS 17+; suspends when the tab is hidden.

## 5. Screens (DOM overlay, PT-BR)

Menu (logo, waving Rafa, JOGAR, FASES, AJUSTES) · Level select (three cards with the three Rafas, best %, boss teaser; all levels unlocked) · Settings (música, efeitos, **reduzir efeitos** for shake/flash, also honouring `prefers-reduced-motion`) · HUD (reactive Rafa portrait, level name, progress bar + %, Gelol timer, shield and pré-treino icons, dumbbell count, attempt number, pause) · Pause (Rafa on her phone) · Game over (sad/angry face, random joke, progress, best, "TOQUE PARA TENTAR DE NOVO") · Victory (arms-up Rafa, score, dumbbells, attempts, PRÓXIMA FASE) · Rotate-device screen on portrait phones (game pauses).

Game-over lines include: "Pelo menos você ganhou a competição." · "LCA destruído." · "Devia ter pulado o dia de perna." · "O Gelol não cobre isso." · "A fisio mandou lembranças." · "Ratos 1 × 0 Rafa." · "Até o Fabinho pulava essa."

## 6. Technical architecture

`phaser` pinned to exactly **3.90.0** (npm `latest` is now Phaser 4), Vite 8, TypeScript strict (`skipLibCheck`), vitest. Runtime dependencies: `phaser` and the font. Dev-only: `pngjs` for the art scripts, Playwright (already cached) for screenshots.

```
index.html              viewport/PWA meta, canvas + UI roots
gallery.html            dev-only: every sprite and animation
art-src/
  characters/           your sheets (Rafa's moves here; Fabinho / spider boss if supplied)
  rafa/                 frame map for the 40 sprites, derived crutches/brace parts, pose data
  pixels/               art I draw: Rei Rato, rats, hazards, items, effects
  backgrounds/          tiles and generators per theme
scripts/
  slice-sheet.mjs       sheet → 40 named sprites by transparency, drops stray specks
  bake-art.mjs          everything → public/art/ atlases + JSON + parallax strips + UI images
  shots.mjs             Playwright screenshots: gallery, every screen, bot runs
src/
  main.ts  types.ts  config.ts  save.ts
  sim/                  PURE TypeScript, no Phaser, no DOM
    sim.ts              integer ticks of 1/120 beat; step() returns SimEvents
    player.ts  behaviors.ts  collide.ts
    solver.ts           beatability sweep (tests + autoplay bot)
  levels/               dsl.ts, level1-gym.ts, level2-street.ts, level3-arena.ts
  game/                 createGame.ts, clock.ts, GameScene.ts, MenuScene.ts, input.ts,
                        rafaView.ts, hazardViews.ts, parallax.ts, fx.ts, bosses/
  audio/                engine.ts, synth.ts, sequencer.ts, sfx.ts, songs/
  ui/                   screens, harden.ts, ui.css, strings.pt-BR.ts
```

- **Simulation is separate from rendering.** `GameScene` reads the beat from `clock.ts`, steps the sim in whole ticks, and draws. Phaser's own smoothed frame delta is not used (it would drift against the audio).
- **Phaser setup:** `Scale.NONE` with a manual `ResizeObserver` (the built-in resize mode renders blurry on retina); zoom snaps to exactly 1 when the screen is within ~12% of 1080 px tall; your sprites use smooth filtering, my ×3 art uses nearest; Phaser audio and input disabled (own WebAudio and pointer handling).
- **Solver = the test that matters.** A forward sweep over press/release decisions proves each level can be finished with hazards widened by that level's timing margin. An unbeatable or unfair chart fails `npm test`.
- **Autoplay bot** (`?bot=1`) replays the solver's inputs inside the real game. Other dev flags: `?level=2`, `?t=96` (start beat), `?debug=1` (hitboxes).
- **Mobile hardening:** `viewport-fit=cover`, no user scaling, `touch-action: none`, no overscroll/callout/selection, `100dvh`, safe-area insets, jump listeners on the game area (any finger) so HUD buttons don't jump, PWA manifest for fullscreen landscape from the home screen.
- **Desktop:** Space / ↑ / click to jump, P or Esc to pause, R to retry.

## 7. Build order (all code by Opus agents)

Agents own disjoint folders so parallel work never touches the same file. A local `git init` with one checkpoint commit per milestone (no remote, nothing pushed). Your sheet is moved to `art-src/characters/rafa-sheet.png`, unmodified.

| Milestone | Agents | Output |
|---|---|---|
| **M0 Foundation** | 1 | Scaffold, `types.ts`, `config.ts`, full `sim/` + solver + tests, clock, `slice-sheet.mjs`, `GameScene` with **wheelchair Rafa's push cycle already in**, grey-box hazards, input, draft level 1. A playable run on your phone. |
| **M1 Content** (parallel) | 4 | **Rafa** (all wheelchair animations, derived crutches and knee-brace versions, HUD faces, UI poses, gallery) · **World art** (bosses, rats, hazards, items, backgrounds, effects, logo) · **Audio** (engine, three songs, SFX, offline-render check) · **UI shell** (all screens, save, mobile hardening, manifest) |
| **M2 Level 1 complete** | 1 | Real art everywhere, effects, power-ups, boss actor framework, spider boss, final level-1 chart synced to its song |
| **M3 Levels 2 and 3** (parallel) | 2 | Each: chart, boss actor, level-specific hazards, song sync |
| **M4 Polish** | 1 | Performance pass, juice (shake, particles, beat pulses), fixes from review, production build |

After each milestone Fable reviews screenshots and bot runs and sends fix notes before the next one starts. You see the gallery after M1 (the derived Rafas and my bosses) before levels 2 and 3 are built. Final pass with `/ponytail-review`.

## 8. Verification

1. `npm test` — sim unit tests, plus the solver finishing all three levels at their timing margins.
2. `npm run build` — strict TypeScript and production bundle succeed.
3. `node scripts/shots.mjs` — headless Chromium at iPhone landscape size (844×390 @3x): gallery sheet with every animation, every UI screen, and the bot reaching 100% on each level with screenshots at 10 points. Fable reads the PNGs.
4. Audio: offline render of 16 bars per song checks for silence and clipping, and writes WAVs you can listen to.
5. On your iPhone, first after M0 and again at the end: `npm run dev -- --host`, open the LAN address. Check: sound starts after JOGAR, rotate screen appears in portrait, no page scroll/zoom/long-press menu, notch doesn't cover the HUD, smooth at 60 fps, retry is instant, jumps feel on the beat (also with Bluetooth audio off).

## Risks

- **The two derived Rafas are the hardest art in the project.** Her upper body is from your sheet; the standing lower half, crutches and brace are new and must match a detailed style. If the gallery after M1 doesn't convince you, a second sheet in the same style (standing, crutches, brace) drops straight into the slicer.
- **My art vs. your sheet:** code-drawn pixel art is flatter than the sheet's shading. Shared palette and outline keep it coherent, but Rafa will be the most detailed thing on screen.
- **Music/gameplay sync and iOS-only behaviour can't be tested here** — only on your phone, hence the check right after M0.

## Not included

Hosting/public URL (local only, per your answer) · English text · level locking · practice mode/checkpoints · level editor · leaderboards.

---

## 9. As built after M0 (supersedes anything above that conflicts)

- **Contract:** `src/types.ts` and `src/config.ts` are the source of truth for level/chart/hazard/sim types, hazard hitboxes (`HAZARDS`) and view constants (`VIEW`). Read them before coding.
- **Physics:** big jump = 1.0 beat, 3.0 blocks apex, 4 blocks long. Hop = ~0.78 beat, **~2.2 blocks apex**, ~3.1 blocks long (min hold 0.2 beat so every natural tap gives the same hop).
- **`drop` and `lob` hazards land `lead` beats (default 1) before Rafa reaches them**; the rule "every chart event is met on its beat" holds for all kinds.
- **Solver** is conservative: no buffered presses, no Pré-treino air jump, a shield break counts as death. It can miss a win but never invents one.
- **Rafa sheet facts:** there is no loose wheel (the "parts" are an empty chair in three views plus two tiny bits); wheel spokes are drawn identically in all five push frames, so spinning needs an overlay or baked rotation; `side_1`/`side_2` are the usable idle.
- **Atlas format:** Phaser JSON-hash atlas with per-frame `pivot` (see `public/art/rafa.json`).

## 10. Art contract for everything drawn in code

- **Density:** 32 art px per block, stored in atlases at **1×** with `"meta": { "scale": 3 }`; the renderer draws them at ×3 with nearest filtering. (Sheet characters are stored 1:1 with smooth filtering.)
- **Palette:** `art-src/palette.json` only. Outline `#140b09`.
- **Look:** 16-bit arcade sprites, not flat shapes: dark outline, at least three tones per material, a highlight, sparing dithering, readable silhouette at phone size. Check every sprite next to Rafa's `push_0` at game scale before calling it done.
- **Frames:** named after `HAZARDS[kind].art` for hazards; pivot at the ground-contact bottom centre unless stated. Sprites are drawn ~1.25–1.4× their hitbox.
- **DOM images** (menus, cards) live in `public/art/ui/<name>.png`, already enlarged, one file per image.

## 11. File ownership during M1 (parallel work)

`package.json` is frozen (scripts are pre-added); only the UI lane may add the font dependency. Nobody commits. Each lane edits only its own paths:

| Lane | Owns |
|---|---|
| Sheets (Rafa wheelchair + Fabinho) | `scripts/slice-sheet.mjs`, `art-src/rafa/`, `art-src/fabinho/`, `public/art/rafa.*`, `public/art/fabinho.*`, `public/art/ui/rafa_*`, `public/art/ui/fabinho_*`, `src/game/rafaView.ts`, `src/art/sheets.ts`, `gallery.html`, `src/gallery.ts`, `scripts/shots-gallery.mjs` |
| Derived Rafas (crutches, brace) | `scripts/bake-kits.mjs`, `art-src/kits/`, `public/art/kits.*`, `public/art/ui/rafakit_*`, `src/game/rafaKits.ts`, `kits.html`, `src/kitsPreview.ts` |
| Drawn bosses | `scripts/bake-bosses.mjs`, `art-src/bosses/`, `public/art/bosses.*`, `public/art/ui/aranha_*`, `public/art/ui/reirato_*` |
| Props (hazards, items, effects) | `scripts/bake-props.mjs`, `art-src/props/`, `public/art/props.*` |
| Backgrounds, ground, logo | `scripts/bake-bg.mjs`, `art-src/bg/`, `public/art/bg/`, `public/art/logo.png` |
| Audio | `src/audio/`, `audio.html`, `scripts/audio-check.mjs` |
| UI | `index.html`, `src/main.ts`, `src/ui/`, `src/save.ts`, `public/manifest.webmanifest`, `public/icons/`, `scripts/shots-ui.mjs`, `scripts/shots.mjs` |
