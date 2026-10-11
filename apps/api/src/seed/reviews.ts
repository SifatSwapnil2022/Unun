/**
 * What the invented customers of the seeded history wrote about their orders. Like the
 * kitchens, these are made up. They are short on purpose, and written the way people in
 * Dhaka write a review: in English, in Bangla, or in Bangla with English letters.
 */

/** Comments by number of stars, for an order that arrived inside its window. */
export const commentsByStars: Record<number, string[]> = {
  5: [
    'Arrived hot, and the portion was more than I expected.',
    'Exactly what I ordered. Packed well, nothing spilled.',
    'Best I have had in this area. Ordering again on Friday.',
    'The rider called from the gate and was polite. Food was great.',
    'Fresh, and still warm after the ride.',
    'Came ten minutes before the time they gave.',
    'খুব ভালো ছিল। আবার অর্ডার করব।',
    'গরম গরম পেয়েছি, পরিমাণও ভালো।',
    'Onek moja chilo, packaging o valo.',
    'My mother asked where it was from. That says enough.',
  ],
  4: [
    'Good food. A little too much oil for me.',
    'Tasty, but the portion is smaller than it used to be.',
    'Everything was right. I would like less salt next time.',
    'Arrived on time. Some gravy leaked into the bag.',
    'ভালো, তবে ঝাল একটু বেশি ছিল।',
    'Valo chilo, kintu ektu thanda hoye gesilo.',
    'Good, and the price is fair.',
  ],
  3: [
    'Okay. Not as good as last time.',
    'The food was fine, but it came lukewarm.',
    'Average. The rice was a bit dry.',
    'মোটামুটি। দামের তুলনায় পরিমাণ কম।',
  ],
  2: [
    'Cold by the time it reached me.',
    'Too salty to finish.',
    'Motamuti, abar order korbo na mone hoy.',
  ],
  1: [
    'One item was missing and nobody picked up the phone.',
    'Not what the photo shows. Very disappointed.',
  ],
};

/** Comments for an order that arrived after its window closed. */
export const lateComments: Record<number, string[]> = {
  4: ['দেরিতে এসেছে, তবে খাবার ভালো ছিল।', 'A bit late, but hot and tasty.'],
  3: [
    'Late by a good while. The food itself was fine.',
    'Deri hoyeche, khabar thik chilo.',
  ],
  2: [
    'Came well after the time they promised.',
    'অর্ডার দেরিতে এসেছে, খাবার ঠান্ডা ছিল।',
  ],
  1: ['Very late, and the food was cold.'],
};

/** Problems the invented customers reported, for support staff to find on first start. */
export const issueSeeds = [
  {
    kind: 'missing_item',
    detail: 'The borhani I paid for was not in the bag. Everything else was there.',
  },
  {
    kind: 'quality',
    detail: 'The rice was cold and hard, as if it had been cooked in the morning.',
  },
  {
    kind: 'late',
    detail: 'It came long after the time on the screen, and nobody called to say so.',
  },
  {
    kind: 'wrong_item',
    detail:
      'I ordered the beef and got the chicken. I ate it, but it is not what I paid for.',
  },
  {
    kind: 'other',
    detail:
      'The rider asked for more than the total on my screen. I paid the screen total.',
  },
] as const;
