const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);
const calculate = vm.runInContext("calculateResult", context);
const types = vm.runInContext("researcherTypes", context);
const questions = vm.runInContext("questions", context);

test("revised scenarios preserve all nine question IDs, axes, scales and scoring directions", () => {
  assert.equal(questions.length, 9);
  assert.equal(new Set(Array.from(questions, question => question.text)).size, 9);
  questions.forEach((question, index) => {
    assert.equal(question.id, "Q" + (index + 1));
    assert.equal(question.axis, ["IC", "PE", "FA"][Math.floor(index / 3)]);
    assert.equal(question.scale, index < 3 ? "agreement" : "bipolar");
    assert.equal(Boolean(question.reversed), index === 1);
    assert.ok(question.text.trim().length > 0);
    if (question.scale === "bipolar") {
      assert.ok(question.a.trim().length > 0);
      assert.ok(question.b.trim().length > 0);
      assert.notEqual(question.a, question.b);
    }
  });
});

test("Q2 is reversed; the three axes have independent scores", () => {
  const result = calculate([1, 6, 1, 1, 1, 1, 6, 6, 6]);
  assert.equal(result.typeCode, "IPA");
  assert.deepEqual({ ...result.scores }, { IC: 3, PE: 3, FA: 18 });
  assert.equal(calculate([6, 1, 6, 6, 6, 6, 1, 1, 1]).typeCode, "CEF");
});

test("scores 10 and 11 fall on opposite sides of every boundary", () => {
  const low = calculate([3, 4, 4, 3, 3, 4, 3, 3, 4]);
  const high = calculate([3, 3, 4, 3, 3, 5, 3, 3, 5]);
  assert.deepEqual({ ...low.scores }, { IC: 10, PE: 10, FA: 10 });
  assert.deepEqual({ ...high.scores }, { IC: 11, PE: 11, FA: 11 });
  assert.equal(low.typeCode, "IPF");
  assert.equal(high.typeCode, "CEA");
  assert.deepEqual({ ...low.percentages.IC }, { I: 53, C: 47 });
  assert.deepEqual({ ...low.percentages.PE }, { P: 53, E: 47 });
  assert.deepEqual({ ...low.percentages.FA }, { F: 53, A: 47 });
  assert.deepEqual({ ...high.percentages.IC }, { I: 47, C: 53 });
  assert.deepEqual({ ...high.percentages.PE }, { P: 47, E: 53 });
  assert.deepEqual({ ...high.percentages.FA }, { F: 47, A: 53 });
});

test("percentages map the score range to 0-100 and sum to 100", () => {
  const expectedRight = [0, 7, 13, 20, 27, 33, 40, 47, 53, 60, 67, 73, 80, 87, 93, 100];
  for (let score = 3; score <= 18; score += 1) {
    let remaining = score - 3;
    const triple = [1, 1, 1].map(() => {
      const increment = Math.min(remaining, 5);
      remaining -= increment;
      return 1 + increment;
    });
    const result = calculate([triple[0], 7 - triple[1], triple[2], ...triple, ...triple]);
    for (const [key, left, right] of [["IC", "I", "C"], ["PE", "P", "E"], ["FA", "F", "A"]]) {
      assert.equal(result.percentages[key][right], expectedRight[score - 3]);
      assert.equal(result.percentages[key][left] + result.percentages[key][right], 100);
      const selected = score <= 10 ? left : right;
      assert.ok(result.percentages[key][selected] > 50);
      assert.ok(result.typeCode.includes(selected));
    }
  }
});

test("all 216 triples per axis follow the specified threshold", () => {
  for (let a = 1; a <= 6; a += 1) {
    for (let b = 1; b <= 6; b += 1) {
      for (let c = 1; c <= 6; c += 1) {
        const individual = calculate([a, b, c, 1, 1, 1, 1, 1, 1]);
        const planning = calculate([1, 6, 1, a, b, c, 1, 1, 1]);
        const application = calculate([1, 6, 1, 1, 1, 1, a, b, c]);
        assert.equal(individual.typeCode, (a + 7 - b + c < 10.5 ? "I" : "C") + "PF");
        assert.equal(planning.typeCode, "I" + (a + b + c < 10.5 ? "P" : "E") + "F");
        assert.equal(application.typeCode, "IP" + (a + b + c < 10.5 ? "F" : "A"));
      }
    }
  }
});

test("all eight results map to the specified animals and existing PNGs", () => {
  const expected = {
    IPF: "フクロウ", IPA: "キツツキ", IEF: "タコ", IEA: "アライグマ",
    CPF: "ゾウ", CPA: "ビーバー", CEF: "イルカ", CEA: "カワウソ"
  };
  assert.deepEqual(Object.keys(types).sort(), Object.keys(expected).sort());
  for (const [code, animal] of Object.entries(expected)) {
    const answers = [
      ...(code[0] === "I" ? [1, 6, 1] : [6, 1, 6]),
      ...Array(3).fill(code[1] === "P" ? 1 : 6),
      ...Array(3).fill(code[2] === "F" ? 1 : 6)
    ];
    assert.equal(calculate(answers).typeCode, code);
    assert.equal(types[code].animalName, animal);
    assert.equal(types[code].typeCode, code);
    assert.equal(types[code].axis1 + types[code].axis2 + types[code].axis3, code);
    assert.equal(types[code].imagePath, "assets/images/" + animal + ".png");
    const png = fs.readFileSync(path.join(root, types[code].imagePath));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
});

test("incomplete, sparse, fractional and out-of-range answers are rejected", () => {
  for (const answers of [null, [], Array(8).fill(1), Array(10).fill(1), Array(9)]) {
    assert.throws(() => calculate(answers), { name: "RangeError" });
  }
  for (let index = 0; index < 9; index += 1) {
    for (const invalid of [null, undefined, 0, 7, 1.5, NaN, Infinity, "3"]) {
      const answers = Array(9).fill(1);
      answers[index] = invalid;
      assert.throws(() => calculate(answers), { name: "RangeError" });
    }
  }
});

test("scoring leaves the supplied answers unchanged", () => {
  const answers = Object.freeze([3, 4, 4, 3, 3, 4, 3, 3, 4]);
  calculate(answers);
  assert.deepEqual(answers, [3, 4, 4, 3, 3, 4, 3, 3, 4]);
});
