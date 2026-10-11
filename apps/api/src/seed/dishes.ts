/**
 * The dish catalogue the seeded menus are built from. Prices are base prices in taka;
 * each kitchen's menu scales them by its area's price level. Photographs are assigned
 * in photos.ts.
 */
import type { Allergen, ItemTag } from '@unun/core';
import { dishAllergens } from './allergens';
import { dishPhotos } from './photos';

export type DishSeed = {
  key: string;
  en: string;
  bn: string;
  descriptionEn: string;
  descriptionBn: string;
  /** Base price in taka. */
  price: number;
  /** A key in media/manifest.json. */
  photo: string;
  tags: ItemTag[];
  allergens: Allergen[];
};

type DishOptions = {
  about?: [en: string, bn: string];
  tags?: ItemTag[];
};

function photoFor(key: string): string {
  const photo = dishPhotos[key];
  if (!photo) throw new Error(`Dish "${key}" has no photograph in seed/photos.ts`);
  return photo;
}

function allergensFor(key: string): Allergen[] {
  const allergens = dishAllergens[key];
  if (!allergens) throw new Error(`Dish "${key}" has no line in seed/allergens.ts`);
  return allergens;
}

function dish(
  key: string,
  en: string,
  bn: string,
  price: number,
  options: DishOptions = {},
): DishSeed {
  return {
    key,
    en,
    bn,
    descriptionEn: options.about?.[0] ?? '',
    descriptionBn: options.about?.[1] ?? '',
    price,
    photo: photoFor(key),
    tags: options.tags ?? [],
    allergens: allergensFor(key),
  };
}

const VEG: ItemTag[] = ['vegetarian'];

const biryani: DishSeed[] = [
  dish('kacchi-mutton', 'Mutton kacchi biryani', 'খাসির কাচ্চি বিরিয়ানি', 380, {
    about: [
      'Basmati rice, mutton and potato cooked together under a sealed lid.',
      'বাসমতী চাল, খাসির মাংস আর আলু একসঙ্গে দমে রান্না।',
    ],
  }),
  dish('kacchi-beef', 'Beef kacchi biryani', 'গরুর কাচ্চি বিরিয়ানি', 300, {
    about: [
      'The same slow method, with beef on the bone.',
      'একই দমের রান্না, হাড়সহ গরুর মাংসে।',
    ],
  }),
  dish('chicken-biryani', 'Chicken biryani', 'চিকেন বিরিয়ানি', 220, {
    about: [
      'Chicken, fragrant rice and a boiled egg.',
      'মুরগি, সুগন্ধি চাল আর একটি সেদ্ধ ডিম।',
    ],
  }),
  dish('morog-polao', 'Morog polao', 'মোরগ পোলাও', 260, {
    about: [
      'Chinigura rice with chicken in a mild, milky gravy.',
      'চিনিগুঁড়া চালে মুরগি, হালকা দুধেল ঝোলে।',
    ],
  }),
  dish('tehari-beef', 'Beef tehari', 'গরুর তেহারি', 200, {
    about: [
      'Small pieces of beef and rice cooked in mustard oil with green chili.',
      'সরিষার তেল আর কাঁচা মরিচে ছোট টুকরো গরুর মাংস ও চাল।',
    ],
    tags: ['spicy'],
  }),
  dish('plain-polao', 'Plain polao', 'সাদা পোলাও', 90, {
    about: ['Ghee rice with whole spices.', 'ঘি আর গোটা মশলায় রান্না পোলাও।'],
    tags: VEG,
  }),
  dish('chicken-roast', 'Chicken roast', 'চিকেন রোস্ট', 160, {
    about: [
      'Wedding-style chicken in a sweet, thick gravy.',
      'বিয়ে বাড়ির ধাঁচে মিষ্টি ঘন ঝোলের মুরগি।',
    ],
  }),
  dish('beef-rezala', 'Beef rezala', 'গরুর রেজালা', 220, {
    about: [
      'Beef in a yoghurt gravy with whole green chili.',
      'টক দইয়ের ঝোলে গরুর মাংস, সঙ্গে আস্ত কাঁচা মরিচ।',
    ],
  }),
  dish('jali-kabab', 'Jali kabab', 'জালি কাবাব', 60, {
    about: [
      'Minced beef patty in a lacy egg crust.',
      'ডিমের জালি মোড়ানো গরুর কিমার কাবাব।',
    ],
  }),
  dish('borhani', 'Borhani', 'বোরহানি', 60, {
    about: [
      'Spiced yoghurt drink with mint and black salt.',
      'পুদিনা আর বিট লবণ দেওয়া মশলাদার দইয়ের পানীয়।',
    ],
    tags: VEG,
  }),
  dish('firni', 'Firni', 'ফিরনি', 50, {
    about: [
      'Ground rice pudding set in a clay cup.',
      'মাটির খুরিতে জমানো চালের গুঁড়ার পায়েস।',
    ],
    tags: VEG,
  }),
  dish('jorda', 'Jorda', 'জর্দা', 60, {
    about: [
      'Sweet saffron-coloured rice with raisins and nuts.',
      'কিশমিশ আর বাদাম দেওয়া মিষ্টি জর্দা।',
    ],
    tags: ['vegetarian'],
  }),
  dish('salad', 'Onion and cucumber salad', 'পেঁয়াজ-শসার সালাদ', 20, {
    about: ['With lemon and green chili.', 'লেবু আর কাঁচা মরিচসহ।'],
    tags: VEG,
  }),
  dish('water', 'Mineral water, 500 ml', 'পানি, ৫০০ মিলি', 20, { tags: VEG }),
  dish('soft-drink', 'Soft drink, 250 ml', 'কোমল পানীয়, ২৫০ মিলি', 30, { tags: VEG }),
];

