// Cut the character sheets into named sprites → public/art/<who>.png + <who>.json (Phaser JSON-hash atlases) and the
// DOM images in public/art/ui/. Sprites = 8-connected components of alpha >= 200 (specks < 150 px dropped); each crop
// keeps the original RGBA of the component plus a 2 px soft-edge ring, everything else in the crop (background haze,
// neighbours) is made transparent. Visual checks go to shots/ (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const OUT = 'public/art';
const UI = 'public/art/ui';
const CHECK = 'shots';
const ALPHA = 200, MIN_PX = 150, RING = 2, PAD = 2;

// [name, expected bbox] in sheet order (row by row, left to right). null = not measured; only the count is checked.
const RAFA = [
  ['turn_front', [53, 24, 166, 282]], ['turn_34', [242, 24, 187, 280]], ['turn_side', [443, 24, 184, 280]],
  ['turn_back34', [641, 24, 175, 279]], ['turn_back', [832, 24, 169, 282]], ['turn_side_l', [1020, 24, 175, 282]],
  ['turn_34_l', [1226, 27, 188, 279]],
  ['pose_idle', [29, 332, 180, 268]], ['pose_wave', [229, 334, 184, 262]], ['pose_phone', [434, 330, 182, 265]],
  ['pose_neutral', [640, 332, 173, 270]], ['pose_armscrossed', [834, 330, 173, 266]], ['pose_armsup', [1024, 326, 161, 274]],
  ['pose_chin', [1196, 355, 158, 247]], ['pose_point', [1363, 337, 168, 263]],
  ['push_0', [29, 620, 131, 182]], ['push_1', [165, 618, 121, 183]], ['push_2', [298, 622, 131, 186]],
  ['push_3', [434, 622, 134, 187]], ['push_4', [572, 632, 139, 177]],
  ['back_0', [750, 624, 100, 182]], ['back_1', [866, 626, 92, 180]], ['back_2', [970, 624, 83, 185]],
  ['side_0', [1133, 632, 104, 186]], ['side_1', [1245, 634, 87, 180]], ['side_2', [1337, 632, 85, 182]],
  ['side_3', [1423, 632, 96, 182]],
  ['face_smile', [36, 829, 128, 175]], ['face_laugh', null], ['face_grin', null], ['face_smile2', null],
  ['face_smile3', null], ['face_shocked', null], ['face_sad', null], ['face_angry', [1032, 833, 129, 175]],
  ['part_chair_side', [1187, 885, 82, 91]], ['part_chair_front', [1279, 878, 65, 88]],
  ['part_chair_back', [1370, 879, 68, 87]], ['part_brake', [1479, 887, 14, 28]], ['part_bracket', [1479, 932, 29, 28]],
];

const FABINHO = [
  ['turn_front', [58, 6, 97, 238]], ['turn_front2', [226, 6, 100, 238]], ['turn_34', [392, 6, 94, 239]],
  ['turn_side', [567, 7, 79, 238]], ['turn_back', [722, 8, 92, 236]], ['turn_back2', [872, 8, 102, 237]],
  ['walk_0', [1042, 14, 115, 231]], ['walk_1', [1187, 11, 124, 234]], ['walk_2', [1336, 14, 120, 229]],
  ['run_0', [36, 278, 148, 201]], ['run_1', [196, 272, 161, 187]], ['run_2', [359, 274, 183, 200]],
  ['run_3', [552, 274, 172, 196]], ['run_4', [719, 277, 169, 197]],
  ['leap_0', [903, 270, 146, 215]], ['leap_1', [1065, 265, 129, 209]], ['crouch', [1235, 325, 133, 155]],
  ['halfsquat', [1412, 268, 108, 211]],
  ['pushup_0', [23, 542, 197, 127]], ['pushup_1', [241, 534, 213, 137]], ['squat', [490, 507, 128, 162]],
  ['lunge', [624, 511, 177, 162]], ['situp_0', [869, 566, 154, 107]], ['situp_1', [1035, 571, 186, 102]],
  ['stretch_side', [1238, 497, 107, 176]], ['stretch_leg', [1364, 532, 157, 153]],
  ['wave', [32, 687, 114, 168]], ['thumb_up', [193, 689, 111, 166]], ['thumb_side', [338, 691, 112, 165]],
  ['armscrossed', [490, 693, 85, 165]], ['thinking', [624, 691, 81, 167]], ['drinking', [756, 701, 106, 157]],
  ['phone', [897, 710, 97, 148]], ['point', [1032, 701, 127, 157]], ['kneel_0', [1186, 725, 106, 141]],
  ['kneel_1', [1357, 728, 134, 141]],
  ['face_laugh', [27, 868, 102, 127]], ['face_laugh2', [162, 871, 104, 124]], ['face_laugh3', [299, 870, 101, 125]],
  ['face_laugh4', [429, 870, 104, 125]], ['face_smile', [561, 870, 103, 125]], ['face_shocked', [693, 871, 100, 124]],
  ['face_shocked2', [817, 869, 104, 126]], ['face_angry', [945, 871, 103, 124]], ['face_angry2', [1073, 871, 102, 124]],
  ['defeated', [1207, 933, 162, 68]], ['sulk', [1392, 888, 125, 117]],
];

// Gym Rafa (level 1). Names starting with '_' are cut but left out of the atlas (the asleep pose's little "Z").
const RAFAGYM = [
  ['turn_front', [25, 16, 108, 257]], ['turn_34', [176, 18, 111, 255]], ['turn_side', [325, 14, 108, 257]],
  ['turn_back34', [486, 17, 106, 254]], ['turn_back', [643, 17, 98, 254]], ['turn_side_l', [776, 15, 111, 256]],
  ['turn_34_l', [921, 17, 112, 256]],
  ['face_smile', [1068, 15, 201, 230]], ['face_laugh', [1271, 15, 184, 230]], ['face_grin', [1454, 17, 186, 228]],
  ['face_shocked', [1640, 16, 178, 228]], ['face_sad', [1818, 18, 177, 226]], ['face_angry', [1996, 21, 173, 223]],
  ['stand_0', [26, 297, 96, 200]], ['stand_1', [152, 298, 92, 199]],
  ['walk_0', [289, 301, 97, 193]], ['walk_1', [406, 304, 114, 185]], ['walk_2', [539, 302, 94, 191]],
  ['walk_3', [652, 306, 100, 187]], ['walk_4', [770, 307, 122, 187]],
  ['run_0', [939, 308, 124, 181]], ['run_1', [1068, 308, 126, 187]], ['run_2', [1190, 308, 130, 185]],
  ['run_3', [1327, 317, 127, 176]], ['run_4', [1463, 317, 119, 176]],
  ['crouch', [1646, 310, 99, 168]], ['leap', [1773, 266, 96, 166]], ['leap_up', [1895, 270, 133, 166]],
  ['land', [2053, 333, 100, 159]],
  ['squat_0', [16, 571, 94, 139]], ['squat_1', [120, 547, 92, 163]], ['squat_2', [226, 524, 84, 186]],
  ['pushup_0', [338, 590, 162, 120]], ['pushup_1', [499, 616, 158, 94]], ['lunge', [679, 544, 131, 166]],
  ['stretch_0', [829, 537, 136, 173]], ['stretch_1', [997, 529, 109, 181]], ['guard', [1125, 529, 103, 181]],
  ['cheer_0', [1247, 528, 136, 182]], ['cheer_1', [1393, 528, 130, 182]],
  ['phone_0', [1544, 536, 94, 174]], ['phone_1', [1683, 545, 91, 165]],
  ['knees', [1818, 565, 149, 146]], ['asleep', [1998, 567, 156, 146]], ['_z', [2106, 564, 17, 22]],
];

