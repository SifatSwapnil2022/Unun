export type AreaNames = {
  id: string;
  /** Every name the area is known by, in any language: Dhanmondi, ধানমন্ডি, Jigatola. */
  names: readonly string[];
};

function normalise(text: string): string {
  return text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

/**
 * Matches what a visitor typed against the delivery areas. "House 12, Road 27,
 * Dhanmondi" and "dhan" both find Dhanmondi; one or two letters find nothing.
 * When several names appear in the text, the longest one wins.
 */
export function matchArea<T extends AreaNames>(
  query: string,
  areas: readonly T[],
): T | null {
  const wanted = normalise(query);
  if (wanted.length < 3) return null;

  let best: { area: T; length: number } | null = null;
  for (const area of areas) {
    for (const name of area.names.map(normalise)) {
      const hit = wanted.includes(name) || name.startsWith(wanted);
      if (hit && (best === null || name.length > best.length)) {
        best = { area, length: name.length };
      }
    }
  }
  return best?.area ?? null;
}
