/**
 * The seeded kitchens. Every kitchen here is invented: the names are not real
 * businesses. The areas, streets, dishes and price levels are real Dhaka.
 */
import type { KitchenTag } from '@unun/core';
import { dishPhotos, kitchenCovers } from './photos';
import { menuTemplates, type MenuTemplateId } from './menus';

export type KitchenSeed = {
  slug: string;
  en: string;
  bn: string;
  taglineEn: string;
  taglineBn: string;
  area: string;
  addressEn: string;
  addressBn: string;
  cuisines: string[];
  menu: MenuTemplateId;
  /** Dishes the kitchen is known for: always on its menu and marked popular. */
  signature: string[];
  prepMinutes: number;
  onTimeOfTen: number;
  /** Opening and closing time in minutes after midnight. */
  hours: [number, number];
  /** Minimum order in taka. */
  minOrder: number;
  tags: KitchenTag[];
  /** The wide photograph at the top of the kitchen. A key in media/manifest.json. */
  photo: string;
  /** The small round photograph beside the kitchen's name. */
  profilePhoto: string;
};

const at = (hour: number, minute = 0) => hour * 60 + minute;

function coverFor(slug: string): string {
  const cover = kitchenCovers[slug];
  if (!cover) throw new Error(`Kitchen "${slug}" has no cover in seed/photos.ts`);
  return cover;
}

const profilesTaken = new Set<string>();

/**
 * A kitchen's profile picture is a dish from its menu, its signature dishes first. It is
 * never the photograph already used as the cover, and a picture another kitchen has
 * taken is passed over while the menu still has one that is free.
 */
function profileFor(
  slug: string,
  signature: string[],
  menu: MenuTemplateId,
  cover: string,
): string {
  const onMenu = menuTemplates[menu].flatMap((section) =>
    section.dishes.map((entry) => entry.replace(/^\?/, '')),
  );
  const candidates = [...signature, ...onMenu]
    .map((dish) => dishPhotos[dish])
    .filter((photo): photo is string => photo !== undefined && photo !== cover);

  const profile = candidates.find((photo) => !profilesTaken.has(photo)) ?? candidates[0];
  if (!profile) throw new Error(`Kitchen "${slug}" has no dish to use as its profile`);

  profilesTaken.add(profile);
  return profile;
}

type Group = Pick<
  KitchenSeed,
  'cuisines' | 'menu' | 'prepMinutes' | 'hours' | 'minOrder' | 'tags'
>;

type Details = {
  signature: string[];
  onTime: number;
} & Partial<Group>;

/** Returns a builder for kitchens that share a cuisine, menu template and hours. */
function group(defaults: Group) {
  return (
    slug: string,
    name: [en: string, bn: string],
    tagline: [en: string, bn: string],
    area: string,
    address: [en: string, bn: string],
    details: Details,
  ): KitchenSeed => {
    const { signature, onTime, ...overrides } = details;
    const menu = overrides.menu ?? defaults.menu;
    const photo = coverFor(slug);
    return {
      ...defaults,
      ...overrides,
      slug,
      en: name[0],
      bn: name[1],
      taglineEn: tagline[0],
      taglineBn: tagline[1],
      area,
      addressEn: address[0],
      addressBn: address[1],
      signature,
      onTimeOfTen: onTime,
      photo,
      profilePhoto: profileFor(slug, signature, menu, photo),
    };
  };
}

const kacchi = group({
  cuisines: ['kacchi'],
  menu: 'kacchi',
  prepMinutes: 20,
  hours: [at(11), at(23)],
  minOrder: 200,
  tags: ['halal'],
});

const kabab = group({
  cuisines: ['kebab'],
  menu: 'kabab',
  prepMinutes: 24,
  hours: [at(12), at(23, 30)],
  minOrder: 200,
  tags: ['halal'],
});

const bhaat = group({
  cuisines: ['bhaat'],
  menu: 'bhaat',
  prepMinutes: 16,
  hours: [at(11), at(22, 30)],
  minOrder: 150,
  tags: ['halal', 'vegetarian'],
});

const nasta = group({
  cuisines: ['nasta'],
  menu: 'nasta',
  prepMinutes: 14,
  hours: [at(6), at(13)],
  minOrder: 100,
  tags: ['halal'],
});

const chinese = group({
  cuisines: ['chinese'],
  menu: 'chinese',
  prepMinutes: 22,
  hours: [at(12), at(23)],
  minOrder: 250,
  tags: ['halal'],
});

const burger = group({
  cuisines: ['burger'],
  menu: 'burger',
  prepMinutes: 18,
  hours: [at(12), at(0)],
  minOrder: 200,
  tags: ['halal'],
});

