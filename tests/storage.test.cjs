const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8"), context);
const { calculateResult, resultFromScores, readSavedResult, writeSavedResult, buildShareText, diagnosisShareUrl, resultStorageKey, resultStorageVersion } = vm.runInContext(
  "({ calculateResult, resultFromScores, readSavedResult, writeSavedResult, buildShareText, diagnosisShareUrl, resultStorageKey, resultStorageVersion })", context
);
const plain = value => JSON.parse(JSON.stringify(value));
const memoryStorage = () => {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key)
  };
};

test("completed results restore every combination of three axis scores", () => {
  const storage = memoryStorage();
  for (let IC = 3; IC <= 18; IC += 1) {
    for (let PE = 3; PE <= 18; PE += 1) {
      for (let FA = 3; FA <= 18; FA += 1) {
        const result = resultFromScores({ IC, PE, FA });
        assert.equal(writeSavedResult(storage, result), true);
        assert.deepEqual(plain(readSavedResult(storage)), plain(result));
      }
    }
  }
});

test("only scores and version are stored, never individual answers", () => {
  const storage = memoryStorage();
  const result = calculateResult([3, 3, 3, 3, 3, 5, 1, 2, 4]);
  writeSavedResult(storage, result);
  assert.deepEqual(JSON.parse(storage.getItem(resultStorageKey)), {
    version: resultStorageVersion, scores: { IC: 10, PE: 11, FA: 7 }
  });
  result.scores.IC = 18;
  assert.equal(readSavedResult(storage).typeCode, "IEF");
});

test("missing, malformed and incompatible saved records are ignored", () => {
  const storage = memoryStorage();
  assert.equal(readSavedResult(storage), null);
  for (const value of ["invalid", "null", "[]", "{}", JSON.stringify({ version: 99, scores: { IC: 3, PE: 3, FA: 3 } })]) {
    storage.setItem(resultStorageKey, value);
    assert.equal(readSavedResult(storage), null);
  }
  for (const scores of [null, [], {}, { IC: 3, PE: 3 }, { IC: "3", PE: 3, FA: 3 }, { IC: 2, PE: 3, FA: 3 }, { IC: 3, PE: 19, FA: 3 }, { IC: 3, PE: 3, FA: 3.5 }]) {
    storage.setItem(resultStorageKey, JSON.stringify({ version: resultStorageVersion, scores }));
    assert.equal(readSavedResult(storage), null);
    assert.throws(() => resultFromScores(scores), { name: "RangeError" });
  }
});

test("type and percentages are recomputed rather than trusting stored presentation fields", () => {
  const storage = memoryStorage();
  storage.setItem(resultStorageKey, JSON.stringify({
    version: resultStorageVersion, scores: { IC: 3, PE: 3, FA: 3 },
    typeCode: "CEA", imagePath: "https://invalid.example/image.png", percentages: { IC: { I: 0, C: 100 } }
  }));
  const result = readSavedResult(storage);
  assert.equal(result.typeCode, "IPF");
  assert.equal(result.percentages.IC.I, 100);
  assert.equal(result.imagePath, undefined);
});

test("storage denial and quota failures do not break scoring", () => {
  const denied = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); }
  };
  const result = calculateResult([1, 6, 1, 1, 1, 1, 1, 1, 1]);
  for (const storage of [undefined, null, denied]) {
    assert.equal(readSavedResult(storage), null);
    assert.equal(writeSavedResult(storage, result), false);
  }
  assert.equal(result.typeCode, "IPF");
});

test("failed replacement preserves the previous completed result", () => {
  const storage = memoryStorage();
  const previous = resultFromScores({ IC: 3, PE: 3, FA: 3 });
  writeSavedResult(storage, previous);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(writeSavedResult(storage, resultFromScores({ IC: 18, PE: 18, FA: 18 })), false);
  assert.deepEqual(plain(readSavedResult(storage)), plain(previous));
});

test("share text contains only public result details and the diagnosis URL", () => {
  const text = buildShareText({ titleJa: "フクロウタイプ", typeCode: "IPF" });
  assert.equal(text, [
    "私は「フクロウタイプ（IPF）」でした！",
    "あなたはどの研究者タイプ？",
    "研究者タイプ診断",
    diagnosisShareUrl
  ].join("\n"));
  assert.doesNotMatch(text, /submissionId|匿名|score|Google Sheets/);
});