const kabab: DishSeed[] = [
  dish('sheek-beef', 'Beef sheek kabab', 'গরুর শিক কাবাব', 180, {
    about: [
      'Two skewers of minced beef, grilled over charcoal.',
      'কয়লায় সেঁকা গরুর কিমার দুই শিক।',
    ],
  }),
  dish('sheek-chicken', 'Chicken sheek kabab', 'চিকেন শিক কাবাব', 160, {
    about: [
      'Two skewers, lighter and milder than the beef.',
      'দুই শিক, গরুর চেয়ে হালকা আর কম ঝাল।',
    ],
  }),
  dish('boti-kabab', 'Beef boti kabab', 'গরুর বটি কাবাব', 220, {
    about: [
      'Cubes of beef marinated in papaya and spices.',
      'পেঁপে আর মশলায় মাখানো গরুর মাংসের টুকরো।',
    ],
  }),
  dish('chicken-tikka', 'Chicken tikka', 'চিকেন টিক্কা', 190, {
    about: [
      'Boneless chicken in a yoghurt marinade.',
      'দইয়ের মশলায় মাখানো হাড়ছাড়া মুরগি।',
    ],
  }),
  dish('reshmi-kabab', 'Reshmi kabab', 'রেশমি কাবাব', 210, {
    about: [
      'Soft chicken kabab with cream and cashew.',
      'ক্রিম আর কাজু দেওয়া নরম চিকেন কাবাব।',
    ],
  }),
  dish('beef-chaap', 'Beef chaap', 'গরুর চাপ', 200, {
    about: [
      'Flattened beef fried on a wide tawa.',
      'চওড়া তাওয়ায় ভাজা পাতলা করে পেটানো গরুর মাংস।',
    ],
    tags: ['spicy'],
  }),
  dish('chicken-chaap', 'Chicken chaap', 'চিকেন চাপ', 180, {
    about: [
      'A quarter chicken, pressed and fried in spices.',
      'মশলায় চেপে ভাজা কোয়ার্টার মুরগি।',
    ],
  }),
  dish('grill-quarter', 'Grilled chicken, quarter', 'গ্রিল চিকেন, কোয়ার্টার', 150, {
    about: ['With naan sauce and salad.', 'নানের সস আর সালাদসহ।'],
  }),
  dish('grill-half', 'Grilled chicken, half', 'গ্রিল চিকেন, হাফ', 290),
  dish('tandoori-half', 'Tandoori chicken, half', 'তন্দুরি চিকেন, হাফ', 320, {
    about: [
      'Cooked in a clay oven until the edges char.',
      'মাটির তন্দুরে কিনারা পোড়া পোড়া হওয়া পর্যন্ত সেঁকা।',
    ],
    tags: ['spicy'],
  }),
  dish('kabab-platter', 'Mixed kabab platter', 'মিক্সড কাবাব প্লাটার', 590, {
    about: [
      'Sheek, boti, tikka and reshmi with two naan. For two.',
      'শিক, বটি, টিক্কা আর রেশমি, সঙ্গে দুটি নান। দুজনের জন্য।',
    ],
  }),
  dish('butter-naan', 'Butter naan', 'বাটার নান', 40, { tags: VEG }),
  dish('garlic-naan', 'Garlic naan', 'গার্লিক নান', 60, { tags: VEG }),
  dish('plain-naan', 'Plain naan', 'সাদা নান', 30, { tags: VEG }),
  dish('luchi', 'Luchi, 4 pieces', 'লুচি, ৪টি', 40, {
    about: ['Puffed fried bread, for the chaap.', 'চাপের সঙ্গে খাওয়ার ফুলকো লুচি।'],
    tags: VEG,
  }),
  dish('raita', 'Raita', 'রায়তা', 40, {
    about: ['Yoghurt with cucumber and roasted cumin.', 'শসা আর ভাজা জিরা দেওয়া দই।'],
    tags: VEG,
  }),
  dish('kathi-chicken', 'Chicken kathi roll', 'চিকেন কাঠি রোল', 140, {
    about: [
      'Chicken tikka rolled in a porota with onion.',
      'পেঁয়াজসহ পরোটায় মোড়ানো চিকেন টিক্কা।',
    ],
  }),
  dish('kathi-beef', 'Beef kathi roll', 'বিফ কাঠি রোল', 160),
];