// Gym Fabinho v2 (level-1 boss), the crutch Rafa (level 2; 'face_laugh+grin' = two faces touching on the sheet, split
// below) and the level-2 wedding cast: all in Rafa's wheelchair-sheet layout. Boxes from this script's component pass.
const RAFAMULETA_SHEET = [
  ['turn_front', [92, 13, 148, 291]], ['turn_34', [294, 13, 146, 290]], ['turn_side', [489, 14, 123, 289]],
  ['turn_back34', [679, 14, 136, 289]], ['turn_back', [863, 14, 147, 287]], ['turn_side_l', [1070, 14, 118, 287]],
  ['turn_34_l', [1244, 13, 147, 288]],
  ['pose_idle', [45, 329, 144, 273]], ['pose_wave', [241, 329, 156, 273]], ['pose_phone', [443, 329, 135, 273]],
  ['pose_laugh', [627, 327, 153, 273]], ['pose_armscrossed', [811, 329, 144, 272]], ['pose_armsup', [973, 325, 162, 277]],
  ['pose_think', [1172, 336, 143, 266]], ['pose_point', [1337, 331, 183, 275]],
  ['crutch_0', [19, 624, 115, 178]], ['crutch_1', [141, 621, 111, 181]], ['crutch_2', [257, 624, 114, 178]],
  ['crutch_3', [379, 622, 111, 179]], ['crutch_4', [503, 623, 107, 178]], ['back_0', [667, 621, 96, 180]],
  ['back_1', [775, 621, 91, 180]], ['back_2', [878, 621, 94, 180]], ['walk_0', [1034, 629, 109, 176]],
  ['walk_1', [1165, 630, 98, 175]], ['walk_2', [1283, 632, 99, 173]], ['walk_3', [1405, 632, 97, 173]],
  ['face_smile', [15, 851, 119, 153]], ['face_laugh+grin', [137, 852, 230, 152]], ['face_soft', [370, 852, 111, 152]],
  ['face_happy', [485, 852, 109, 152]], ['face_excited', [598, 851, 111, 153]], ['face_shocked', [714, 852, 111, 152]],
  ['face_angry', [828, 852, 120, 152]], ['dance_0', [966, 826, 107, 186]], ['dance_1', [1084, 826, 98, 186]],
  ['dance_2', [1192, 829, 94, 183]], ['dance_3', [1302, 829, 98, 183]], ['dance_4', [1418, 821, 107, 191]],
];
const FABINHOGYM_SHEET = [
  ['turn_front', [90, 12, 122, 296]], ['turn_34', [317, 12, 103, 298]], ['turn_side', [527, 12, 89, 296]],
  ['turn_back34', [710, 12, 103, 298]], ['turn_back', [897, 12, 119, 298]], ['turn_side_l', [1112, 12, 96, 298]],
  ['turn_34_l', [1306, 12, 112, 298]],
  ['pose_idle', [50, 337, 112, 285]], ['pose_wave', [244, 338, 142, 284]], ['pose_phone', [432, 340, 117, 282]],
  ['pose_laugh', [622, 338, 107, 283]], ['pose_armscrossed', [807, 339, 110, 283]], ['pose_armsup', [978, 330, 151, 292]],
  ['pose_think', [1183, 342, 114, 280]], ['pose_point', [1355, 338, 154, 284]],
  ['run_0', [26, 650, 118, 170]], ['run_1', [159, 647, 111, 167]], ['run_2', [278, 650, 120, 170]],
  ['run_3', [417, 650, 109, 174]], ['run_4', [524, 654, 119, 170]], ['back_0', [735, 645, 76, 179]],
  ['back_1', [835, 646, 70, 179]], ['back_2', [925, 646, 74, 179]], ['walk_0', [1072, 650, 108, 175]],
  ['walk_1', [1197, 649, 77, 176]], ['walk_2', [1300, 648, 90, 176]], ['walk_3', [1408, 650, 102, 177]],
  ['face_smile', [41, 850, 148, 171]], ['face_laugh', [229, 850, 148, 171]], ['face_grin', [417, 852, 149, 169]],
  ['face_soft', [607, 850, 145, 170]], ['face_happy', [790, 851, 146, 169]], ['face_shocked', [981, 850, 145, 169]],
  ['face_sad', [1169, 851, 148, 169]], ['face_angry', [1361, 851, 142, 167]],
];
const GIOVANNI_SHEET = [
  ['turn_front', [105, 10, 110, 257]], ['turn_34', [289, 12, 102, 255]], ['turn_side', [482, 13, 88, 253]],
  ['turn_back34', [669, 14, 92, 253]], ['turn_back', [849, 13, 113, 254]], ['turn_side_l', [1049, 13, 87, 254]],
  ['turn_34_l', [1232, 14, 103, 253]],
  ['pose_idle', [73, 290, 110, 262]], ['pose_wave', [258, 293, 131, 260]], ['pose_phone', [440, 292, 107, 261]],
  ['pose_laugh', [624, 292, 116, 263]], ['pose_armscrossed', [800, 294, 111, 260]], ['pose_armsup', [967, 288, 130, 267]],
  ['pose_think', [1161, 306, 103, 251]], ['pose_point', [1325, 300, 164, 257]],
  ['run_0', [22, 593, 126, 175]], ['run_1', [147, 591, 128, 176]], ['run_2', [277, 590, 119, 180]],
  ['run_3', [406, 591, 112, 178]], ['run_4', [533, 595, 101, 174]], ['back_0', [704, 588, 74, 184]],
  ['back_1', [805, 589, 75, 183]], ['back_2', [908, 588, 74, 185]], ['walk_0', [1066, 590, 93, 181]],
  ['walk_1', [1179, 589, 95, 182]], ['walk_2', [1309, 588, 66, 183]], ['walk_3', [1412, 585, 92, 187]],
  ['face_smile', [51, 796, 145, 199]], ['face_laugh', [220, 798, 152, 198]], ['face_grin', [394, 798, 151, 198]],
  ['face_soft', [570, 799, 152, 197]], ['face_happy', [749, 800, 148, 195]], ['face_shocked', [928, 797, 148, 199]],
  ['face_sad', [1107, 800, 149, 195]], ['face_angry', [1297, 806, 150, 189]],
];
const NATHALIA_SHEET = [
  ['turn_front', [24, 14, 199, 275]], ['turn_34', [244, 17, 181, 273]], ['turn_side', [447, 16, 170, 274]],
  ['turn_back34', [644, 17, 184, 272]], ['turn_back', [854, 17, 187, 273]], ['turn_side_l', [1064, 17, 175, 272]],
  ['turn_34_l', [1259, 17, 177, 273]],
  ['pose_idle', [18, 317, 172, 266]], ['pose_wave', [218, 318, 178, 265]], ['pose_phone', [408, 318, 168, 265]],
  ['pose_laugh', [595, 319, 168, 265]], ['pose_armscrossed', [782, 319, 172, 265]], ['pose_armsup', [968, 323, 172, 260]],
  ['pose_think', [1154, 331, 171, 253]], ['pose_point', [1328, 319, 195, 265]],
  ['run_0', [18, 612, 122, 169]], ['run_1', [155, 612, 113, 167]], ['run_2', [278, 616, 113, 163]],
  ['run_3', [402, 616, 110, 166]], ['run_4', [526, 618, 109, 164]], ['back_0', [701, 616, 99, 165]],
  ['back_1', [816, 612, 104, 170]], ['back_2', [931, 615, 101, 167]], ['walk_0', [1083, 621, 95, 159]],
  ['walk_1', [1193, 618, 90, 164]], ['walk_2', [1300, 618, 102, 164]], ['walk_3', [1408, 620, 96, 162]],
  ['face_smile', [28, 815, 145, 190]], ['face_laugh', [187, 815, 157, 190]], ['face_grin', [357, 815, 151, 191]],
  ['face_soft', [521, 815, 144, 190]], ['face_happy', [678, 815, 148, 190]], ['face_shocked', [835, 815, 148, 191]],
  ['face_sad', [993, 815, 150, 190]], ['face_angry', [1153, 815, 161, 192]], ['prop_bouquet', [1327, 863, 99, 119]],
  ['prop_phone', [1438, 894, 61, 82]],
];
const MURILO_SHEET = [
  ['turn_front', [83, 16, 111, 276]], ['turn_34', [285, 16, 105, 278]], ['turn_side', [495, 17, 102, 276]],
  ['turn_back34', [709, 16, 100, 277]], ['turn_back', [896, 16, 115, 276]], ['turn_side_l', [1107, 14, 106, 279]],
  ['turn_34_l', [1304, 16, 107, 278]],
  ['pose_idle', [43, 320, 112, 275]], ['pose_wave', [226, 320, 138, 275]], ['pose_phone', [428, 322, 108, 274]],
  ['pose_laugh', [605, 316, 119, 280]], ['pose_armscrossed', [801, 320, 108, 276]], ['pose_armsup', [972, 315, 145, 281]],
  ['pose_think', [1174, 324, 116, 273]], ['pose_point', [1344, 322, 174, 274]],
  ['run_0', [20, 629, 112, 173]], ['run_1', [145, 628, 110, 174]], ['run_2', [261, 628, 122, 175]],
  ['run_3', [389, 632, 122, 170]], ['run_4', [521, 633, 124, 170]], ['back_0', [715, 626, 74, 179]],
  ['back_1', [820, 626, 73, 179]], ['back_2', [922, 626, 73, 179]], ['walk_0', [1092, 629, 86, 173]],
  ['walk_1', [1196, 629, 87, 173]], ['walk_2', [1308, 629, 79, 174]], ['walk_3', [1419, 629, 87, 174]],
  ['face_smile', [20, 831, 139, 170]], ['face_laugh', [171, 831, 140, 170]], ['face_grin', [323, 831, 139, 170]],
  ['face_soft', [473, 831, 137, 170]], ['face_happy', [620, 831, 138, 170]], ['face_shocked', [768, 831, 138, 170]],
  ['face_sad', [919, 831, 136, 170]], ['face_angry', [1065, 831, 139, 170]], ['prop_phone', [1238, 881, 68, 100]],
  ['prop_watch', [1330, 881, 56, 97]], ['prop_jacket', [1408, 864, 105, 119]],
];

