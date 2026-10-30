/**
 * A small seedable random number generator (mulberry32), so that a failing
 * randomized test can be reproduced from its seed alone.
 * Returns a function that gives numbers in [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [0, max) from a generator made by {@link seededRandom}. */
export const randomInt = (random: () => number, max: number) =>
  Math.floor(random() * max);

/**
 * Shrink a list that makes `fails` return true to a smaller one that still
 * does (delta debugging: try dropping ever smaller chunks). The result is
 * "1-minimal" when the search finishes: removing any single item makes it pass.
 * `maxTries` bounds how many times `fails` is called.
 */
export function minimise<T>(
  items: readonly T[],
  fails: (candidate: readonly T[]) => boolean,
  maxTries = 300
): T[] {
  let current = [...items];
  let tries = 0;
  let parts = 2;
  while (current.length >= 2 && tries < maxTries) {
    const size = Math.ceil(current.length / parts);
    let shrunk = false;
    for (
      let start = 0;
      start < current.length && tries < maxTries;
      start += size
    ) {
      const without = [
        ...current.slice(0, start),
        ...current.slice(start + size),
      ];
      tries++;
      if (fails(without)) {
        current = without;
        parts = Math.max(parts - 1, 2);
        shrunk = true;
        break;
      }
    }
    if (!shrunk) {
      if (parts >= current.length) {
        break;
      }
      parts = Math.min(parts * 2, current.length);
    }
  }
  // a single remaining item might not be needed at all
  if (current.length === 1 && tries < maxTries && fails([])) {
    current = [];
  }
  return current;
}