const bhaat: DishSeed[] = [
  dish('plain-rice', 'Plain rice', 'সাদা ভাত', 30, { tags: VEG }),
  dish('masoor-dal', 'Masoor dal', 'মসুর ডাল', 40, {
    about: [
      'Thin red lentil dal with fried garlic.',
      'রসুন ফোড়ন দেওয়া পাতলা মসুর ডাল।',
    ],
    tags: VEG,
  }),
  dish('aloo-bhorta', 'Aloo bhorta', 'আলু ভর্তা', 30, {
    about: [
      'Mashed potato with mustard oil, onion and dried chili.',
      'সরিষার তেল, পেঁয়াজ আর শুকনা মরিচে মাখা আলু।',
    ],
    tags: VEG,
  }),
  dish('begun-bhorta', 'Begun bhorta', 'বেগুন ভর্তা', 40, {
    about: ['Fire-roasted aubergine, mashed.', 'আগুনে পোড়ানো বেগুনের ভর্তা।'],
    tags: VEG,
  }),
  dish('tomato-bhorta', 'Tomato bhorta', 'টমেটো ভর্তা', 30, { tags: VEG }),
  dish('dim-bhorta', 'Egg bhorta', 'ডিম ভর্তা', 40),
  dish('kalojira-bhorta', 'Black cumin bhorta', 'কালোজিরা ভর্তা', 30, {
    tags: ['vegetarian', 'spicy'],
  }),
  dish('shutki-bhorta', 'Shutki bhorta', 'শুঁটকি ভর্তা', 60, {
    about: [
      'Dried fish pounded with garlic and a lot of chili.',
      'রসুন আর প্রচুর মরিচে বাটা শুঁটকি।',
    ],
    tags: ['spicy'],
  }),
  dish('chingri-bhorta', 'Prawn bhorta', 'চিংড়ি ভর্তা', 80),
  dish(
    'bhorta-platter',
    'Five-bhorta platter with rice',
    'পাঁচ ভর্তার থালি, ভাতসহ',
    180,
    {
      about: [
        'Five bhortas of the day, rice and dal.',
        'দিনের পাঁচ পদের ভর্তা, ভাত আর ডাল।',
      ],
    },
  ),
  dish('shobji-bhaji', 'Mixed vegetable bhaji', 'মিক্সড সবজি ভাজি', 50, { tags: VEG }),
  dish('lal-shak', 'Red amaranth bhaji', 'লাল শাক ভাজি', 40, { tags: VEG }),
  dish('begun-bhaja', 'Begun bhaja, 2 slices', 'বেগুন ভাজা, ২ টুকরা', 40, { tags: VEG }),
  dish('ilish-bhaja', 'Fried ilish', 'ইলিশ ভাজা', 320, {
    about: ['One piece, fried in its own oil.', 'এক টুকরা, নিজের তেলেই ভাজা।'],
  }),
  dish('shorshe-ilish', 'Shorshe ilish', 'সরষে ইলিশ', 380, {
    about: ['Ilish steamed in mustard paste.', 'সরষে বাটায় ভাপানো ইলিশ।'],
    tags: ['spicy'],
  }),
  dish('rui-jhol', 'Rui fish curry', 'রুই মাছের ঝোল', 160, {
    about: ['With potato and tomato.', 'আলু আর টমেটো দিয়ে।'],
  }),
  dish('pabda-jhol', 'Pabda jhol', 'পাবদা মাছের ঝোল', 220),
  dish('chingri-malai', 'Prawn malai curry', 'চিংড়ি মালাইকারি', 340, {
    about: ['Prawns in coconut milk.', 'নারকেলের দুধে চিংড়ি।'],
  }),
  dish('small-fish', 'Small fish chorchori', 'ছোট মাছের চচ্চড়ি', 140, {
    tags: ['spicy'],
  }),
  dish('chicken-jhol', 'Deshi chicken curry', 'দেশি মুরগির ঝোল', 180),
  dish('beef-bhuna', 'Beef bhuna', 'গরুর ভুনা', 200, {
    about: ['Cooked down until the gravy clings.', 'ঝোল শুকিয়ে মাখা মাখা করে রান্না।'],
    tags: ['spicy'],
  }),
  dish('kala-bhuna', 'Kala bhuna', 'কালা ভুনা', 260, {
    about: [
      'Chattogram-style beef, cooked dark over hours.',
      'চট্টগ্রামের ধাঁচে ঘণ্টার পর ঘণ্টা কষানো গরুর মাংস।',
    ],
    tags: ['spicy'],
  }),
  dish('dim-jhol', 'Egg curry', 'ডিমের ঝোল', 60),
  dish('khichuri-beef', 'Bhuna khichuri with beef', 'গরুর মাংসের ভুনা খিচুড়ি', 220, {
    about: [
      'Rice and lentils cooked dry, with beef bhuna on top.',
      'ঝরঝরে ভুনা খিচুড়ি, ওপরে গরুর ভুনা।',
    ],
  }),
  dish(
    'khichuri-egg',
    'Khichuri with egg and begun bhaja',
    'ডিম ও বেগুন ভাজাসহ খিচুড়ি',
    140,
  ),
  dish('khichuri-ilish', 'Khichuri with fried ilish', 'ইলিশ ভাজাসহ খিচুড়ি', 390),
  dish('panta-ilish', 'Panta bhat with fried ilish', 'পান্তা ইলিশ', 350, {
    about: [
      'Fermented rice, fried ilish, onion and green chili.',
      'পান্তা ভাত, ইলিশ ভাজা, পেঁয়াজ আর কাঁচা মরিচ।',
    ],
  }),
  dish(
    'panta-bhorta',
    'Panta bhat with three bhortas',
    'পান্তা ভাত ও তিন পদের ভর্তা',
    150,
  ),
  dish('set-chicken', 'Set lunch with chicken', 'মুরগির সেট লাঞ্চ', 190, {
    about: [
      'Rice, dal, vegetable bhaji and chicken curry.',
      'ভাত, ডাল, সবজি ভাজি আর মুরগির ঝোল।',
    ],
  }),
  dish('set-fish', 'Set lunch with fish', 'মাছের সেট লাঞ্চ', 200, {
    about: [
      'Rice, dal, vegetable bhaji and rui curry.',
      'ভাত, ডাল, সবজি ভাজি আর রুই মাছের ঝোল।',
    ],
  }),
  dish('set-veg', 'Vegetable set lunch', 'সবজির সেট লাঞ্চ', 130, {
    about: [
      'Rice, dal, two bhortas and a bhaji.',
      'ভাত, ডাল, দুই পদের ভর্তা আর একটি ভাজি।',
    ],
    tags: VEG,
  }),
  dish('doi-cup', 'Mishti doi, cup', 'মিষ্টি দই, কাপ', 50, { tags: VEG }),
];