// Ground anchor [x, y] in crop pixels for the in-game frames: x = rear-wheel hub, y = rear-wheel ground contact.
// Measured by registering the tyre ring of each frame against push_0 (±1 px); checked by eye on shots/slice-push.png.
// Phaser uses it as the frame origin, so frames with different bounding boxes do not jitter. Casters/feet hang 3–5 px
// below the rear wheel (3/4 perspective), which reads as standing on the ground line.
const RAFA_ANCHOR = {
  push_0: [36, 178], push_1: [36, 180], push_2: [36, 185], push_3: [39, 185], push_4: [46, 178],
  side_0: [36, 188], side_1: [35, 182], side_2: [36, 184], side_3: [44, 184],
};
const FABINHO_ANCHOR = {};

// DOM images: atlas frame → public/art/ui/<file>.png, copied 1:1.
const RAFA_UI = ['face_smile', 'face_laugh', 'face_grin', 'face_shocked', 'face_sad', 'face_angry', 'pose_wave',
  'pose_phone', 'pose_armscrossed', 'pose_armsup', 'pose_chin', 'pose_point', 'turn_front', 'turn_34']
  .map((n) => [n, `rafa_${n}`]);
const FABINHO_UI = [['face_laugh', 'face_laugh'], ['face_shocked', 'face_shocked'], ['face_angry', 'face_angry'],
  ['armscrossed', 'armscrossed'], ['thumb_up', 'thumb_up'], ['point', 'point'], ['defeated', 'defeated'],
  ['sulk', 'sulk']].map(([n, f]) => [n, `fabinho_${f}`]);
const RAFAGYM_UI = [['face_smile', 'face_smile'], ['face_laugh', 'face_laugh'], ['face_grin', 'face_grin'],
  ['face_shocked', 'face_shocked'], ['face_sad', 'face_sad'], ['face_angry', 'face_angry'], ['turn_34', 'turn_34'],
  ['cheer_0', 'armsup'], ['knees', 'knee'], ['phone_0', 'phone']].map(([n, f]) => [n, `rafagym_${f}`]);

function slice(src, names) {
  const { width: W, height: H, data } = PNG.sync.read(fs.readFileSync(src));
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < ALPHA) continue;
    const id = comps.length;
    let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      n++;
      const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (label[j] === -1 && data[j * 4 + 3] >= ALPHA) { label[j] = id; stack.push(j); }
      }
    }
    comps.push({ id, n, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  const kept = comps.filter((c) => c.n >= MIN_PX);
  if (kept.length !== names.length) throw new Error(`${src}: expected ${names.length} sprites, found ${kept.length}`);

  // Rows: a component joins a row when its vertical centre is above that row's bottom (neighbouring rows can touch).
  kept.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const c of kept) {
    const row = rows.find((r) => c.y + c.h / 2 < r.bottom);
    if (row) { row.items.push(c); row.bottom = Math.max(row.bottom, c.y + c.h); }
    else rows.push({ bottom: c.y + c.h, items: [c] });
  }
  // A name starting with '+' adds its component to the sprite named after it (e.g. the little "Z"s of a sleeping pose).
  const groups = [];
  rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x || a.y - b.y)).forEach((c, i) => {
    const [name, want] = names[i];
    if (want && (want[0] !== c.x || want[1] !== c.y || want[2] !== c.w || want[3] !== c.h)) {
      throw new Error(`${src} ${name}: bbox ${[c.x, c.y, c.w, c.h]} != expected ${want}`);
    }
    if (name.startsWith('+')) groups.find((g) => g.name === name.slice(1)).comps.push(c);
    else groups.push({ name, comps: [c] });
  });
  return groups.map(({ name, comps: cs }) => {
    // Crop = bbox grown by RING; keep a pixel if it is within RING of this sprite's components (soft edge), else
    // transparent.
    const ids = new Set(cs.map((c) => c.id));
    const x = Math.max(0, Math.min(...cs.map((c) => c.x)) - RING), y = Math.max(0, Math.min(...cs.map((c) => c.y)) - RING);
    const w = Math.min(W, Math.max(...cs.map((c) => c.x + c.w)) + RING) - x, h = Math.min(H, Math.max(...cs.map((c) => c.y + c.h)) + RING) - y;
    const png = new PNG({ width: w, height: h });
    for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
      const sx = x + cx, sy = y + cy;
      let keep = false;
      for (let dy = -RING; dy <= RING && !keep; dy++) for (let dx = -RING; dx <= RING && !keep; dx++) {
        const nx = sx + dx, ny = sy + dy;
        keep = nx >= 0 && ny >= 0 && nx < W && ny < H && ids.has(label[ny * W + nx]);
      }
      if (keep) data.copy(png.data, (cy * w + cx) * 4, (sy * W + sx) * 4, (sy * W + sx) * 4 + 4);
    }
    return { name, png, w, h };
  });
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, y * src.width * 4, (y + 1) * src.width * 4);
  }
}

// Shelf-pack into a fixed-width atlas, tallest first. anchors[name] = [x, y] crop px → frame origin (Phaser `anchor`).
function writeAtlas(who, src, sprites, anchors) {
  const ATLAS_W = 2048;
  const byHeight = [...sprites].sort((a, b) => b.h - a.h);
  let sx = PAD, sy = PAD, shelf = 0;
  for (const s of byHeight) {
    if (sx + s.w + PAD > ATLAS_W) { sx = PAD; sy += shelf + PAD; shelf = 0; }
    s.ax = sx; s.ay = sy; sx += s.w + PAD; shelf = Math.max(shelf, s.h);
  }
  const atlas = new PNG({ width: ATLAS_W, height: sy + shelf + PAD });
  const frames = {};
  for (const s of sprites) {
    blit(atlas, s.png, s.ax, s.ay);
    const f = {
      frame: { x: s.ax, y: s.ay, w: s.w, h: s.h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: s.w, h: s.h }, sourceSize: { w: s.w, h: s.h },
    };
    const a = anchors[s.name];
    if (a) f.anchor = { x: a[0] / s.w, y: a[1] / s.h };
    if (s.hub) f.hub = { x: s.hub[0], y: s.hub[1] }; // spokes overlay pivot, crop px (Phaser keeps it in frame.customData)
    if (s.bone) f.bone = s.bone;
    if (s.rig) f.rig = s.rig; // run_upper: hip x relative to her glasses (the body frames' origin) // leg rig: segment length (px) and source angle (rad, atan2(dx, dy): 0 = straight down)
    frames[s.name] = f;
  }
  fs.writeFileSync(path.join(OUT, `${who}.png`), PNG.sync.write(atlas));
  fs.writeFileSync(path.join(OUT, `${who}.json`), JSON.stringify({
    frames, meta: { image: `${who}.png`, size: { w: atlas.width, h: atlas.height }, scale: '1', source: src },
  }, null, 1));
  console.log(`${sprites.length} sprites → ${OUT}/${who}.png (${atlas.width}x${atlas.height}) + ${who}.json`);
}

