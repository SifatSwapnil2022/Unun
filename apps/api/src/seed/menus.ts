/**
 * Menu templates. A kitchen's menu is its template's sections, filled from the dish
 * catalogue. A dish key that starts with "?" is optional: a kitchen carries it only if
 * a hash of its slug and the key says so, which gives each kitchen a different menu
 * that is the same on every run.
 */
export type SectionTemplate = {
  en: string;
  bn: string;
  dishes: string[];
};

const section = (en: string, bn: string, dishes: string[]): SectionTemplate => ({
  en,
  bn,
  dishes,
});

const teaSection = section('Tea', 'চা', ['dudh-cha', 'rong-cha']);

export const menuTemplates = {
  kacchi: [
    section('Biryani and polao', 'বিরিয়ানি ও পোলাও', [
      'kacchi-mutton',
      '?kacchi-beef',
      '?chicken-biryani',
      '?morog-polao',
      '?tehari-beef',
      'plain-polao',
    ]),
    section('With your rice', 'ভাতের সঙ্গে', [
      'chicken-roast',
      '?beef-rezala',
      'jali-kabab',
      'salad',
    ]),
    section('Drinks and dessert', 'পানীয় ও মিষ্টি', [
      'borhani',
      'firni',
      '?jorda',
      'water',
      'soft-drink',
    ]),
  ],
  kabab: [
    section('From the coals', 'কয়লার আঁচে', [
      'sheek-beef',
      '?sheek-chicken',
      '?boti-kabab',
      'chicken-tikka',
      '?reshmi-kabab',
      '?beef-chaap',
      '?chicken-chaap',
      '?grill-quarter',
      '?grill-half',
      '?tandoori-half',
      'kabab-platter',
    ]),
    section('Bread', 'রুটি ও নান', [
      'butter-naan',
      '?garlic-naan',
      'plain-naan',
      '?luchi',
    ]),
    section('Rolls', 'রোল', ['?kathi-chicken', '?kathi-beef']),
    section('Sides and drinks', 'সঙ্গে ও পানীয়', [
      'raita',
      'salad',
      '?borhani',
      'water',
      'soft-drink',
    ]),
  ],
  bhaat: [
    section('Set meals', 'সেট মিল', [
      'set-chicken',
      'set-fish',
      '?set-veg',
      '?bhorta-platter',
    ]),
    section('Bhorta and bhaji', 'ভর্তা ও ভাজি', [
      'aloo-bhorta',
      'begun-bhorta',
      '?tomato-bhorta',
      '?dim-bhorta',
      '?kalojira-bhorta',
      '?shutki-bhorta',
      '?chingri-bhorta',
      'shobji-bhaji',
      '?lal-shak',
      '?begun-bhaja',
    ]),
    section('Fish', 'মাছ', [
      'rui-jhol',
      '?ilish-bhaja',
      '?shorshe-ilish',
      '?pabda-jhol',
      '?chingri-malai',
      '?small-fish',
    ]),
    section('Meat and egg', 'মাংস ও ডিম', [
      'chicken-jhol',
      '?beef-bhuna',
      '?kala-bhuna',
      'dim-jhol',
    ]),
    section('Rice, dal and after', 'ভাত, ডাল ও শেষ পাতে', [
      'plain-rice',
      'masoor-dal',
      '?doi-cup',
      'water',
    ]),
  ],
  khichuri: [
    section('Khichuri', 'খিচুড়ি', ['khichuri-beef', 'khichuri-egg', 'khichuri-ilish']),
    section('On the side', 'সঙ্গে', [
      'beef-bhuna',
      'begun-bhaja',
      'dim-jhol',
      'aloo-bhorta',
      'salad',
    ]),
    section('Drinks', 'পানীয়', ['borhani', 'water', 'soft-drink']),
  ],
  panta: [
    section('Panta', 'পান্তা', ['panta-ilish', 'panta-bhorta']),
    section('Bhorta and bhaji', 'ভর্তা ও ভাজি', [
      'aloo-bhorta',
      'begun-bhorta',
      'shutki-bhorta',
      '?tomato-bhorta',
      '?kalojira-bhorta',
      'lal-shak',
      'begun-bhaja',
    ]),
    section('Fish and rice', 'মাছ ও ভাত', [
      'ilish-bhaja',
      '?small-fish',
      'plain-rice',
      'masoor-dal',
      'water',
    ]),
  ],
  nasta: [
    section('Morning plates', 'সকালের নাশতা', [
      'porota',
      'dal-bhaji',
      'omelette',
      '?shobji-nasta',
      '?suji-halwa',
      '?mughlai',
      '?tandoor-ruti',
    ]),
    section('Nehari and paya', 'নেহারি ও পায়া', [
      'nehari-beef',
      '?nolli-nehari',
      '?paya',
    ]),
    teaSection,
  ],
  bakorkhani: [
    section('Bakorkhani', 'বাকরখানি', [
      'bakorkhani',
      'bakorkhani-sweet',
      'bakorkhani-cheese',
    ]),
    section('Tea', 'চা', ['dudh-cha', 'rong-cha', 'malai-cha']),
  ],
  chinese: [
    section('Soup and starters', 'স্যুপ ও স্টার্টার', [
      'thai-soup',
      '?corn-soup',
      '?wonton',
      '?spring-roll',
    ]),
    section('Rice and noodles', 'রাইস ও নুডলস', [
      'fried-rice-chicken',
      'fried-rice-egg',
      '?fried-rice-mixed',
      'chow-chicken',
      '?chow-veg',
    ]),
    section('Main dishes', 'মূল পদ', [
      'chili-chicken',
      '?szechuan-chicken',
      '?beef-chili-onion',
      '?sweet-sour-prawn',
      '?chinese-veg',
    ]),
    section('Set menu and drinks', 'সেট মেনু ও পানীয়', [
      'set-chinese',
      'water',
      'soft-drink',
    ]),
  ],
  burger: [
    section('Burgers', 'বার্গার', [
      'beef-burger',
      'cheese-burger',
      '?double-smash',
      '?naga-burger',
      '?chicken-burger',
      'burger-combo',
    ]),
    section('Fried chicken', 'ফ্রাইড চিকেন', [
      '?fried-chicken-2',
      '?fried-chicken-4',
      '?hot-wings',
    ]),
    section('Sides', 'সাইড', ['fries', '?wedges', '?coleslaw', '?club-sandwich']),
    section('Drinks', 'পানীয়', ['?milkshake', 'soft-drink', 'water']),
  ],
  fuchka: [
    section('Fuchka and chotpoti', 'ফুচকা ও চটপটি', [
      'fuchka',
      '?doi-fuchka',
      'chotpoti',
      '?chotpoti-extra',
    ]),
    section('Muri and chaat', 'মুড়ি ও চাট', [
      '?jhalmuri',
      '?bhelpuri',
      '?papri-chaat',
      '?ghugni',
      '?aam-makha',
    ]),
    section('Sherbet', 'শরবত', ['tetul-shorbot', '?lebu-shorbot', 'water']),
  ],
  cha: [
    section('Tea', 'চা', [
      'dudh-cha',
      'rong-cha',
      '?lebu-cha',
      '?masala-cha',
      '?malai-cha',
      '?tandoori-cha',
    ]),
    section('Fried snacks', 'ভাজাপোড়া', [
      'shingara',
      '?somucha',
      '?piyaju',
      '?beguni',
      '?aloo-chop',
      '?dim-chop',
      '?dal-puri',
    ]),
    section('With your tea', 'চায়ের সঙ্গে', [
      '?butter-toast',
      '?toast-biscuit',
      '?chola-muri',
      '?halim',
    ]),
  ],
  mishti: [
    section('Sweets', 'মিষ্টি', [
      'roshogolla',
      'kalojam',
      '?chomchom',
      '?sondesh-piece',
      '?kheer-kodom',
      '?laddu',
      '?mishti-box',
    ]),
    section('Doi and milk sweets', 'দই ও দুধের মিষ্টি', [
      'mishti-doi',
      'doi-cup',
      '?roshmalai',
      '?chhanar-payesh',
      '?firni',
    ]),
    section('Fried and savoury', 'ভাজা ও নোনতা', ['?jilapi', '?amriti', '?nimki']),
  ],
  pitha: [
    section('Steamed and soaked', 'ভাপা ও দুধে ভেজানো', [
      'bhapa-pitha',
      '?dudh-puli',
      '?dudh-chitoi',
      '?gur-payesh',
    ]),
    section('Fried and griddled', 'ভাজা ও সেঁকা', [
      'chitoi',
      '?patishapta',
      '?teler-pitha',
      '?nokshi-pitha',
      '?malpoa',
    ]),
    teaSection,
  ],
} satisfies Record<string, SectionTemplate[]>;

export type MenuTemplateId = keyof typeof menuTemplates;