const nasta: DishSeed[] = [
  dish('porota', 'Porota, 2 pieces', 'পরোটা, ২টি', 30, {
    tags: VEG,
  }),
  dish('dal-bhaji', 'Dal bhaji', 'ডাল ভাজি', 40, {
    about: ['Thick chana dal for dipping porota.', 'পরোটা দিয়ে খাওয়ার ঘন বুটের ডাল।'],
    tags: VEG,
  }),
  dish('omelette', 'Egg omelette', 'ডিম অমলেট', 30, {
    about: ['With onion and green chili.', 'পেঁয়াজ আর কাঁচা মরিচ দিয়ে।'],
  }),
  dish('shobji-nasta', 'Morning mixed vegetable', 'সকালের মিক্সড সবজি', 40, {
    tags: VEG,
  }),
  dish('suji-halwa', 'Suji halwa', 'সুজির হালুয়া', 40, { tags: VEG }),
  dish('nehari-beef', 'Beef nehari', 'গরুর নেহারি', 220, {
    about: [
      'Shank simmered overnight, eaten with porota or naan.',
      'সারারাত জ্বাল দেওয়া গরুর পায়ের মাংস, পরোটা বা নানের সঙ্গে।',
    ],
    tags: ['spicy'],
  }),
  dish('nolli-nehari', 'Nolli nehari', 'নল্লি নেহারি', 320, {
    about: ['With a marrow bone.', 'মজ্জাসহ নল্লি হাড় দিয়ে।'],
    tags: ['spicy'],
  }),
  dish('paya', 'Paya', 'পায়া', 200, {
    about: [
      'Trotter soup, thin and peppery.',
      'পাতলা, গোলমরিচের ঝাঁজওয়ালা পায়ার স্যুপ।',
    ],
  }),
  dish('mughlai', 'Mughlai porota', 'মোগলাই পরোটা', 120, {
    about: [
      'Porota folded around egg and minced beef.',
      'ডিম আর গরুর কিমা ভরা ভাঁজ করা পরোটা।',
    ],
  }),
  dish('bakorkhani', 'Bakorkhani, 6 pieces', 'বাকরখানি, ৬টি', 60, {
    about: [
      'Crisp, layered and salty. For tea.',
      'খাস্তা, পরতে পরতে, নোনতা। চায়ের সঙ্গে।',
    ],
    tags: VEG,
  }),
  dish('bakorkhani-sweet', 'Sweet bakorkhani, 6 pieces', 'মিষ্টি বাকরখানি, ৬টি', 70, {
    tags: VEG,
  }),
  dish('bakorkhani-cheese', 'Cheese bakorkhani, 6 pieces', 'পনির বাকরখানি, ৬টি', 110, {
    tags: VEG,
  }),
  dish('tandoor-ruti', 'Tandoor ruti', 'তন্দুর রুটি', 20, { tags: VEG }),
];