function writeUi(sprites, list) {
  const by = Object.fromEntries(sprites.map((s) => [s.name, s]));
  for (const [name, file] of list) fs.writeFileSync(path.join(UI, `${file}.png`), PNG.sync.write(by[name].png));
}



const rafa = slice('art-src/characters/rafa-sheet.png', RAFA);
const fab = slice('art-src/characters/fabinho-sheet.png', FABINHO);
const gym = slice('art-src/characters/rafa-sheet-gym.PNG', RAFAGYM).filter((s) => !s.name.startsWith('_'));

// --- Rafa: frames derived at build time (the sheet crops above stay untouched) ---
// Rear-wheel hub [x, y] in crop px: circle fit to the tyre's outer silhouette (rms < 0.7 px), tyre radius 35–36 px.
const HUB = {
  push_0: [36.4, 143.5], push_1: [36.7, 145.3], push_2: [37.9, 150.1], push_3: [40.6, 149.9], push_4: [46.9, 143.3],
};
const R_IN = 22.5; // inside the silver push rim: only spokes, hub and the dark seat / open gaps behind them
const R_TYRE = 36.4; // outer tyre edge incl. its soft rim
// The big-row poses see the wheel more from the front (ellipse fit to the tyre: centre, vertical semi-axis). They are
// scaled so that semi-axis matches the push frames' (36.5 px) and anchored on their own hub / tyre contact.
const POSE_WHEEL = { pose_armsup: [41.2, 215.9, 52.8], pose_point: [43, 207.3, 54.9] };
const PUSH_B = 36.5;

const lumOf = (d, i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const clonePng = (src) => { const p = new PNG({ width: src.width, height: src.height }); src.data.copy(p.data); return p; };

// Spokes are drawn lighter (lum ≥ ~36) than the seat seen behind them (~10–30) or are surrounded by open gaps.
// Body: inside R_IN everything but clearly-behind pixels (empty, or opaque dark seat) is replaced by its nearest
// clearly-behind pixel (BFS), so the dark seat on top and the open gaps below stay put while spokes and their soft
// edges go. Overlay: the spoke pixels alone, rotated at runtime around the hub.
function isBehind(d, i) { return d[i + 3] < 24 || (d[i + 3] >= 200 && lumOf(d, i) < 30); }
function hollow(src, [hx, hy]) {
  const out = clonePng(src), { width: w, height: h, data: d } = src;
  const inside = (x, y) => Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < R_IN + 1;
  const owner = new Int32Array(w * h).fill(-1);
  let queue = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (inside(x, y) && isBehind(d, p * 4)) { owner[p] = p; queue.push(p); }
  }
  while (queue.length) {
    const next = [];
    for (const p of queue) {
      const x = p % w, y = (p - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const q = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || owner[q] !== -1 || !inside(nx, ny)) continue;
        owner[q] = owner[p];
        next.push(q);
      }
    }
    queue = next;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    const k = 1 - smooth(R_IN - 0.5, R_IN + 0.5, Math.hypot(x + 0.5 - hx, y + 0.5 - hy)); // 1 inside, 0 on the rim
    if (k <= 0 || owner[p] === p || owner[p] < 0) continue;
    for (let c = 0; c < 4; c++) out.data[p * 4 + c] = Math.round(d[owner[p] * 4 + c] * k + d[p * 4 + c] * (1 - k));
  }
  return out;
}
function spokes(src, [hx, hy]) {
  const r = Math.ceil(R_IN) + 1, x0 = Math.floor(hx) - r, y0 = Math.floor(hy) - r, size = 2 * r + 1;
  const out = new PNG({ width: size, height: size }), d = src.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = x0 + x, sy = y0 + y, i = (sy * src.width + sx) * 4, o = (y * size + x) * 4;
    const k = 1 - smooth(R_IN - 0.5, R_IN + 0.5, Math.hypot(sx + 0.5 - hx, sy + 0.5 - hy));
    if (k <= 0 || d[i + 3] < 128) continue;
    d.copy(out.data, o, i, i + 3);
    out.data[o + 3] = Math.round(d[i + 3] * k * smooth(28, 44, lumOf(d, i)));
  }
  return { png: out, anchor: [hx - x0, hy - y0] };
}
// Loose wheel for the crash: the whole tyre disc (push_3's is not touched by hand or dress), soft 1 px edge.
function wheelDisc(src, [hx, hy]) {
  const r = Math.ceil(R_TYRE) + 1, x0 = Math.floor(hx) - r, y0 = Math.floor(hy) - r, size = 2 * r + 1;
  const out = new PNG({ width: size, height: size }), d = src.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = x0 + x, sy = y0 + y, i = (sy * src.width + sx) * 4, o = (y * size + x) * 4;
    const k = 1 - smooth(R_TYRE - 0.5, R_TYRE + 0.5, Math.hypot(sx + 0.5 - hx, sy + 0.5 - hy));
    if (k <= 0 || sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
    d.copy(out.data, o, i, i + 3);
    out.data[o + 3] = Math.round(d[i + 3] * k);
  }
  return { png: out, anchor: [hx - x0, hy - y0] };
}
// Lanczos-3 resample by k (down, or up for the small rows of the wedding sheets), separable, in premultiplied alpha (no dark/light fringes on soft edges). The output grid
// is shifted by (ox, oy) < 1 px so the given source point (the anchor) lands on a whole output pixel — the sprite then
// sits on exact pixels like the 1:1 frames.
function downscale(src, k, [ax, ay]) {
  const ox = Math.ceil(ax * k) - ax * k, oy = Math.ceil(ay * k) - ay * k;
  const sw = src.width, sh = src.height, w = Math.ceil(sw * k + ox), h = Math.ceil(sh * k + oy);
  const lanczos = (x) => (x === 0 ? 1 : Math.abs(x) >= 3 ? 0 : (3 * Math.sin(Math.PI * x) * Math.sin((Math.PI * x) / 3)) / (Math.PI * Math.PI * x * x));
  // Pixels outside the source count as transparent, so edges fade instead of being renormalised away.
  const pass = (from, n, len, stride, outN, off, get, set) => {
    for (let o = 0; o < outN; o++) {
      const c = (o + 0.5 - off) / k - 0.5, taps = [], f = Math.min(k, 1); // kernel widens only when shrinking
      let sum = 0;
      for (let t = Math.ceil(c - 3 / f); t <= Math.floor(c + 3 / f); t++) {
        const wt = lanczos((t - c) * f);
        sum += wt;
        if (t >= 0 && t < len) taps.push([t, wt]);
      }
      for (let line = 0; line < n; line++) {
        const acc = [0, 0, 0, 0];
        for (const [t, wt] of taps) for (let ch = 0; ch < 4; ch++) acc[ch] += from[get(line, t) + ch] * wt;
        for (let ch = 0; ch < 4; ch++) set(line, o, ch, acc[ch] / sum);
      }
    }
  };
  const pre = new Float64Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const al = src.data[i * 4 + 3] / 255;
    for (let ch = 0; ch < 3; ch++) pre[i * 4 + ch] = src.data[i * 4 + ch] * al;
    pre[i * 4 + 3] = al;
  }
  const tmp = new Float64Array(w * sh * 4), res = new Float64Array(w * h * 4);
  pass(pre, sh, sw, 1, w, ox, (y, x) => (y * sw + x) * 4, (y, x, ch, v) => (tmp[(y * w + x) * 4 + ch] = v));
  pass(tmp, w, sh, 1, h, oy, (x, y) => (y * w + x) * 4, (x, y, ch, v) => (res[(y * w + x) * 4 + ch] = v));
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    const al = Math.min(1, res[i * 4 + 3]);
    if (al < 1 / 255) continue;
    for (let ch = 0; ch < 3; ch++) out.data[i * 4 + ch] = Math.max(0, Math.min(255, Math.round(res[i * 4 + ch] / al)));
    out.data[i * 4 + 3] = Math.round(al * 255);
  }
  return { png: out, anchor: [Math.round(ax * k + ox), Math.round(ay * k + oy)] };
}

