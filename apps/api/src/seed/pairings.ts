/**
 * What people in the invented order history tend to add to a dish: a borhani with a
 * kacchi, naan with a kabab, fries with a burger. The seeded orders follow these habits
 * most of the time, so the history has the kind of pattern a real one has.
 *
 * The recommender in services/ml is never shown this file. It is given the orders, and
 * has to find the habits in them by itself.
 */
const RICE_SIDES = [
  'borhani',
  'jali-kabab',
  'firni',
  'salad',
  'chicken-roast',
  'soft-drink',
];
const BREADS = [
  'butter-naan',
  'garlic-naan',
  'plain-naan',
  'raita',
  'salad',
  'soft-drink',
];
const WITH_RICE = [
  'plain-rice',
  'masoor-dal',
  'aloo-bhorta',
  'begun-bhaja',
  'shobji-bhaji',
];
const WOK_SIDES = [
  'chili-chicken',
  'chinese-veg',
  'thai-soup',
  'szechuan-chicken',
  'wonton',
];
const BURGER_SIDES = ['fries', 'soft-drink', 'coleslaw', 'wedges', 'milkshake'];
const TEA_SNACKS = [
  'shingara',
  'somucha',
  'piyaju',
  'toast-biscuit',
  'butter-toast',
  'dal-puri',
];
const TEAS = ['dudh-cha', 'rong-cha', 'masala-cha'];
const SWEET_SIDES = ['mishti-doi', 'nimki', 'roshmalai', 'doi-cup'];

const groups: Array<[dishes: string[], goesWith: string[]]> = [
  [
    ['kacchi-mutton', 'kacchi-beef', 'chicken-biryani', 'morog-polao', 'tehari-beef'],
    RICE_SIDES,
  ],
  [['plain-polao'], ['chicken-roast', 'beef-rezala', 'borhani']],
  [
    ['sheek-beef', 'sheek-chicken', 'boti-kabab', 'chicken-tikka', 'reshmi-kabab'],
    BREADS,
  ],
  [['grill-quarter', 'grill-half', 'tandoori-half', 'kabab-platter'], BREADS],
  [
    ['beef-chaap', 'chicken-chaap'],
    ['luchi', 'salad', 'soft-drink'],
  ],
  [
    ['nehari-beef', 'nolli-nehari', 'paya'],
    ['tandoor-ruti', 'porota', 'plain-naan'],
  ],
  [
    ['porota', 'mughlai'],
    ['dal-bhaji', 'omelette', 'shobji-nasta', 'dudh-cha'],
  ],
  [
    [
      'rui-jhol',
      'pabda-jhol',
      'chingri-malai',
      'chicken-jhol',
      'beef-bhuna',
      'kala-bhuna',
      'dim-jhol',
      'shorshe-ilish',
      'ilish-bhaja',
      'small-fish',
    ],
    WITH_RICE,
  ],
  [
    ['bhorta-platter', 'shutki-bhorta', 'chingri-bhorta'],
    ['plain-rice', 'masoor-dal'],
  ],
  [
    ['khichuri-beef', 'khichuri-egg', 'khichuri-ilish'],
    ['begun-bhaja', 'salad', 'doi-cup'],
  ],
  [['fried-rice-egg', 'fried-rice-chicken', 'fried-rice-mixed'], WOK_SIDES],
  [
    ['chow-chicken', 'chow-veg'],
    ['thai-soup', 'wonton', 'spring-roll', 'chili-chicken'],
  ],
  [
    ['beef-burger', 'cheese-burger', 'double-smash', 'naga-burger', 'chicken-burger'],
    BURGER_SIDES,
  ],
  [
    ['fried-chicken-2', 'fried-chicken-4', 'hot-wings'],
    ['fries', 'coleslaw', 'soft-drink'],
  ],
  [
    ['fuchka', 'doi-fuchka'],
    ['chotpoti', 'tetul-shorbot', 'lebu-shorbot'],
  ],
  [
    ['chotpoti', 'chotpoti-extra'],
    ['fuchka', 'lebu-shorbot', 'tetul-shorbot'],
  ],
  [
    ['jhalmuri', 'bhelpuri', 'papri-chaat'],
    ['lebu-shorbot', 'tetul-shorbot', 'fuchka'],
  ],
  [
    ['dudh-cha', 'rong-cha', 'masala-cha', 'malai-cha', 'lebu-cha', 'tandoori-cha'],
    TEA_SNACKS,
  ],
  [['shingara', 'somucha', 'piyaju', 'beguni', 'aloo-chop', 'halim'], TEAS],
  [['roshogolla', 'kalojam', 'chomchom', 'sondesh-piece', 'mishti-box'], SWEET_SIDES],
  [
    ['bhapa-pitha', 'chitoi', 'patishapta', 'dudh-puli'],
    ['gur-payesh', 'teler-pitha', 'malpoa'],
  ],
];

/** For each dish, the dishes people tend to order with it. */
export const goesWith: ReadonlyMap<string, readonly string[]> = new Map(
  groups.flatMap(([dishes, companions]) =>
    dishes.map((dish) => [dish, companions.filter((companion) => companion !== dish)]),
  ),
);

/** How often an extra dish follows the habit rather than chance, in percent. */
export const HABIT_PERCENT = 75;