const chinese: DishSeed[] = [
  dish('fried-rice-egg', 'Egg fried rice', 'এগ ফ্রাইড রাইস', 180),
  dish('fried-rice-chicken', 'Chicken fried rice', 'চিকেন ফ্রাইড রাইস', 220),
  dish('fried-rice-mixed', 'Mixed fried rice', 'মিক্সড ফ্রাইড রাইস', 260, {
    about: ['Chicken, prawn and egg.', 'মুরগি, চিংড়ি আর ডিম দিয়ে।'],
  }),
  dish('chow-chicken', 'Chicken chow mein', 'চিকেন চাওমিন', 220),
  dish('chow-veg', 'Vegetable chow mein', 'ভেজিটেবল চাওমিন', 180, {
    tags: VEG,
  }),
  dish('chili-chicken', 'Chili chicken', 'চিলি চিকেন', 280, {
    about: [
      'Fried chicken tossed with capsicum, onion and green chili.',
      'ক্যাপসিকাম, পেঁয়াজ আর কাঁচা মরিচে নাড়া ভাজা মুরগি।',
    ],
    tags: ['spicy'],
  }),
  dish('szechuan-chicken', 'Szechuan chicken', 'সেজুয়ান চিকেন', 300, {
    tags: ['spicy'],
  }),
  dish('beef-chili-onion', 'Beef chili onion', 'বিফ চিলি অনিয়ন', 320, {
    tags: ['spicy'],
  }),
  dish('sweet-sour-prawn', 'Sweet and sour prawn', 'সুইট অ্যান্ড সাওয়ার প্রন', 360),
  dish('thai-soup', 'Thai soup', 'থাই স্যুপ', 180, {
    about: [
      'The thick, red, sweet-and-sour soup that Dhaka calls Thai.',
      'ঢাকায় যাকে থাই স্যুপ বলে: ঘন, লালচে, টক-মিষ্টি।',
    ],
  }),
  dish('corn-soup', 'Chicken corn soup', 'চিকেন কর্ন স্যুপ', 150),
  dish('wonton', 'Fried wonton, 6 pieces', 'ফ্রাইড ওয়ানটন, ৬টি', 150),
  dish(
    'spring-roll',
    'Vegetable spring roll, 4 pieces',
    'ভেজিটেবল স্প্রিং রোল, ৪টি',
    140,
    { tags: VEG },
  ),
  dish('chinese-veg', 'Chinese mixed vegetable', 'চাইনিজ মিক্সড ভেজিটেবল', 200, {
    tags: VEG,
  }),
  dish('set-chinese', 'Set menu for one', 'একজনের সেট মেনু', 320, {
    about: [
      'Fried rice, chili chicken and mixed vegetable.',
      'ফ্রাইড রাইস, চিলি চিকেন আর মিক্সড ভেজিটেবল।',
    ],
  }),
];