const byName = (list) => Object.fromEntries(list.map((s) => [s.name, s]));
const RB = byName(rafa);
const derived = [];
const add = (name, png, anchor, hub) => {
  derived.push({ name, png, w: png.width, h: png.height, hub });
  RAFA_ANCHOR[name] = anchor;
};
for (const [name, hub] of Object.entries(HUB)) {
  add(name.replace('push_', 'roll_'), hollow(RB[name].png, hub), RAFA_ANCHOR[name], hub);
}
{
  const s = spokes(RB.push_3.png, HUB.push_3);
  add('spokes', s.png, s.anchor);
  const wd = wheelDisc(RB.push_3.png, HUB.push_3);
  add('part_wheel', wd.png, wd.anchor);
}
for (const [name, [cx, cy, b]] of Object.entries(POSE_WHEEL)) {
  const ds = downscale(RB[name].png, PUSH_B / b, [cx, cy + b]);
  add(name.replace('pose_', '') + '_s', ds.png, ds.anchor);
}

// Fabinho: ground = bottom of the sprite (feet, or whatever touches the floor); x = centre of his hair, so the head
// holds still while legs and arms swing (run, walk, leap). Sit-ups pivot on the feet (right edge).
function hairX(png) {
  let n = 0, sx = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b, a] = png.data.subarray(i, i + 4);
    if (a >= 200 && r > 90 && r < 215 && g > 45 && g < 140 && b > 15 && b < 95 && r - g > 30 && g - b > 15 && r - b > 60) {
      n++; sx += (i / 4) % png.width;
    }
  }
  return Math.round(sx / n);
}
// Push-ups pivot on the front hand (rightmost opaque pixel near the floor).
function handX(png) {
  let x1 = 0;
  for (let y = png.height - 12; y < png.height - RING; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] >= 200) x1 = Math.max(x1, x);
  }
  return x1 - 12;
}
for (const s of fab) {
  const x = s.name.startsWith('situp_') ? s.w - 40 : s.name.startsWith('pushup_') ? handX(s.png)
    : s.name.startsWith('face_') ? Math.round(s.w / 2) : hairX(s.png);
  FABINHO_ANCHOR[s.name] = [x, s.h - RING];
}

// Gym Rafa: ground = bottom of the sprite; x = her glasses (dark rim pixels with face skin just above and below), so
// the head holds still while her long hair streams back. Back views have no glasses (centred); push-ups use the hand.
function glassesX(png) {
  const { width: w, height: h, data: d } = png;
  const at = (x, y) => (y * w + x) * 4;
  const skin = (i) => d[i + 3] >= 200 && d[i] > 150 && d[i + 1] > 85 && d[i + 2] > 50 && d[i] - d[i + 2] > 45 && d[i] > d[i + 1];
  let n = 0, sx = 0;
  for (let y = 5; y < h / 2; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    if (d[i + 3] < 200 || Math.max(d[i], d[i + 1], d[i + 2]) > 75) continue;
    let up = false, dn = false;
    for (let k = 1; k <= 5; k++) {
      up ||= y - k >= 0 && skin(at(x, y - k));
      dn ||= y + k < h && skin(at(x, y + k));
    }
    if (up && dn) { n++; sx += x; }
  }
  return n > 60 ? Math.round(sx / n) : Math.round(w / 2);
}
const RAFAGYM_ANCHOR = {};
for (const s of gym) {
  const x = s.name.startsWith('pushup_') ? handX(s.png) : s.name.startsWith('face_') ? Math.round(s.w / 2) : glassesX(s.png);
  RAFAGYM_ANCHOR[s.name] = [x, s.h - RING];
}

fs.mkdirSync(UI, { recursive: true });
// Gelol glow: one soft warm silhouette per Rafa, baked here from a representative frame (alpha grown and blurred,
// three box-blur passes) and drawn behind her as a single additive quad — no FX passes at runtime.
function glowFrom(png, [ax, ay], pad = 18, radius = 6) {
  const w = png.width + 2 * pad, h = png.height + 2 * pad;
  let a = new Float32Array(w * h);
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) a[(y + pad) * w + x + pad] = png.data[(y * png.width + x) * 4 + 3] / 255;
  for (let pass = 0; pass < 3; pass++) for (const horiz of [true, false]) {
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) sum += a[yy * w + xx];
      }
      b[y * w + x] = sum / (2 * radius + 1);
    }
    a = b;
  }
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(1, a[i] * 1.8);
    if (v > 0.004) out.data.set([255, Math.round(120 + 60 * v), 40, Math.round(255 * v)], i * 4); // yellower at the core
  }
  return { name: 'glow', png: out, w, h, anchor: [ax + pad, ay + pad] };
}
const addGlow = (list, anchors, frame) => {
  const g = glowFrom(byName(list)[frame].png, anchors[frame]);
  anchors.glow = g.anchor;
  return g;
};
writeAtlas('rafa', 'art-src/characters/rafa-sheet.png', [...rafa, ...derived, addGlow(rafa, RAFA_ANCHOR, 'push_0')], RAFA_ANCHOR);
writeAtlas('fabinho', 'art-src/characters/fabinho-sheet.png', fab, FABINHO_ANCHOR);
// --- Gym Rafa: cut-out parts for the run rig (src/game/rafaGym.ts). The sheet's five run frames are near-copies of one
// mid-stride pose, so the run is rebuilt from her own pixels: upper body from run_1, a straight striped leg from run_4
// (cut at the knee into thigh + shin), the flat side-on shoe from walk_0. Points are crop px of those frames.
const RIG = {
  hip: [60, 112], // run_1 hip joint; the upper body is what lies above y 108 (both arms and the fist stay)
  cutY: 108,
  pelvis: [66, 112, 22, 11], // legging-coloured filler under the hem: centre, radii — no gap opens as the thighs swing
  leg: [[56, 101], [40, 124.5], [24, 148]], // run_4 near leg axis: hip, knee, ankle
  thighR: 11.5, shinR: 10.5,
  ankle: [64, 163], // walk_0 front shoe: ankle pivot; the shoe is what lies right of x 53 and below y 162
};
const OUTLINE = [28, 19, 19]; // her sheet's dark outline, drawn along edges the cut creates
const LEGGING = [40, 33, 33];
const segDist = ([ax, ay], [bx, by], x, y) => {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
};
// keep(x, y, px) → coverage 0..1 at a pixel centre. Crops to what is kept; cut edges (kept pixel beside an opaque pixel
// the cut removed) take the outline colour so a part never shows a raw edge — `outline` may limit that to some pixels.
// `thicken` widens thin light lines (the leggings' stripe) by half a pixel each side, so they stay continuous when the
// part is rotated with smooth filtering.
function cutPart(src, keep, pivot, { outline = true, recolor, thicken = false } = {}) {
  const { width: w, height: h, data: d } = src;
  const k = new Float32Array(w * h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, c = d[i + 3] ? keep(x + 0.5, y + 0.5, d.subarray(i, i + 4)) : 0;
    k[y * w + x] = c;
    if (c > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const out = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = y * w + x, c = k[p];
    if (c <= 0) continue;
    const px = [...d.subarray(p * 4, p * 4 + 4)];
    if (recolor) recolor(px);
    if (thicken && lumAt(px) < 100) {
      let best = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = ((y + dy) * w + x + dx) * 4;
        if (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && k[(y + dy) * w + x + dx] > 0 && lumAt(d.subarray(q, q + 3)) > 150) best = d.subarray(q, q + 3);
      }
      if (best) for (let c = 0; c < 3; c++) px[c] = Math.round(px[c] * 0.55 + best[c] * 0.45);
    }
    let edge = false;
    const lineOk = typeof outline === 'function' ? outline(x + 0.5, y + 0.5) : outline;
    for (let dy = -1; dy <= 1 && lineOk && !edge; dy++) for (let dx = -1; dx <= 1 && !edge; dx++) {
      const nx = x + dx, ny = y + dy;
      edge = nx >= 0 && ny >= 0 && nx < w && ny < h && k[ny * w + nx] < 0.5 && d[(ny * w + nx) * 4 + 3] >= 128;
    }
    if (edge) px.splice(0, 3, ...OUTLINE);
    out.data.set([px[0], px[1], px[2], Math.round(px[3] * c)], ((y - y0) * out.width + x - x0) * 4);
  }
  return { png: out, anchor: [pivot[0] - x0, pivot[1] - y0] };
}
const GB = byName(gym);
const lumAt = (px) => (px[0] + px[1] + px[2]) / 3;
const isSkin = (px) => px[0] > 150 && px[0] - px[2] > 50 && px[0] > px[1];
// The far leg's stripe faces away from the camera: paint it out with the legging colour.
const noStripe = (px) => { if (lumAt(px) > 46) px.splice(0, 3, ...LEGGING); }; // stripe and its soft edge
const soft = (v) => Math.max(0, Math.min(1, v + 0.5)); // coverage from a signed distance inside an edge
const [lh, lk, la] = RIG.leg;
const bone = (a, b) => ({ len: Math.hypot(b[0] - a[0], b[1] - a[1]), angle: Math.atan2(b[0] - a[0], b[1] - a[1]) });
const rigParts = [];
const addPart = (name, part, extra = {}) => {
  rigParts.push({ name, png: part.png, w: part.png.width, h: part.png.height, ...extra });
  RAFAGYM_ANCHOR[name] = part.anchor;
};
addPart('run_upper', cutPart(GB.run_1.png, (x, y) => soft(RIG.cutY - y), RIG.hip, { outline: false }),
  { rig: { hipDx: RIG.hip[0] - RAFAGYM_ANCHOR.run_1[0], hipUp: RIG.hip[1] - RAFAGYM_ANCHOR.run_1[1] } });
