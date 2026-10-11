/**
 * Cuisines. `tone` names one of the flat colour blocks of the design system; the web
 * app maps it to colours. `photo` is a key in media/manifest.json.
 */
export type CuisineSeed = {
  id: string;
  en: string;
  bn: string;
  tone: 'turmeric' | 'clay' | 'leaf' | 'ash' | 'soot' | 'ember';
  photo: string;
};

export const cuisineSeeds: CuisineSeed[] = [
  {
    id: 'kacchi',
    en: 'Kacchi and biryani',
    bn: 'কাচ্চি ও বিরিয়ানি',
    tone: 'turmeric',
    photo: 'kacchi-platter',
  },
  {
    id: 'kebab',
    en: 'Kabab and grill',
    bn: 'কাবাব ও গ্রিল',
    tone: 'clay',
    photo: 'kebab-coals',
  },
  {
    id: 'bhaat',
    en: 'Bhorta, fish and rice',
    bn: 'ভর্তা, মাছ ও ভাত',
    tone: 'leaf',
    photo: 'thali-rice',
  },
  {
    id: 'nasta',
    en: 'Porota and nehari',
    bn: 'পরোটা ও নেহারি',
    tone: 'ash',
    photo: 'paratha-stuffed',
  },
  {
    id: 'chinese',
    en: 'Bangla Chinese',
    bn: 'বাংলা চাইনিজ',
    tone: 'soot',
    photo: 'noodles-platter',
  },
  {
    id: 'burger',
    en: 'Burgers and fried chicken',
    bn: 'বার্গার ও ফ্রাইড চিকেন',
    tone: 'ember',
    photo: 'burger-cheese',
  },
  {
    id: 'fuchka',
    en: 'Fuchka and chotpoti',
    bn: 'ফুচকা ও চটপটি',
    tone: 'turmeric',
    photo: 'fuchka-bowl',
  },
  {
    id: 'cha',
    en: 'Cha and snacks',
    bn: 'চা ও নাশতা',
    tone: 'clay',
    photo: 'shingara-tea',
  },
  {
    id: 'mishti',
    en: 'Mishti and doi',
    bn: 'মিষ্টি ও দই',
    tone: 'leaf',
    photo: 'roshogolla-clay',
  },
  { id: 'pitha', en: 'Pitha', bn: 'পিঠা', tone: 'ash', photo: 'crepe' },
];