const fuchka = group({
  cuisines: ['fuchka'],
  menu: 'fuchka',
  prepMinutes: 9,
  hours: [at(12), at(22)],
  minOrder: 100,
  tags: ['halal', 'vegetarian'],
});

const cha = group({
  cuisines: ['cha'],
  menu: 'cha',
  prepMinutes: 9,
  hours: [at(7), at(23)],
  minOrder: 100,
  tags: ['halal', 'vegetarian'],
});

const mishti = group({
  cuisines: ['mishti'],
  menu: 'mishti',
  prepMinutes: 7,
  hours: [at(9), at(22)],
  minOrder: 150,
  tags: ['halal', 'vegetarian'],
});

const pitha = group({
  cuisines: ['pitha'],
  menu: 'pitha',
  prepMinutes: 13,
  hours: [at(7), at(21)],
  minOrder: 100,
  tags: ['halal', 'vegetarian'],
});

export const kitchenSeeds: KitchenSeed[] = [
  /* Kacchi and biryani */
  kacchi(
    'dum-ghor',
    ['Dum Ghor', 'দম ঘর'],
    ['Kacchi cooked under a sealed lid since morning.', 'সকাল থেকে দমে বসানো কাচ্চি।'],
    'old-dhaka',
    ['Nazira Bazar, Old Dhaka', 'নাজিরা বাজার, পুরান ঢাকা'],
    { signature: ['kacchi-mutton', 'borhani'], onTime: 9 },
  ),
  kacchi(
    'boro-deg',
    ['Boro Deg', 'বড় ডেগ'],
    ['One big pot of kacchi, twice a day.', 'দিনে দুইবার, এক বড় ডেগ কাচ্চি।'],
    'mirpur',
    ['Mirpur 10 roundabout', 'মিরপুর ১০ গোলচত্বর'],
    { signature: ['kacchi-beef', 'kacchi-mutton'], onTime: 8 },
  ),
  kacchi(
    'aloo-bukhara',
    ['Aloo Bukhara', 'আলুবোখারা'],
    ['Kacchi with the plum left in.', 'আলুবোখারা দেওয়া কাচ্চি।'],
    'dhanmondi',
    ['Satmasjid Road, Dhanmondi', 'সাতমসজিদ রোড, ধানমন্ডি'],
    { signature: ['kacchi-mutton', 'jorda'], onTime: 9 },
  ),
  kacchi(
    'jafrani-haat',
    ['Jafrani Haat', 'জাফরানি হাট'],
    ['Saffron rice and slow-cooked mutton.', 'জাফরানি ভাত আর ধীরে রান্না খাসি।'],
    'gulshan',
    ['Gulshan Avenue', 'গুলশান অ্যাভিনিউ'],
    { signature: ['kacchi-mutton', 'beef-rezala'], onTime: 8 },
  ),
  kacchi(
    'chinigura',
    ['Chinigura', 'চিনিগুঁড়া'],
    ['Morog polao made with chinigura rice.', 'চিনিগুঁড়া চালের মোরগ পোলাও।'],
    'bashundhara',
    ['Block C, Bashundhara R/A', 'ব্লক সি, বসুন্ধরা আবাসিক এলাকা'],
    { signature: ['morog-polao'], onTime: 9 },
  ),
  kacchi(
    'tehari-bari',
    ['Tehari Bari', 'তেহারি বাড়ি'],
    [
      'Mustard-oil beef tehari, served by the plate.',
      'সরিষার তেলে গরুর তেহারি, প্লেট হিসেবে।',
    ],
    'mohammadpur',
    ['Tajmahal Road, Mohammadpur', 'তাজমহল রোড, মোহাম্মদপুর'],
    { signature: ['tehari-beef'], onTime: 10, prepMinutes: 14 },
  ),
  kacchi(
    'polao-para',
    ['Polao Para', 'পোলাও পাড়া'],
    [
      'Polao, roast and rezala for the whole table.',
      'পুরো টেবিলের জন্য পোলাও, রোস্ট আর রেজালা।',
    ],
    'khilgaon',
    ['Taltola, Khilgaon', 'তালতলা, খিলগাঁও'],
    {
      signature: ['morog-polao', 'chicken-roast', 'beef-rezala'],
      onTime: 8,
    },
  ),
  kacchi(
    'shahi-haari',
    ['Shahi Haari', 'শাহি হাঁড়ি'],
    [
      'Kacchi from a clay pot, sealed with dough.',
      'আটা দিয়ে মুখ বন্ধ করা মাটির হাঁড়ির কাচ্চি।',
    ],
    'banani',
    ['Road 11, Banani', 'রোড ১১, বনানী'],
    { signature: ['kacchi-mutton', 'firni'], onTime: 9 },
  ),
  kacchi(
    'biye-bari',
    ['Biye Bari', 'বিয়ে বাড়ি'],
    ['Wedding-house kacchi without the wedding.', 'বিয়ে ছাড়াই বিয়ে বাড়ির কাচ্চি।'],
    'wari',
    ['Rankin Street, Wari', 'র‍্যাংকিন স্ট্রিট, ওয়ারী'],
    {
      signature: ['kacchi-mutton', 'chicken-roast', 'jorda'],
      onTime: 7,
    },
  ),
  kacchi(
    'dawat',
    ['Dawat', 'দাওয়াত'],
    ['Biryani and roast, cooked for guests.', 'মেহমানের জন্য রান্না বিরিয়ানি আর রোস্ট।'],
    'uttara',
    ['Sector 7, Uttara', 'সেক্টর ৭, উত্তরা'],
    { signature: ['chicken-biryani', 'chicken-roast'], onTime: 9 },
  ),

  /* Kabab and grill */
  kabab(
    'koylar-aanch',
    ['Koylar Aanch', 'কয়লার আঁচ'],
    ['Kababs grilled over charcoal, not gas.', 'গ্যাসে নয়, কয়লার আঁচে সেঁকা কাবাব।'],
    'gulshan',
    ['Gulshan 2', 'গুলশান ২'],
    { signature: ['sheek-beef', 'boti-kabab'], onTime: 8 },
  ),
  kabab(
    'sheek',
    ['Sheek', 'শিক'],
    ['Sheek kabab off the skewer and onto naan.', 'শিক থেকে নামিয়ে সরাসরি নানে।'],
    'bashundhara',
    ['Block D, Bashundhara R/A', 'ব্লক ডি, বসুন্ধরা আবাসিক এলাকা'],
    {
      signature: ['sheek-beef', 'sheek-chicken', 'garlic-naan'],
      onTime: 7,
    },
  ),
  kabab(
    'dhoa',
    ['Dhoa', 'ধোঁয়া'],
    ['Smoky grilled chicken and soft naan.', 'ধোঁয়া ওঠা গ্রিল চিকেন আর নরম নান।'],
    'dhanmondi',
    ['Road 27, Dhanmondi', 'রোড ২৭, ধানমন্ডি'],
    { signature: ['grill-quarter', 'grill-half'], onTime: 9 },
  ),
  kabab(
    'angar',
    ['Angar', 'অঙ্গার'],
    ['Tikka and boti from a bed of live coals.', 'জ্বলন্ত অঙ্গারে টিক্কা আর বটি।'],
    'uttara',
    ['Sector 11, Uttara', 'সেক্টর ১১, উত্তরা'],
    { signature: ['chicken-tikka', 'boti-kabab'], onTime: 8 },
  ),
  kabab(
    'lal-tondur',
    ['Lal Tondur', 'লাল তন্দুর'],
    ['Tandoori chicken and bread from one clay oven.', 'একই তন্দুরে চিকেন আর রুটি।'],
    'mirpur',
    ['Mirpur 2', 'মিরপুর ২'],
    { signature: ['tandoori-half', 'garlic-naan'], onTime: 9 },
  ),
  kabab(
    'chaap-ghor',
    ['Chaap Ghor', 'চাপ ঘর'],
    [
      'Beef chaap and luchi, the Mohammadpur way.',
      'মোহাম্মদপুরের ধাঁচে গরুর চাপ আর লুচি।',
    ],
    'mohammadpur',
    ['Salimullah Road, Mohammadpur', 'সলিমুল্লাহ রোড, মোহাম্মদপুর'],
    {
      signature: ['beef-chaap', 'chicken-chaap', 'luchi'],
      onTime: 9,
      hours: [at(17), at(0)],
    },
  ),
  kabab(
    'boti',
    ['Boti', 'বটি'],
    ['Boti kabab cut small and cooked fast.', 'ছোট করে কাটা, চটজলদি সেঁকা বটি কাবাব।'],
    'old-dhaka',
    ['Chawkbazar, Old Dhaka', 'চকবাজার, পুরান ঢাকা'],
    {
      signature: ['boti-kabab', 'kathi-beef'],
      onTime: 10,
      prepMinutes: 18,
    },
  ),
  kabab(
    'jhalsano',
    ['Jhalsano', 'ঝলসানো'],
    ['Grill platters for two or for six.', 'দুজন বা ছয়জনের গ্রিল প্লাটার।'],
    'banani',
    ['Kemal Ataturk Avenue, Banani', 'কামাল আতাতুর্ক অ্যাভিনিউ, বনানী'],
    { signature: ['kabab-platter', 'reshmi-kabab'], onTime: 8, prepMinutes: 28 },
  ),

  /* Bhorta, fish and rice */
  bhaat(
    'shorisha',
    ['Shorisha', 'সরিষা'],
    ['Bhorta mashed by hand with mustard oil.', 'সরিষার তেলে হাতে মাখা ভর্তা।'],
    'dhanmondi',
    ['Road 4, Dhanmondi', 'রোড ৪, ধানমন্ডি'],
    {
      signature: ['bhorta-platter', 'shutki-bhorta', 'kalojira-bhorta'],
      onTime: 9,
    },
  ),
  bhaat(
    'haarir-khobor',
    ['Haarir Khobor', 'হাঁড়ির খবর'],
    ['Home-style rice, fish and dal.', 'ঘরের মতো ভাত, মাছ আর ডাল।'],
    'mirpur',
    ['Mirpur 1', 'মিরপুর ১'],
    { signature: ['set-fish', 'rui-jhol'], onTime: 8 },
  ),
  bhaat(
    'baro-bhorta',
    ['Baro Bhorta', 'বারো ভর্তা'],
    [
      'Twelve bhortas every day. Pick five.',
      'প্রতিদিন বারো পদের ভর্তা। পাঁচটি বেছে নিন।',
    ],
    'tejgaon',
    ['Farmgate', 'ফার্মগেট'],
    {
      signature: ['bhorta-platter', 'chingri-bhorta', 'dim-bhorta', 'tomato-bhorta'],
      onTime: 9,
    },
  ),
  bhaat(
    'maach-bhaat',
    ['Maach Bhaat', 'মাছ ভাত'],
    ['River fish, cooked the day it is bought.', 'যেদিন কেনা, সেদিনই রান্না নদীর মাছ।'],
    'motijheel',
    ['Dilkusha, Motijheel', 'দিলকুশা, মতিঝিল'],
    {
      signature: ['pabda-jhol', 'small-fish', 'rui-jhol'],
      onTime: 8,
    },
  ),
  bhaat(
    'kansha',
    ['Kansha', 'কাঁসা'],
    ['Bengali meals served on bell-metal plates.', 'কাঁসার থালায় বাঙালি খাবার।'],
    'gulshan',
    ['Gulshan 1', 'গুলশান ১'],
    {
      signature: ['chingri-malai', 'kala-bhuna'],
      onTime: 9,
      prepMinutes: 20,
    },
  ),
  bhaat(
    'dupur',
    ['Dupur', 'দুপুর'],
    [
      'Rice, dal and one good curry for the office.',
      'অফিসের জন্য ভাত, ডাল আর একটা ভালো তরকারি।',
    ],
    'motijheel',
    ['Motijheel commercial area', 'মতিঝিল বাণিজ্যিক এলাকা'],
    {
      signature: ['set-chicken', 'set-veg'],
      onTime: 10,
      prepMinutes: 12,
      hours: [at(11), at(16)],
    },
  ),
  bhaat(
    'ilish-ghat',
    ['Ilish Ghat', 'ইলিশ ঘাট'],
    [
      'Ilish fried, steamed in mustard, or with khichuri.',
      'ইলিশ ভাজা, সরষে ইলিশ কিংবা খিচুড়ির সঙ্গে।',
    ],
    'uttara',
    ['Sector 4, Uttara', 'সেক্টর ৪, উত্তরা'],
    {
      signature: ['ilish-bhaja', 'shorshe-ilish'],
      onTime: 8,
      prepMinutes: 20,
    },
  ),
  bhaat(
    'uthan',
    ['Uthan', 'উঠান'],
    [
      'Village cooking: shutki, shak and small fish.',
      'গ্রামের রান্না: শুঁটকি, শাক আর ছোট মাছ।',
    ],
    'bashundhara',
    ['Block A, Bashundhara R/A', 'ব্লক এ, বসুন্ধরা আবাসিক এলাকা'],
    {
      signature: ['shutki-bhorta', 'small-fish', 'lal-shak'],
      onTime: 9,
    },
  ),
  bhaat(
    'panta',
    ['Panta', 'পান্তা'],
    ['Panta bhat with bhorta, all year round.', 'সারা বছর পান্তা ভাত আর ভর্তা।'],
    'khilgaon',
    ['Bashabo, Khilgaon', 'বাসাবো, খিলগাঁও'],
    {
      signature: ['panta-ilish', 'panta-bhorta'],
      onTime: 9,
      menu: 'panta',
    },
  ),
  bhaat(
    'brishti-din',
    ['Brishti Din', 'বৃষ্টি দিন'],
    [
      'Bhuna khichuri for rainy days and dry ones.',
      'বৃষ্টির দিন হোক বা রোদের, ভুনা খিচুড়ি।',
    ],
    'mohammadpur',
    ['Shyamoli, Mohammadpur', 'শ্যামলী, মোহাম্মদপুর'],
    {
      signature: ['khichuri-beef'],
      onTime: 8,
      menu: 'khichuri',
      tags: ['halal'],
    },
  ),

  /* Porota and nehari */
  nasta(
    'bhor',
    ['Bhor', 'ভোর'],
    ['Nehari and porota from six in the morning.', 'ভোর ছয়টা থেকে নেহারি আর পরোটা।'],
    'old-dhaka',
    ['Lalbagh, Old Dhaka', 'লালবাগ, পুরান ঢাকা'],
    { signature: ['nehari-beef', 'paya'], onTime: 9 },
  ),
  nasta(
    'sokal-sokal',
    ['Sokal Sokal', 'সকাল সকাল'],
    ['Porota, bhaji and egg before work.', 'কাজে যাওয়ার আগে পরোটা, ভাজি আর ডিম।'],
    'mirpur',
    ['Kazipara, Mirpur', 'কাজীপাড়া, মিরপুর'],
    { signature: ['porota', 'dal-bhaji'], onTime: 10 },
  ),
  nasta(
    'bhaji-porota',
    ['Bhaji Porota', 'ভাজি পরোটা'],
    ['Flaky porota with dal bhaji, all day.', 'সারাদিন খাস্তা পরোটা আর ডাল ভাজি।'],
    'dhanmondi',
    ['Jigatola, Dhanmondi', 'জিগাতলা, ধানমন্ডি'],
    {
      signature: ['porota', 'mughlai'],
      onTime: 9,
      hours: [at(7), at(22)],
      tags: ['halal', 'vegetarian'],
    },
  ),
  nasta(
    'nolli',
    ['Nolli', 'নল্লি'],
    ['Nolli nehari simmered through the night.', 'সারারাত জ্বাল দেওয়া নল্লি নেহারি।'],
    'mohammadpur',
    ['Town Hall, Mohammadpur', 'টাউন হল, মোহাম্মদপুর'],
    { signature: ['nolli-nehari', 'tandoor-ruti'], onTime: 8 },
  ),
  nasta(
    'bakorkhani',
    ['Bakorkhani', 'বাকরখানি'],
    [
      'Bakorkhani baked in a tandoor each morning.',
      'প্রতিদিন সকালে তন্দুরে সেঁকা বাকরখানি।',
    ],
    'wari',
    ['Narinda, Wari', 'নারিন্দা, ওয়ারী'],
    {
      signature: ['bakorkhani'],
      onTime: 10,
      menu: 'bakorkhani',
      prepMinutes: 8,
      hours: [at(7), at(20)],
      tags: ['halal', 'vegetarian'],
    },
  ),

  /* Bangla Chinese */
  chinese(
    'lal-lonthon',
    ['Lal Lonthon', 'লাল লণ্ঠন'],
    [
      'Dhaka-style Chinese: thick soup, fried rice, chili chicken.',
      'ঢাকাই চাইনিজ: ঘন স্যুপ, ফ্রাইড রাইস, চিলি চিকেন।',
    ],
    'dhanmondi',
    ['Road 2, Dhanmondi', 'রোড ২, ধানমন্ডি'],
    { signature: ['thai-soup', 'chili-chicken'], onTime: 8 },
  ),
  chinese(
    'chow-para',
    ['Chow Para', 'চাও পাড়া'],
    ['Chow mein tossed to order.', 'অর্ডার পেলে তবেই ভাজা চাওমিন।'],
    'uttara',
    ['Sector 3, Uttara', 'সেক্টর ৩, উত্তরা'],
    { signature: ['chow-chicken', 'chow-veg'], onTime: 9 },
  ),
  chinese(
    'wok-ghor',
    ['Wok Ghor', 'ওক ঘর'],
    [
      'High-flame wok cooking and set menus for the office.',
      'চড়া আঁচে ওকের রান্না, অফিসের জন্য সেট মেনু।',
    ],
    'gulshan',
    ['Gulshan North Avenue', 'গুলশান নর্থ অ্যাভিনিউ'],
    {
      signature: ['set-chinese', 'beef-chili-onion'],
      onTime: 9,
    },
  ),
  chinese(
    'soup-bari',
    ['Soup Bari', 'স্যুপ বাড়ি'],
    [
      'Thai soup and wonton, the Mirpur favourite.',
      'মিরপুরের প্রিয় থাই স্যুপ আর ওয়ানটন।',
    ],
    'mirpur',
    ['Mirpur 11', 'মিরপুর ১১'],
    { signature: ['thai-soup', 'wonton'], onTime: 8 },
  ),
  chinese(
    'dragon-goli',
    ['Dragon Goli', 'ড্রাগন গলি'],
    ['Szechuan chicken with real heat.', 'সত্যিকারের ঝাল সেজুয়ান চিকেন।'],
    'banani',
    ['Road 12, Banani', 'রোড ১২, বনানী'],
    { signature: ['szechuan-chicken'], onTime: 7 },
  ),
  chinese(
    'chili-onion',
    ['Chili Onion', 'চিলি অনিয়ন'],
    ['Beef chili onion and mixed fried rice.', 'বিফ চিলি অনিয়ন আর মিক্সড ফ্রাইড রাইস।'],
    'bashundhara',
    ['Block B, Bashundhara R/A', 'ব্লক বি, বসুন্ধরা আবাসিক এলাকা'],
    {
      signature: ['beef-chili-onion', 'fried-rice-mixed'],
      onTime: 9,
    },
  ),

  /* Burgers and fried chicken */
  burger(
    'bun-moshla',
    ['Bun Moshla', 'বান মশলা'],
    ['Beef burgers with a deshi spice mix.', 'দেশি মশলায় বিফ বার্গার।'],
    'dhanmondi',
    ['Road 8A, Dhanmondi', 'রোড ৮এ, ধানমন্ডি'],
    { signature: ['beef-burger'], onTime: 9 },
  ),
  burger(
    'patty-para',
    ['Patty Para', 'প্যাটি পাড়া'],
    ['Hand-pressed patties and toasted buns.', 'হাতে গড়া প্যাটি, সেঁকা বান।'],
    'mirpur',
    ['Mirpur 12', 'মিরপুর ১২'],
    { signature: ['cheese-burger'], onTime: 8 },
  ),
  burger(
    'murgi-bhaja',
    ['Murgi Bhaja', 'মুরগি ভাজা'],
    ['Fried chicken, marinated overnight.', 'সারারাত মেরিনেট করা ফ্রাইড চিকেন।'],
    'uttara',
    ['Sector 13, Uttara', 'সেক্টর ১৩, উত্তরা'],
    {
      signature: ['fried-chicken-2', 'fried-chicken-4'],
      onTime: 9,
    },
  ),
  burger(
    'jhaal-bun',
    ['Jhaal Bun', 'ঝাল বান'],
    ['Burgers that take their chili seriously.', 'ঝালের ব্যাপারে আপসহীন বার্গার।'],
    'bashundhara',
    ['Block G, Bashundhara R/A', 'ব্লক জি, বসুন্ধরা আবাসিক এলাকা'],
    { signature: ['naga-burger'], onTime: 8 },
  ),
  burger(
    'smash-goli',
    ['Smash Goli', 'স্ম্যাশ গলি'],
    [
      'Smash burgers, thin and crisp at the edge.',
      'পাতলা, কিনারায় মুচমুচে স্ম্যাশ বার্গার।',
    ],
    'banani',
    ['Road 6, Banani', 'রোড ৬, বনানী'],
    { signature: ['double-smash'], onTime: 9 },
  ),
  burger(
    'mochmoche',
    ['Mochmoche', 'মচমচে'],
    ['Crisp chicken, wings and wedges.', 'মচমচে চিকেন, উইংস আর ওয়েজেস।'],
    'mohakhali',
    ['Mohakhali DOHS', 'মহাখালী ডিওএইচএস'],
    {
      signature: ['hot-wings', 'fried-chicken-2', 'wedges'],
      onTime: 8,
    },
  ),
  burger(
    'naga',
    ['Naga', 'নাগা'],
    [
      'Naga chili burgers. A milkshake is recommended.',
      'নাগা মরিচের বার্গার। সঙ্গে মিল্কশেক নিলে ভালো।',
    ],
    'gulshan',
    ['Niketan, Gulshan', 'নিকেতন, গুলশান'],
    { signature: ['naga-burger', 'milkshake'], onTime: 7 },
  ),

  /* Fuchka and chotpoti */
  fuchka(
    'tok-jhal',
    ['Tok Jhal', 'টক ঝাল'],
    ['Fuchka filled when you order, not before.', 'অর্ডার পেলে তবেই ভরা ফুচকা।'],
    'dhanmondi',
    ['Rabindra Sarobar, Dhanmondi', 'রবীন্দ্র সরোবর, ধানমন্ডি'],
    { signature: ['fuchka'], onTime: 10 },
  ),
  fuchka(
    'bikel',
    ['Bikel', 'বিকেল'],
    ['Afternoon chotpoti and sherbet.', 'বিকেলের চটপটি আর শরবত।'],
    'mohammadpur',
    ['Iqbal Road, Mohammadpur', 'ইকবাল রোড, মোহাম্মদপুর'],
    {
      signature: ['chotpoti', 'tetul-shorbot'],
      onTime: 9,
      hours: [at(15), at(22)],
    },
  ),
  fuchka(
    'tetul',
    ['Tetul', 'তেঁতুল'],
    [
      'Tamarind water made fresh each afternoon.',
      'প্রতিদিন বিকেলে নতুন করে বানানো তেঁতুল জল।',
    ],
    'mirpur',
    ['Mirpur 6', 'মিরপুর ৬'],
    { signature: ['fuchka', 'aam-makha'], onTime: 9 },
  ),
  fuchka(
    'fuchka-mama',
    ['Fuchka Mama', 'ফুচকা মামা'],
    ['Doi fuchka and papri chaat.', 'দই ফুচকা আর পাপড়ি চাট।'],
    'uttara',
    ['Sector 6, Uttara', 'সেক্টর ৬, উত্তরা'],
    { signature: ['doi-fuchka', 'papri-chaat'], onTime: 8 },
  ),
  fuchka(
    'chotpoti-chottor',
    ['Chotpoti Chottor', 'চটপটি চত্বর'],
    [
      'Campus chotpoti, with extra tamarind if you ask.',
      'ক্যাম্পাসের চটপটি, চাইলে বাড়তি তেঁতুল।',
    ],
    'shahbag',
    ['TSC, Shahbag', 'টিএসসি, শাহবাগ'],
    { signature: ['chotpoti', 'chotpoti-extra'], onTime: 9 },
  ),
  fuchka(
    'muri-makha',
    ['Muri Makha', 'মুড়ি মাখা'],
    [
      'Jhalmuri mixed with mustard oil and green chili.',
      'সরিষার তেল আর কাঁচা মরিচে মাখা ঝালমুড়ি।',
    ],
    'old-dhaka',
    ['Bangshal, Old Dhaka', 'বংশাল, পুরান ঢাকা'],
    { signature: ['jhalmuri', 'ghugni'], onTime: 10 },
  ),

  /* Cha and snacks */
  cha(
    'tong',
    ['Tong', 'টং'],
    [
      'Milk tea and shingara, like the stall on your street.',
      'পাড়ার টংয়ের মতো দুধ চা আর শিঙাড়া।',
    ],
    'banani',
    ['Road 27, Banani', 'রোড ২৭, বনানী'],
    { signature: ['dudh-cha', 'shingara'], onTime: 9 },
  ),
  cha(
    'dudh-cha',
    ['Dudh Cha', 'দুধ চা'],
    ['Strong milk tea, poured from a height.', 'উঁচু থেকে ঢালা কড়া দুধ চা।'],
    'tejgaon',
    ['Karwan Bazar, Tejgaon', 'কারওয়ান বাজার, তেজগাঁও'],
    { signature: ['dudh-cha'], onTime: 10 },
  ),
  cha(
    'adda',
    ['Adda', 'আড্ডা'],
    ['Tea, toast and somewhere to argue.', 'চা, টোস্ট আর তর্ক করার জায়গা।'],
    'shahbag',
    ['Paribagh, Shahbag', 'পরীবাগ, শাহবাগ'],
    { signature: ['butter-toast', 'lebu-cha'], onTime: 9 },
  ),
  cha(
    'gorom-shingara',
    ['Gorom Shingara', 'গরম শিঙাড়া'],
    [
      'Shingara out of the oil every twenty minutes.',
      'বিশ মিনিট পরপর তেল থেকে নামানো শিঙাড়া।',
    ],
    'motijheel',
    ['Paltan, Motijheel', 'পল্টন, মতিঝিল'],
    { signature: ['shingara', 'somucha'], onTime: 9 },
  ),
  cha(
    'kettle',
    ['Kettle', 'কেটলি'],
    [
      'Masala tea and tandoori tea, by the cup or the flask.',
      'কাপ বা ফ্লাস্কে মশলা চা আর তন্দুরি চা।',
    ],
    'mohakhali',
    ['Wireless Gate, Mohakhali', 'ওয়্যারলেস গেট, মহাখালী'],
    { signature: ['masala-cha', 'tandoori-cha'], onTime: 8 },
  ),
  cha(
    'piyaju',
    ['Piyaju', 'পিঁয়াজু'],
    ['Piyaju, beguni and halim for the evening.', 'সন্ধ্যার পিঁয়াজু, বেগুনি আর হালিম।'],
    'khilgaon',
    ['Malibagh, Khilgaon', 'মালিবাগ, খিলগাঁও'],
    {
      signature: ['piyaju', 'beguni', 'halim'],
      onTime: 9,
      hours: [at(15), at(23)],
      tags: ['halal'],
    },
  ),
  cha(
    'sondhya',
    ['Sondhya', 'সন্ধ্যা'],
    ['Evening snacks with malai tea.', 'মালাই চায়ের সঙ্গে সন্ধ্যার নাশতা।'],
    'uttara',
    ['Sector 9, Uttara', 'সেক্টর ৯, উত্তরা'],
    { signature: ['malai-cha', 'aloo-chop'], onTime: 9 },
  ),

  /* Mishti and doi */
  mishti(
    'mishti-mukh',
    ['Mishti Mukh', 'মিষ্টি মুখ'],
    ["Sweets made from the morning's chhana.", 'সকালের ছানায় বানানো মিষ্টি।'],
    'uttara',
    ['Azampur, Uttara', 'আজমপুর, উত্তরা'],
    {
      signature: ['roshogolla', 'mishti-box'],
      onTime: 9,
      tags: ['halal', 'vegetarian', 'nutFree'],
    },
  ),
  mishti(
    'roshomoy',
    ['Roshomoy', 'রসময়'],
    ['Roshogolla and roshmalai, light on the syrup.', 'হালকা রসের রসগোল্লা আর রসমালাই।'],
    'dhanmondi',
    ['Road 15, Dhanmondi', 'রোড ১৫, ধানমন্ডি'],
    { signature: ['roshogolla', 'roshmalai'], onTime: 10 },
  ),
  mishti(
    'doi-ghor',
    ['Doi Ghor', 'দই ঘর'],
    ['Mishti doi set in clay pots.', 'মাটির সরায় পাতা মিষ্টি দই।'],
    'old-dhaka',
    ['Islampur, Old Dhaka', 'ইসলামপুর, পুরান ঢাকা'],
    { signature: ['mishti-doi'], onTime: 9 },
  ),
  mishti(
    'chhana',
    ['Chhana', 'ছানা'],
    ['Sondesh and chomchom from fresh chhana.', 'টাটকা ছানার সন্দেশ আর চমচম।'],
    'mirpur',
    ['Pallabi, Mirpur', 'পল্লবী, মিরপুর'],
    { signature: ['sondesh-piece', 'chomchom'], onTime: 9 },
  ),
  mishti(
    'sondesh',
    ['Sondesh', 'সন্দেশ'],
    ['Small-batch sondesh and kheer kodom.', 'অল্প করে বানানো সন্দেশ আর ক্ষীর কদম।'],
    'gulshan',
    ['Gulshan 2', 'গুলশান ২'],
    { signature: ['sondesh-piece', 'kheer-kodom'], onTime: 8 },
  ),
  mishti(
    'jilapi-goli',
    ['Jilapi Goli', 'জিলাপি গলি'],
    [
      'Hot jilapi and amriti, fried through the day.',
      'সারাদিন গরম গরম ভাজা জিলাপি আর আমৃত্তি।',
    ],
    'wari',
    ['Tikatuli, Wari', 'টিকাটুলি, ওয়ারী'],
    { signature: ['jilapi', 'amriti'], onTime: 9 },
  ),

  /* Pitha */
  pitha(
    'pitha-puli',
    ['Pitha Puli', 'পিঠা পুলি'],
    ['Winter pitha, made all year.', 'শীতের পিঠা, সারা বছর।'],
    'shahbag',
    ['Nilkhet, Shahbag', 'নীলক্ষেত, শাহবাগ'],
    {
      signature: ['bhapa-pitha', 'dudh-puli'],
      onTime: 9,
      tags: ['halal', 'vegetarian', 'nutFree'],
    },
  ),
  pitha(
    'shiter-sokal',
    ['Shiter Sokal', 'শীতের সকাল'],
    ['Bhapa and chitoi with date-palm jaggery.', 'খেজুর গুড় দিয়ে ভাপা আর চিতই।'],
    'mohakhali',
    ['Nakhalpara, Mohakhali', 'নাখালপাড়া, মহাখালী'],
    { signature: ['bhapa-pitha', 'chitoi'], onTime: 8 },
  ),
  pitha(
    'bhapa',
    ['Bhapa', 'ভাপা'],
    ['Steamed pitha, still warm when it leaves.', 'ভাপ ওঠা পিঠা, গরম থাকতেই রওনা।'],
    'wari',
    ['Hatkhola Road, Wari', 'হাটখোলা রোড, ওয়ারী'],
    { signature: ['bhapa-pitha'], onTime: 9 },
  ),
  pitha(
    'nokshi',
    ['Nokshi', 'নকশি'],
    ['Nokshi pitha, patterned by hand.', 'হাতে নকশা তোলা নকশি পিঠা।'],
    'uttara',
    ['Sector 10, Uttara', 'সেক্টর ১০, উত্তরা'],
    { signature: ['nokshi-pitha'], onTime: 9 },
  ),
];