const burger: DishSeed[] = [
  dish('beef-burger', 'Beef burger', 'বিফ বার্গার', 220),
  dish('cheese-burger', 'Beef cheeseburger', 'বিফ চিজবার্গার', 260, {}),
  dish('double-smash', 'Double smash burger', 'ডাবল স্ম্যাশ বার্গার', 360, {
    about: ['Two thin patties, cheese and pickles.', 'দুটি পাতলা প্যাটি, চিজ আর আচার।'],
  }),
  dish('naga-burger', 'Naga chili burger', 'নাগা বার্গার', 280, {
    about: ['Made with naga morich. It is very hot.', 'নাগা মরিচ দিয়ে তৈরি। খুবই ঝাল।'],
    tags: ['spicy'],
  }),
  dish('chicken-burger', 'Crispy chicken burger', 'ক্রিস্পি চিকেন বার্গার', 210),
  dish('fried-chicken-2', 'Fried chicken, 2 pieces', 'ফ্রাইড চিকেন, ২ পিস', 190),
  dish('fried-chicken-4', 'Fried chicken, 4 pieces', 'ফ্রাইড চিকেন, ৪ পিস', 360),
  dish('hot-wings', 'Hot wings, 6 pieces', 'হট উইংস, ৬টি', 240, {
    tags: ['spicy'],
  }),
  dish('fries', 'French fries', 'ফ্রেঞ্চ ফ্রাই', 100, { tags: VEG }),
  dish('wedges', 'Masala wedges', 'মশলা ওয়েজেস', 120, { tags: VEG }),
  dish('coleslaw', 'Coleslaw', 'কোলস্ল', 60, { tags: VEG }),
  dish('club-sandwich', 'Club sandwich', 'ক্লাব স্যান্ডউইচ', 230),
  dish('milkshake', 'Chocolate milkshake', 'চকলেট মিল্কশেক', 180, { tags: VEG }),
  dish('burger-combo', 'Burger, fries and a drink', 'বার্গার, ফ্রাই আর পানীয়', 330, {
    about: [
      'Beef burger with fries and a soft drink.',
      'বিফ বার্গারের সঙ্গে ফ্রাই আর কোমল পানীয়।',
    ],
  }),
];

const fuchka: DishSeed[] = [
  dish('fuchka', 'Fuchka, 8 pieces', 'ফুচকা, ৮টি', 60, {
    about: [
      'Crisp shells, spiced peas and potato, tamarind water.',
      'মুচমুচে খোলে মশলাদার ডাবলি আর আলু, সঙ্গে তেঁতুল জল।',
    ],
    tags: ['vegetarian', 'spicy'],
  }),
  dish('doi-fuchka', 'Doi fuchka, 8 pieces', 'দই ফুচকা, ৮টি', 90, {
    about: ['Topped with sweet yoghurt.', 'ওপরে মিষ্টি দই।'],
    tags: VEG,
  }),
  dish('chotpoti', 'Chotpoti', 'চটপটি', 70, {
    about: [
      'Stewed white peas with egg, onion and tamarind.',
      'সেদ্ধ ডাবলি, ডিম, পেঁয়াজ আর তেঁতুল।',
    ],
    tags: ['spicy'],
  }),
  dish('chotpoti-extra', 'Chotpoti with extra egg', 'বাড়তি ডিমসহ চটপটি', 90, {
    tags: ['spicy'],
  }),
  dish('jhalmuri', 'Jhalmuri', 'ঝালমুড়ি', 40, {
    about: [
      'Puffed rice with mustard oil, onion and green chili.',
      'সরিষার তেল, পেঁয়াজ আর কাঁচা মরিচে মাখা মুড়ি।',
    ],
    tags: ['vegetarian', 'spicy'],
  }),
  dish('bhelpuri', 'Bhelpuri', 'ভেলপুরি', 50, { tags: VEG }),
  dish('papri-chaat', 'Papri chaat', 'পাপড়ি চাট', 80, {
    tags: VEG,
  }),
  dish('ghugni', 'Ghugni', 'ঘুগনি', 50, { tags: VEG }),
  dish('aam-makha', 'Green mango makha', 'কাঁচা আম মাখা', 50, {
    about: [
      'Green mango with chili, salt and mustard.',
      'মরিচ, লবণ আর কাসুন্দিতে মাখা কাঁচা আম।',
    ],
    tags: ['vegetarian', 'spicy'],
  }),
  dish('tetul-shorbot', 'Tamarind sherbet', 'তেঁতুলের শরবত', 40, { tags: VEG }),
  dish('lebu-shorbot', 'Lemon sherbet', 'লেবুর শরবত', 40, { tags: VEG }),
];

