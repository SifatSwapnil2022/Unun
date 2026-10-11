import type { PromotionKind, PromotionPayer } from '@unun/core';

export type PromotionSeed = {
  code: string;
  titleEn: string;
  titleBn: string;
  termsEn: string;
  termsBn: string;
  kind: PromotionKind;
  /** amount_off: taka. percent_off: a whole percentage. free_delivery: unused. */
  value: number;
  /** Upper limit of a percentage discount, in taka. */
  maxDiscount: number | null;
  /** Food cost the order must reach, in taka. */
  minSubtotal: number;
  kitchen: string | null;
  cuisine: string | null;
  /** Daily hours in minutes after midnight. */
  hours: [number, number] | null;
  firstOrderOnly: boolean;
  paidBy: PromotionPayer;
};

export const promotionSeeds: PromotionSeed[] = [
  {
    code: 'UNUN1',
    titleEn: 'Free delivery on your first order',
    titleBn: 'প্রথম অর্ডারে ডেলিভারি ফ্রি',
    termsEn: 'Any kitchen, any amount.',
    termsBn: 'যেকোনো রান্নাঘর, যেকোনো অঙ্কের অর্ডার।',
    kind: 'free_delivery',
    value: 0,
    maxDiscount: null,
    minSubtotal: 0,
    kitchen: null,
    cuisine: null,
    hours: null,
    firstOrderOnly: true,
    paidBy: 'platform',
  },
  {
    code: 'DUM100',
    titleEn: '৳100 off at Dum Ghor',
    titleBn: 'দম ঘরে ৳১০০ ছাড়',
    termsEn: 'On food worth ৳600 or more.',
    termsBn: '৳৬০০ বা তার বেশি দামের খাবারে।',
    kind: 'amount_off',
    value: 100,
    maxDiscount: null,
    minSubtotal: 600,
    kitchen: 'dum-ghor',
    cuisine: null,
    hours: null,
    firstOrderOnly: false,
    paidBy: 'restaurant',
  },
  {
    code: 'BIKEL15',
    titleEn: '15% off cha and snacks',
    titleBn: 'চা ও নাশতায় ১৫% ছাড়',
    termsEn: 'From 3 pm to 5 pm, up to ৳80.',
    termsBn: 'বিকেল ৩টা থেকে ৫টা, সর্বোচ্চ ৳৮০।',
    kind: 'percent_off',
    value: 15,
    maxDiscount: 80,
    minSubtotal: 0,
    kitchen: null,
    cuisine: 'cha',
    hours: [15 * 60, 17 * 60],
    firstOrderOnly: false,
    paidBy: 'platform',
  },
];