// Hip filler: an outlined ellipse in the legging (or shorts) colour, pivot at the hip joint.
function pelvisPart([cx, cy, rx, ry], hip, fill) {
  const w = 2 * rx + 4, h = 2 * ry + 4, png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.hypot((x + 0.5 - w / 2) / rx, (y + 0.5 - h / 2) / ry); // 1 on the rim
    const a = soft((1 - e) * ry), rim = e > 1 - 1.8 / ry;
    if (a > 0) png.data.set([...(rim ? OUTLINE : fill), Math.round(255 * a)], (y * w + x) * 4);
  }
  return { png, anchor: [w / 2 - (cx - hip[0]), h / 2 - (cy - hip[1])] };
}
addPart('pelvis', pelvisPart(RIG.pelvis, RIG.hip, LEGGING));
for (const far of [false, true]) {
  const recolor = far ? noStripe : undefined, sfx = far ? '_far' : '';
  const leg = (r, a, b) => (x, y, px) => (isSkin(px) || (y > la[1] - 10 && lumAt(px) > 140) ? 0 : soft(r - segDist(a, b, x, y)));
  addPart('thigh' + sfx, cutPart(GB.run_4.png, leg(RIG.thighR, lh, lk), lh, { recolor, thicken: !far }), { bone: bone(lh, lk) });
  addPart('shin' + sfx, cutPart(GB.run_4.png, leg(RIG.shinR, lk, la), lk, { recolor, thicken: !far }), { bone: bone(lk, la) });
}
addPart('shoe', cutPart(GB.walk_0.png, (x, y) => (x >= 53 && y >= 162 ? 1 : 0), RIG.ankle, { outline: false }));

writeAtlas('rafagym', 'art-src/characters/rafa-sheet-gym.PNG', [...gym, ...rigParts, addGlow(gym, RAFAGYM_ANCHOR, 'run_1')], RAFAGYM_ANCHOR);

// Sheet characters with the standard layout: x = centre of the face (skin in the top 30% of the sprite), y = feet.
// In-game scale is each sheet's small row used 1:1; `g_` frames are that scale: small-row frames are copied as they
// are, row-2 poses are scaled down (Lanczos, premultiplied) to the character's own standing height in the small row
// (back_0, a standing frame).
function faceX(png) {
  let n = 0, sx = 0;
  for (let y = 0; y < png.height * 0.3; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4, [r, g, b, a] = png.data.subarray(i, i + 4);
    if (a >= 200 && r > 150 && r - b > 40 && r > g && g > 80) { n++; sx += x; }
  }
  return n > 40 ? Math.round(sx / n) : Math.round(png.width / 2);
}
function gPoses(by, anchors, names, height = by.back_0.h - 2 * RING) {
  const k = height / (by.pose_idle.h - 2 * RING), out = [];
  for (const n of names) {
    const r = downscale(by[n].png, k, anchors[n]);
    out.push({ name: `g_${n}`, png: r.png, w: r.png.width, h: r.png.height });
    anchors[`g_${n}`] = r.anchor;
  }
  console.log(`  g_ poses × ${k.toFixed(3)} (${names.length})`);
  return out;
}
const standardAnchors = (sprites) => Object.fromEntries(sprites.map((s) =>
  [s.name, [/^(face_|prop_)/.test(s.name) ? Math.round(s.w / 2) : faceX(s.png), s.h - RING]]));

// Gym Fabinho v2 (level-1 boss): replaces fabinho-gym.PNG under the same atlas name. His run row is a genuine cycle.
// Knocked flat = his scaled idle pose turned 90° clockwise (a lossless pixel transpose: head to the right).
const fabgym = slice('art-src/characters/fabinho-v2-gym.PNG', FABINHOGYM_SHEET);
const FABINHOGYM_ANCHOR = standardAnchors(fabgym);
{
  const g = gPoses(byName(fabgym), FABINHOGYM_ANCHOR,
    ['pose_idle', 'pose_wave', 'pose_phone', 'pose_laugh', 'pose_armscrossed', 'pose_armsup', 'pose_think', 'pose_point']);
  const src = g.find((f) => f.name === 'g_pose_idle').png, png = new PNG({ width: src.height, height: src.width });
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    src.data.copy(png.data, (y * png.width + x) * 4, ((src.height - 1 - x) * src.width + y) * 4, ((src.height - 1 - x) * src.width + y) * 4 + 4);
  }
  g.push({ name: 'g_defeated', png, w: png.width, h: png.height });
  FABINHOGYM_ANCHOR.g_defeated = [Math.round(png.width / 2), png.height - RING];
  writeAtlas('fabinhogym', 'art-src/characters/fabinho-v2-gym.PNG', [...fabgym, ...g], FABINHOGYM_ANCHOR);
  writeUi(fabgym, [['face_laugh', 'face_laugh'], ['face_shocked', 'face_shocked'], ['face_angry', 'face_angry'],
    ['turn_34', 'turn_34'], ['pose_armsup', 'armsup']].map(([n, f]) => [n, `fabinhogym_${f}`]));
  fs.rmSync(path.join(UI, 'fabinhogym_asleep.png'), { force: true }); // the v1 sheet's sleeping pose has no v2 match
}