const cha: DishSeed[] = [
  dish('dudh-cha', 'Milk tea', 'দুধ চা', 20, { tags: VEG }),
  dish('rong-cha', 'Red tea', 'রং চা', 15, {
    about: ['Black tea with ginger.', 'আদা দেওয়া লাল চা।'],
    tags: VEG,
  }),
  dish('lebu-cha', 'Lemon tea', 'লেবু চা', 20, { tags: VEG }),
  dish('masala-cha', 'Masala tea', 'মশলা চা', 30, { tags: VEG }),
  dish('malai-cha', 'Malai tea', 'মালাই চা', 40, {
    about: ['Milk tea with a layer of cream on top.', 'ওপরে মালাইয়ের সর ভাসানো দুধ চা।'],
    tags: VEG,
  }),
  dish('tandoori-cha', 'Tandoori tea', 'তন্দুরি চা', 50, {
    about: ['Poured into a heated clay cup.', 'গরম মাটির ভাঁড়ে ঢালা চা।'],
    tags: VEG,
  }),
  dish('shingara', 'Shingara, 2 pieces', 'শিঙাড়া, ২টি', 20, {
    about: ['Potato filling with peanuts.', 'বাদাম দেওয়া আলুর পুর।'],
    tags: ['vegetarian'],
  }),
  dish('somucha', 'Somucha, 2 pieces', 'সমুচা, ২টি', 30),
  dish('piyaju', 'Piyaju, 4 pieces', 'পিঁয়াজু, ৪টি', 30, {
    about: ['Lentil and onion fritters.', 'ডাল আর পেঁয়াজের বড়া।'],
    tags: VEG,
  }),
  dish('beguni', 'Beguni, 4 pieces', 'বেগুনি, ৪টি', 30, { tags: VEG }),
  dish('aloo-chop', 'Aloo chop, 2 pieces', 'আলুর চপ, ২টি', 30, {
    tags: VEG,
  }),
  dish('dim-chop', 'Egg chop', 'ডিমের চপ', 30),
  dish('dal-puri', 'Dal puri, 2 pieces', 'ডাল পুরি, ২টি', 20, { tags: VEG }),
  dish('butter-toast', 'Butter toast', 'বাটার টোস্ট', 40, { tags: VEG }),
  dish('toast-biscuit', 'Toast biscuits', 'টোস্ট বিস্কুট', 20, { tags: VEG }),
  dish('chola-muri', 'Chola with muri', 'ছোলা মুড়ি', 50, {
    tags: ['vegetarian', 'spicy'],
  }),
  dish('halim', 'Beef halim', 'গরুর হালিম', 150, {
    about: [
      'Lentils, wheat and beef cooked down to a porridge.',
      'ডাল, গম আর গরুর মাংস ঘুঁটে রান্না।',
    ],
    tags: ['spicy'],
  }),
];

