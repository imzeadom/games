import type { HanziEntry, HanziDifficulty } from "./data";

export const OPTION_COUNTS: Record<HanziDifficulty, number> = { beginner: 2, medium: 4, challenge: 6 };

export function shuffleWithRandom<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function buildHanziOptions(target: HanziEntry, mode: HanziDifficulty, bank: HanziEntry[], random = Math.random): HanziEntry[] {
  const count = OPTION_COUNTS[mode];
  const uniqueBank = [...new Map(bank.map((entry) => [entry.hanzi, entry])).values()];
  const confusable = new Set([target.hanzi, ...target.confusableWith, ...uniqueBank.filter((item) => item.confusableWith.includes(target.hanzi)).map((item) => item.hanzi)]);
  const eligible = uniqueBank.filter((entry) => entry.hanzi !== target.hanzi && (mode === "beginner" ? !confusable.has(entry.hanzi) : true));
  const preferred = mode === "challenge" ? eligible.filter((entry) => confusable.has(entry.hanzi)) : mode === "medium" ? eligible.filter((entry) => entry.category === target.category) : eligible;
  const fallback = eligible.filter((entry) => !preferred.includes(entry));
  const selected = shuffleWithRandom(preferred, random).concat(shuffleWithRandom(fallback, random)).slice(0, count - 1);
  return shuffleWithRandom([target, ...selected], random);
}