// The crutch Rafa (level 2), from her own sheet.
const muleta = slice('art-src/characters/rafaela-muleta.PNG', RAFAMULETA_SHEET);
{
  // Two faces touch on the sheet: split at the emptiest column of the middle third.
  const i = muleta.findIndex((s) => s.name === 'face_laugh+grin'), s = muleta[i];
  let cut = 0, best = Infinity;
  for (let x = Math.floor(s.w / 3); x < (2 * s.w) / 3; x++) {
    let n = 0;
    for (let y = 0; y < s.h; y++) if (s.png.data[(y * s.w + x) * 4 + 3] >= 128) n++;
    if (n < best) { best = n; cut = x; }
  }
  const part = (x0, x1, name) => {
    const png = new PNG({ width: x1 - x0, height: s.h });
    for (let y = 0; y < s.h; y++) s.png.data.copy(png.data, y * png.width * 4, (y * s.w + x0) * 4, (y * s.w + x1) * 4);
    return { name, png, w: png.width, h: png.height };
  };
  muleta.splice(i, 1, part(0, cut, 'face_laugh'), part(cut, s.w, 'face_grin'));
}
const RAFAMULETA_ANCHOR = standardAnchors(muleta);
writeAtlas('rafamuleta', 'art-src/characters/rafaela-muleta.PNG', [...muleta,
  ...gPoses(byName(muleta), RAFAMULETA_ANCHOR, ['pose_idle', 'pose_armsup', 'pose_point', 'pose_phone']),
  addGlow(muleta, RAFAMULETA_ANCHOR, 'walk_0')], RAFAMULETA_ANCHOR);
writeUi(muleta, [['face_smile', 'face_smile'], ['face_laugh', 'face_laugh'], ['face_grin', 'face_grin'],
  ['face_shocked', 'face_shocked'], ['face_angry', 'face_angry'], ['turn_34', 'turn_34'], ['pose_armsup', 'armsup'],
  ['pose_phone', 'phone'], ['dance_0', 'dance']].map(([n, f]) => [n, `rafamuleta_${f}`]));

// Taller without a bigger head (these are chibi sprites: height comes from the body). The neck line is the
// narrowest silhouette row near the face, 25–55% down the figure; above it the frame is copied 1:1 (head, and hands
// raised above it), below it the body is resampled — Lanczos-2 in premultiplied alpha — `sy` taller and up to `sx`
// wider about the feet pivot, the widening easing in over 12 px so the neck joins seamlessly.
function neckRow(png, [ax]) {
  const { width: w, height: h, data: d } = png;
  const opaque = (x, y) => d[(y * w + x) * 4 + 3] >= 128;
  let top = 0;
  while (top < h && ![...Array(w).keys()].some((x) => opaque(x, top))) top++;
  let neck = top, best = Infinity;
  for (let y = Math.round(top + 0.25 * (h - top)); y <= top + 0.55 * (h - top); y++) {
    let n = 0;
    for (let x = Math.max(0, Math.round(ax - 28)); x <= Math.min(w - 1, Math.round(ax + 28)); x++) if (opaque(x, y)) n++;
    if (n < best) { best = n; neck = y; }
  }
  return { top, neck };
}
function stretchBody(png, [ax, ay], sy, sx) {
  const { width: w, height: h, data: d } = png, { neck } = neckRow(png, [ax]);
  const ox = Math.ceil(ax * (sx - 1)) + 1, W2 = Math.ceil(w * sx) + 2, H2 = neck + Math.ceil((h - neck) * sy);
  const out = new PNG({ width: W2, height: H2 });
  const lanczos2 = (t) => (t === 0 ? 1 : Math.abs(t) >= 2 ? 0 : (2 * Math.sin(Math.PI * t) * Math.sin((Math.PI * t) / 2)) / (Math.PI * Math.PI * t * t));
  const px = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : (y * w + x) * 4);
  for (let Y = 0; Y < H2; Y++) for (let X = 0; X < W2; X++) {
    const o = (Y * W2 + X) * 4;
    if (Y < neck) { // head: an exact copy
      const sxp = X - ox;
      if (sxp >= 0 && sxp < w) d.copy(out.data, o, (Y * w + sxp) * 4, (Y * w + sxp) * 4 + 4);
      continue;
    }
    const kx = 1 + (sx - 1) * Math.min(1, (Y - neck) / 12);
    const u = ax + (X + 0.5 - ox - ax) / kx - 0.5, v = neck + (Y + 0.5 - neck) / sy - 0.5;
    let r = 0, g = 0, b = 0, a = 0, sum = 0;
    for (let j = Math.floor(v) - 1; j <= Math.floor(v) + 2; j++) for (let i = Math.floor(u) - 1; i <= Math.floor(u) + 2; i++) {
      const wgt = lanczos2(u - i) * lanczos2(v - j);
      sum += wgt;
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const q = px(i, j), al = (d[q + 3] / 255) * wgt;
      r += d[q] * al; g += d[q + 1] * al; b += d[q + 2] * al; a += al;
    }
    const al = Math.min(1, a / sum);
    if (al < 1 / 255) continue;
    out.data.set([r / a, g / a, b / a].map((c) => Math.max(0, Math.min(255, Math.round(c)))).concat(Math.round(al * 255)), o);
  }
  return { png: out, anchor: [ax + ox, Math.round(neck + (ay - neck) * sy)], neck };
}

const WEDDING = {
  // Giovanni is taller than Rafa: his body (below the neck) is stretched so he stands this tall, head kept at scale.
  giovanni: { src: 'art-src/characters/giovanni-sheet.PNG', names: GIOVANNI_SHEET, stretch: { height: 212, widen: 1.06 },
    ui: [['turn_34', 'giovanni'], ['pose_phone', 'giovanni_phone'], ['face_laugh', 'giovanni_face_laugh']] },
  nathalia: { src: 'art-src/characters/nathalia-sheet.PNG', names: NATHALIA_SHEET,
    ui: [['face_smile', 'nathalia_face_smile'], ['turn_34', 'nathalia_turn_34']] },
  murilo: { src: 'art-src/characters/murilo-sheet.PNG', names: MURILO_SHEET,
    ui: [['turn_34', 'murilo_turn_34']] },
};
const stretchLog = [];
const G_SMALL = ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
const G_POSES = ['pose_idle', 'pose_phone', 'pose_armsup', 'pose_laugh', 'pose_wave', 'pose_think'];
const wedding = {};
for (const [who, c] of Object.entries(WEDDING)) {
  const sprites = slice(c.src, c.names), by = byName(sprites), anchors = {};
  for (const s of sprites) {
    anchors[s.name] = [/^(face_|prop_)/.test(s.name) ? Math.round(s.w / 2) : faceX(s.png), s.h - RING];
  }
  const scaled = G_SMALL.map((n) => ({ ...by[n], name: `g_${n}` }));
  for (const n of G_SMALL) anchors[`g_${n}`] = anchors[n];
  scaled.push(...gPoses(by, anchors, G_POSES));
  let ui = sprites;
  if (c.stretch) {
    // One vertical factor for every frame, from his standing back view: its body grows until he stands c.stretch.height.
    const { top, neck } = neckRow(by.back_0.png, anchors.back_0), feet = anchors.back_0[1];
    const sy = (c.stretch.height - (neck - top)) / (feet - neck), sx = c.stretch.widen;
    for (const f of scaled) {
      const r = stretchBody(f.png, anchors[f.name], sy, sx);
      Object.assign(f, { png: r.png, w: r.png.width, h: r.png.height });
      anchors[f.name] = r.anchor;
      stretchLog.push(`${f.name}: neck ${r.neck}/${r.png.height}`);
    }
    // DOM images (1:1 big rows): the two sheets' big rows are not drawn at the same scale, so each is fitted to Rafa's
    // matching image instead — head kept, body stretched until he stands RATIO × her height there. Faces stay as they are.
    const MB = byName(muleta), ratio = c.stretch.height / (MB.back_0.h - 2 * RING);
    ui = sprites.map((sp) => {
      if (/^face_/.test(sp.name) || !MB[sp.name] || !c.ui.some(([n]) => n === sp.name)) return sp;
      const her = MB[sp.name], herH = RAFAMULETA_ANCHOR[sp.name][1] - neckRow(her.png, RAFAMULETA_ANCHOR[sp.name]).top;
      const n = neckRow(sp.png, anchors[sp.name]), feet = anchors[sp.name][1];
      const k = (ratio * herH - (n.neck - n.top)) / (feet - n.neck);
      console.log(`  ${who} DOM ${sp.name}: her ${herH} px → his ${Math.round(ratio * herH)} px, body × ${k.toFixed(3)}`);
      return { ...sp, png: stretchBody(sp.png, anchors[sp.name], k, sx).png };
    });
    console.log(`  ${who}: body × ${sy.toFixed(3)} tall, × ${sx} wide below the neck (standing ${c.stretch.height} px)`);
  }
  wedding[who] = { sprites, scaled, anchors };
  writeAtlas(who, c.src, [...sprites, ...scaled], anchors);
  writeUi(ui, c.ui);
}
writeUi(rafa, RAFA_UI);
writeUi(fab, FABINHO_UI);
writeUi(gym, RAFAGYM_UI);
console.log(`${RAFA_UI.length + FABINHO_UI.length + RAFAGYM_UI.length}+ DOM images → ${UI}/`);