const mishti: DishSeed[] = [
  dish('roshogolla', 'Roshogolla, 4 pieces', 'রসগোল্লা, ৪টি', 100, {
    tags: VEG,
  }),
  dish('kalojam', 'Kalojam, 4 pieces', 'কালোজাম, ৪টি', 100, {
    tags: VEG,
  }),
  dish('chomchom', 'Chomchom, 4 pieces', 'চমচম, ৪টি', 120, { tags: VEG }),
  dish('sondesh-piece', 'Sondesh, 4 pieces', 'সন্দেশ, ৪টি', 140, { tags: VEG }),
  dish('kheer-kodom', 'Kheer kodom, 4 pieces', 'ক্ষীর কদম, ৪টি', 140, {
    tags: VEG,
  }),
  dish('laddu', 'Motichur laddu, 4 pieces', 'মতিচুর লাড্ডু, ৪টি', 100, { tags: VEG }),
  dish('mishti-box', 'Mixed mishti box, 1 kg', 'মিক্সড মিষ্টির বক্স, ১ কেজি', 650, {
    about: [
      'Roshogolla, kalojam, chomchom and sondesh.',
      'রসগোল্লা, কালোজাম, চমচম আর সন্দেশ।',
    ],
    tags: VEG,
  }),
  dish('mishti-doi', 'Mishti doi, 500 g', 'মিষ্টি দই, ৫০০ গ্রাম', 180, {
    about: ['Set in a clay pot.', 'মাটির সরায় পাতা।'],
    tags: VEG,
  }),
  dish('roshmalai', 'Roshmalai, 250 g', 'রসমালাই, ২৫০ গ্রাম', 180, {
    about: ['Small chhana balls in thickened milk.', 'ঘন দুধে ছোট ছোট ছানার গোল্লা।'],
    tags: VEG,
  }),
  dish('chhanar-payesh', 'Chhanar payesh', 'ছানার পায়েস', 120, { tags: VEG }),
  dish('jilapi', 'Jilapi, 250 g', 'জিলাপি, ২৫০ গ্রাম', 90, {
    tags: VEG,
  }),
  dish('amriti', 'Amriti, 4 pieces', 'আমৃত্তি, ৪টি', 100, {
    tags: VEG,
  }),
  dish('nimki', 'Nimki, 200 g', 'নিমকি, ২০০ গ্রাম', 60, { tags: VEG }),
];

const pitha: DishSeed[] = [
  dish('bhapa-pitha', 'Bhapa pitha, 2 pieces', 'ভাপা পিঠা, ২টি', 40, {
    about: [
      'Steamed rice cake with coconut and date-palm jaggery.',
      'নারকেল আর খেজুর গুড় দেওয়া ভাপানো চালের পিঠা।',
    ],
    tags: VEG,
  }),
  dish('dudh-puli', 'Dudh puli', 'দুধ পুলি', 80, {
    about: ['Coconut dumplings in sweet milk.', 'মিষ্টি দুধে নারকেলের পুলি।'],
    tags: VEG,
  }),
  dish('dudh-chitoi', 'Dudh chitoi', 'দুধ চিতই', 90, {
    about: [
      'Chitoi soaked overnight in jaggery milk.',
      'গুড়ের দুধে সারারাত ভেজানো চিতই।',
    ],
    tags: VEG,
  }),
  dish('gur-payesh', 'Payesh with date-palm jaggery', 'খেজুর গুড়ের পায়েস', 90, {
    tags: VEG,
  }),
  dish('chitoi', 'Chitoi pitha with bhorta, 2 pieces', 'চিতই পিঠা ও ভর্তা, ২টি', 50, {
    about: ['With mustard and coriander bhorta.', 'সরষে আর ধনেপাতা ভর্তার সঙ্গে।'],
    tags: ['vegetarian', 'spicy'],
  }),
  dish('patishapta', 'Patishapta, 2 pieces', 'পাটিসাপটা, ২টি', 60, {
    about: ['Thin crepe rolled around kheer.', 'ক্ষীরের পুর ভরা পাতলা পিঠা।'],
    tags: VEG,
  }),
  dish('teler-pitha', 'Teler pitha, 2 pieces', 'তেলের পিঠা, ২টি', 40, { tags: VEG }),
  dish('nokshi-pitha', 'Nokshi pitha, 4 pieces', 'নকশি পিঠা, ৪টি', 80, { tags: VEG }),
  dish('malpoa', 'Malpoa, 2 pieces', 'মালপোয়া, ২টি', 60, { tags: VEG }),
];

export const dishSeeds: DishSeed[] = [
  ...biryani,
  ...kabab,
  ...bhaat,
  ...nasta,
  ...chinese,
  ...burger,
  ...fuchka,
  ...cha,
  ...mishti,
  ...pitha,
];
