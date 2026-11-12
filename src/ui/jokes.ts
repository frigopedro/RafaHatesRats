// Game-over lines (PT-BR). A death by something specific often gets its own line; boss attacks always do, with the
// boss's face. Unknown hazard kinds (new ones land before this file hears of them) just get a generic line.

const GENERIC = [
  'Pelo menos você ganhou a competição.', 'LCA destruído.', 'Devia ter pulado o dia de perna.',
  'O Gelol não cobre isso.', 'A fisio mandou lembranças.', 'Ratos 1 × 0 Rafa.', 'Até o Fabinho pulava essa.',
  'Isso conta como cardio?', 'O personal viu tudo.', 'Faltou pré-treino.', 'Falha muscular atingida.',
  'Tecnicamente, foi um agachamento.', 'O ortopedista agradece a preferência.', 'A academia não reembolsa.',
  'Isso vai parar no story de alguém.', 'Postura impecável. Pulo, nem tanto.', 'Sem dor, sem Gelol.',
  'Nenhuma série perdida. Só a dignidade.', 'Bebe uma água e volta.', 'Amanhã é dia de descanso, né?',
  'Bora, campeã. Mais uma série.',
];

type Face = 'sad' | 'angry' | 'shocked';
interface Death { lines: string[]; face: Face; boss?: string; always?: boolean }

const FABINHO: Death = { lines: ['Fabinho 1 × 0 Rafa.', 'Perdeu pro menino que treina de celular na mão.', 'O Fabinho já contou pra academia inteira.'], face: 'angry', boss: 'fabinhogym_face_laugh.png', always: true };
const SPIDER: Death = { lines: ['O Aranha dançou na sua cara.', 'Passinho 1 × 0 Rafa.', 'Presa na teia do funk.'], face: 'angry', boss: 'aranha_pose2.png', always: true };
const GIOVANNI = 'O Giovanni fingiu que não viu.'; // always shown with Giovanni on his phone
const CHURCH = ['A noiva chegou antes.', 'Madrinha caída no corredor.', GIOVANNI];
const church = (...own: string[]): Death => ({ lines: [...own, ...CHURCH], face: 'shocked' });
const PARTY = ['A festa continua sem você.', 'O DJ nem parou a música.', 'Isso vai pro vídeo do casamento.'];
const party = (...own: string[]): Death => ({ lines: [...own, ...PARTY], face: 'sad' });

const BY_CAUSE: Record<string, Death> = {
  // gym
  rat: { lines: ['Ratos 1 × 0 Rafa.', 'Um rato. UM rato.', 'Rafa odeia ratos. Agora com razão.'], face: 'angry' },
  frisbee: FABINHO, shockwave: FABINHO, medBall: { ...FABINHO, lines: [...FABINHO.lines, 'Bola medicinal. Remédio amargo.'] },
  // church
  photographer: church('Saiu linda na foto. No chão.', 'Sorria! Tarde demais.'),
  flowerGirl: church('Atropelada pela daminha.', 'Perdeu pra uma criança de cinco anos.'),
  ringBearer: church('Atropelada pelo pajem.', 'As alianças chegaram antes de você.'),
  rice: church('Arroz é pros noivos, madrinha.'),
  dove: church('A pomba da paz não veio em paz.'),
  kneeler: church('Ajoelhou antes da hora.'),
  candleStand: church('Quase virou vela.'),
  hymnBooks: church('Desafinou no hino.'),
  lantern: church('Iluminada. Literalmente.'),
  pewEnd: church(), flowerStand: church(), flowerBasket: church(),
  // party
  webBlob: SPIDER, webLine: SPIDER, spiderDive: SPIDER,
  waiter: party('Pediu um drink, levou a bandeja.', 'O garçom não viu. Ninguém viu.'),
  cakeTable: party('Era o bolo. ERA.', 'Os noivos nem cortaram ainda.'),
  champagneTower: party('Sete andares de taça. Zero sobreviventes.'),
  balloons: party('Perdeu pra uns balões.'),
  sparkler: party('Brilhou. E queimou.'),
  giftBox: party('Presente devolvido.'),
  chair: party('A cadeira ganhou.'),
  table: party(), champagne: party(),
};

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** The line, Rafa's face and (for bosses) the boss image for a game-over card. */
export function deathCard(cause: string, big: boolean): { line: string; face: Face; boss?: string } {
  const d = Object.hasOwn(BY_CAUSE, cause) ? BY_CAUSE[cause] : undefined;
  if (d && (d.always || Math.random() < 0.6)) {
    const line = pick(d.lines);
    return line === GIOVANNI ? { line, face: d.face, boss: 'giovanni_phone.png' } : { line, face: d.face, boss: d.boss };
  }
  return { line: pick(GENERIC), face: d?.face ?? (big ? 'shocked' : 'sad') };
}

// Title screen: Rafa's line for the level JOGAR starts.
const MENU: Record<string, string[]> = {
  gym: ['Hoje o primeiro lugar é meu. Avisa o Fabinho.', 'Gym Rats tem dona.', 'Dia de perna? Dia de pódio.'],
  church: ['Madrinha de muleta também entra no ritmo.', 'Giovanni, me acompanha. Sem me atrasar.', 'Eu chego no altar antes da noiva.'],
  party: ['Quem convidou esse Aranha?', 'Essa pista é minha.', 'Solta o funk que eu resolvo.'],
};
export const menuLine = (id: string) => pick(MENU[id] ?? MENU.gym);