// --- visual checks (git-ignored) ---
fs.mkdirSync(CHECK, { recursive: true });
function fill(png, rgba) { for (let i = 0; i < png.data.length; i += 4) png.data.set(rgba, i); }
function over(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
    const si = (y * src.width + x) * 4, di = (ty * dst.width + tx) * 4;
    const a = src.data[si + 3] / 255;
    for (let k = 0; k < 3; k++) {
      dst.data[di + k] = Math.round(src.data[si + k] * a + dst.data[di + k] * (1 - a));
    }
  }
}
// Contact sheet: 8 per row on light grey, in sheet order.
function contact(file, sprites) {
  const CELL = 300;
  const png = new PNG({ width: CELL * 8, height: CELL * Math.ceil(sprites.length / 8) });
  fill(png, [205, 215, 210, 255]);
  sprites.forEach((s, i) => over(png, s.png, (i % 8) * CELL + ((CELL - s.w) >> 1), Math.floor(i / 8) * CELL + ((CELL - s.h) >> 1)));
  fs.writeFileSync(path.join(CHECK, file), PNG.sync.write(png));
}
contact('slice-contact.png', rafa);
contact('slice-fabinho.png', fab);
contact('slice-gym.png', gym);

// Anchor check, 2x: each group's frames placed by anchor on a shared baseline (black) and anchor line (red), followed
// by the plain average of the group — a sharp wheel / torso there means no jitter.
function onion(file, sprites, anchors, groups, CW = 160, CH = 220) {
  const by = byName(sprites);
  const BASE_Y = CH - 20, AX = Math.round(CW / 2);
  const cells = groups.map((g) => g.map((n) => by[n])).flatMap((g) => [...g.map((s) => [s]), g]);
  const strip = new PNG({ width: CW * cells.length, height: CH });
  cells.forEach((list, i) => {
    const acc = new Float64Array(CW * CH * 3);
    for (const s of list) {
      const one = new PNG({ width: CW, height: CH });
      fill(one, [235, 235, 235, 255]);
      over(one, s.png, AX - anchors[s.name][0], BASE_Y - anchors[s.name][1]);
      for (let p = 0; p < CW * CH; p++) for (let k = 0; k < 3; k++) acc[p * 3 + k] += one.data[p * 4 + k] / list.length;
    }
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const p = y * CW + x, d = (y * strip.width + i * CW + x) * 4;
      strip.data.set([acc[p * 3], acc[p * 3 + 1], acc[p * 3 + 2], 255], d);
      if (y === BASE_Y) strip.data.set([0, 0, 0, 255], d);
      if (x === AX) strip.data.set([255, 0, 0, 255], d);
    }
  });
  const big = new PNG({ width: strip.width * 2, height: strip.height * 2 });
  for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) {
    strip.data.copy(big.data, (y * big.width + x) * 4, ((y >> 1) * strip.width + (x >> 1)) * 4, ((y >> 1) * strip.width + (x >> 1)) * 4 + 4);
  }
  fs.writeFileSync(path.join(CHECK, file), PNG.sync.write(big));
}
const R_ALL = [...rafa, ...derived];
const seq = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}`);
onion('slice-push.png', R_ALL, RAFA_ANCHOR, [seq('push_', 5), seq('side_', 4)]);
onion('slice-poses.png', R_ALL, RAFA_ANCHOR, [seq('roll_', 5), ['push_0', 'armsup_s'], ['push_0', 'point_s']], 260);
onion('slice-fab-run.png', fab, FABINHO_ANCHOR, [seq('run_', 5), seq('walk_', 3)], 260, 260);
onion('slice-gym-run.png', gym, RAFAGYM_ANCHOR, [seq('run_', 5), seq('walk_', 5), ['stand_0', 'stand_1']], 220, 240);
contact('slice-gym-rig.png', rigParts);
contact('slice-fabinhogym.png', fabgym);
onion('slice-fabgym-cycles.png', fabgym, FABINHOGYM_ANCHOR, [seq('run_', 5), seq('walk_', 4)], 220, 240);
contact('slice-rafamuleta.png', muleta);
onion('slice-muleta-cycles.png', muleta, RAFAMULETA_ANCHOR, [seq('crutch_', 5), seq('walk_', 4), seq('dance_', 5)], 220, 240);
for (const [who, w] of Object.entries(wedding)) {
  contact(`slice-${who}.png`, w.sprites);
  onion(`slice-${who}-g.png`, w.scaled, w.anchors, [seq('g_walk_', 4), seq('g_run_', 5), ['g_pose_idle', 'g_pose_phone', 'g_pose_think']], 230, 280);
}
onion('slice-gym-moves.png', gym, RAFAGYM_ANCHOR, [['crouch', 'leap', 'leap_up', 'land'], ['cheer_0', 'cheer_1'], ['guard', 'stand_0'], seq('pushup_', 2), seq('squat_', 3)], 240, 240);
onion('slice-fab-moves.png', fab, FABINHO_ANCHOR, [['leap_0', 'leap_1', 'crouch', 'halfsquat'], seq('pushup_', 2), seq('situp_', 2), ['halfsquat', 'squat']], 320, 260);
// Giovanni's height, three ways, next to the crutch Rafa at game scale (2× for viewing): native small row, the old
// uniform upscale, the body stretch. Frames: standing (back view turned is not useful) — walk_0, run_2, pose_idle.
{
  const G = byName(slice('art-src/characters/giovanni-sheet.PNG', GIOVANNI_SHEET)), GA = standardAnchors(Object.values(G));
  const gp = byName(gPoses(G, GA, ['pose_idle']).map((f) => ({ ...f, w: f.png.width, h: f.png.height })));
  const W = wedding.giovanni, MB = byName(muleta);
  const kU = 215 / (G.back_0.h - 2 * RING);
  const row = [];
  for (const n of ['walk_0', 'run_2', 'pose_idle']) {
    const nat = n === 'pose_idle' ? { png: gp.g_pose_idle.png, a: GA.g_pose_idle } : { png: G[n].png, a: GA[n] };
    const uni = downscale(nat.png, kU, nat.a);
    const str = { png: byName(W.scaled)[`g_${n}`].png, a: W.anchors[`g_${n}`] };
    row.push([MB.walk_0.png, RAFAMULETA_ANCHOR.walk_0], [nat.png, nat.a], [uni.png, uni.anchor], [str.png, str.a]);
  }
  const CW = 140, BASE = 250, img = new PNG({ width: CW * row.length, height: 270 });
  fill(img, [150, 153, 158, 255]);
  row.forEach(([png, a], i) => {
    over(img, png, i * CW + 70 - a[0], BASE - a[1]);
    for (let x = i * CW; x < (i + 1) * CW; x += 4) img.data.set([40, 80, 220, 255], ((BASE - 180) * img.width + x) * 4);
  });
  for (let x = 0; x < img.width; x++) img.data.set([40, 40, 40, 255], (BASE * img.width + x) * 4);
  const big = new PNG({ width: img.width * 2, height: img.height * 2 });
  for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) img.data.copy(big.data, (y * big.width + x) * 4, ((y >> 1) * img.width + (x >> 1)) * 4, ((y >> 1) * img.width + (x >> 1)) * 4 + 4);
  fs.writeFileSync(path.join(CHECK, 'giovanni-height.png'), PNG.sync.write(big));
  console.log('giovanni stretch necks:', stretchLog.join(', '));
}
console.log(`checks in ${CHECK}/`);
