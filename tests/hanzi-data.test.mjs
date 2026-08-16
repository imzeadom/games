import assert from "node:assert/strict";
import test from "node:test";

const { BEGINNER_BANK, MEDIUM_BANK, SHAPE_GROUPS } = await import("../app/hanzi-listen/data.ts");
const { buildHanziOptions } = await import("../app/hanzi-listen/logic.ts");

test("hanzi banks are complete and structurally valid", () => {
  assert.ok(BEGINNER_BANK.length >= 80 && BEGINNER_BANK.length <= 100);
  assert.equal(MEDIUM_BANK.length, 500);
  assert.equal(new Set(MEDIUM_BANK.map((entry) => entry.hanzi)).size, 500);
  for (const entry of MEDIUM_BANK) {
    assert.deepEqual(Object.keys(entry).sort(), ["audio", "category", "confusableWith", "difficulty", "hanzi", "image"]);
    assert.ok(Array.isArray(entry.confusableWith));
  }
  const beginner = new Set(BEGINNER_BANK.map((entry) => entry.hanzi));
  assert.ok([...beginner].every((hanzi) => MEDIUM_BANK.some((entry) => entry.hanzi === hanzi)));
  for (const group of SHAPE_GROUPS) {
    for (const hanzi of group) {
      const entry = MEDIUM_BANK.find((item) => item.hanzi === hanzi);
      assert.ok(entry);
      assert.ok(group.filter((item) => item !== hanzi).every((item) => entry.confusableWith.includes(item)));
    }
  }
  assert.ok(MEDIUM_BANK.every((entry) => entry.confusableWith.every((target) => MEDIUM_BANK.some((candidate) => candidate.hanzi === target))));
});

test("option builder respects difficulty rules", () => {
  const target = { hanzi: "大", audio: "tts:大", image: "✨", category: "自然", difficulty: "medium", confusableWith: ["太", "天"] };
  const bank = [target, { ...target, hanzi: "太", confusableWith: ["大", "天"] }, { ...target, hanzi: "天", confusableWith: ["大", "太"] }, { ...target, hanzi: "木", confusableWith: ["大"] }, { ...target, hanzi: "禾", confusableWith: ["大"] }, { ...target, hanzi: "本", confusableWith: ["大"] }, { ...target, hanzi: "红", category: "颜色", confusableWith: ["大"] }, ...MEDIUM_BANK.slice(0, 30)];
  for (const [mode, count] of [["beginner", 2], ["medium", 4], ["challenge", 6]]) {
    const options = buildHanziOptions(target, mode, bank, () => 0.4);
    assert.equal(options.length, count);
    assert.equal(options.filter((entry) => entry.hanzi === target.hanzi).length, 1);
  }
  const beginner = buildHanziOptions({ ...target, difficulty: "beginner" }, "beginner", bank, () => 0.2);
  assert.ok(beginner.every((entry) => !["太", "天", "木"].includes(entry.hanzi)));
  const reverseOnly = { ...target, confusableWith: [] };
  const reverseOptions = buildHanziOptions(reverseOnly, "beginner", bank, () => 0.2);
  assert.ok(reverseOptions.every((entry) => entry.hanzi !== "木"));
  const challenge = buildHanziOptions(target, "challenge", bank, () => 0.2);
  assert.ok(["太", "天"].every((hanzi) => challenge.some((entry) => entry.hanzi === hanzi)));
  const availableConfusables = new Set(["太", "天", "木", "禾", "本", "红"]);
  assert.ok(challenge.filter((entry) => entry.hanzi !== target.hanzi).every((entry) => availableConfusables.has(entry.hanzi)));
  assert.ok(buildHanziOptions(target, "medium", bank, () => 0.2).slice(1).every((entry) => entry.category === target.category));
  assert.equal(new Set(challenge.map((entry) => entry.hanzi)).size, challenge.length);
});
