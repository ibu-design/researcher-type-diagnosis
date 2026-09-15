"use strict";

const axes = {
  IC: {
    label: "個人 / 協働",
    poles: ["I", "C"],
    names: { I: "個人", C: "協働" },
    english: { I: "Independent", C: "Collaborative" },
    descriptions: {
      I: "一人で集中して考え，自分のペースで進めたい",
      C: "人と議論・協力しながら進めたい"
    }
  },
  PE: {
    label: "計画 / 試行錯誤",
    poles: ["P", "E"],
    names: { P: "計画", E: "試行錯誤" },
    english: { P: "Planned", E: "Experimental" },
    descriptions: {
      P: "見通しや手順を立ててから進めたい",
      E: "まず試して，結果を見ながら方向を変えたい"
    }
  },
  FA: {
    label: "原理追究 / 社会応用",
    poles: ["F", "A"],
    names: { F: "原理追究", A: "社会応用" },
    english: { F: "Fundamental", A: "Applied" },
    descriptions: {
      F: "「なぜそうなるのか」という仕組み・原理を明らかにしたい",
      A: "研究成果を実際に役立つ形につなげたい"
    }
  }
};

// 説明は提示されたキャラクターイメージの仮文。キャッチコピーは確定後に設定する。
const researcherTypes = {
  IPF: {
    typeCode: "IPF", animalName: "フクロウ",
    axis1: "I", axis2: "P", axis3: "F", titleJa: "フクロウタイプ",
    shortCatch: null,
    description: "一人でじっくり考え，見通しを立てながら仕組みを追究する",
    imagePath: "assets/images/フクロウ.png"
  },
  IPA: {
    typeCode: "IPA", animalName: "キツツキ",
    axis1: "I", axis2: "P", axis3: "A", titleJa: "キツツキタイプ",
    shortCatch: null,
    description: "一人で着実に作業し，実際に使えるものを形にする",
    imagePath: "assets/images/キツツキ.png"
  },
  IEF: {
    typeCode: "IEF", animalName: "タコ",
    axis1: "I", axis2: "E", axis3: "F", titleJa: "タコタイプ",
    shortCatch: null,
    description: "自分でいろいろ試しながら，未知の仕組みを探る",
    imagePath: "assets/images/タコ.png"
  },
  IEA: {
    typeCode: "IEA", animalName: "アライグマ",
    axis1: "I", axis2: "E", axis3: "A", titleJa: "アライグマタイプ",
    shortCatch: null,
    description: "まず試してみて，うまくいく方法を実用につなげる",
    imagePath: "assets/images/アライグマ.png"
  },
  CPF: {
    typeCode: "CPF", animalName: "ゾウ",
    axis1: "C", axis2: "P", axis3: "F", titleJa: "ゾウタイプ",
    shortCatch: null,
    description: "仲間と知識を共有しながら，じっくり筋道を立てて考える",
    imagePath: "assets/images/ゾウ.png"
  },
  CPA: {
    typeCode: "CPA", animalName: "ビーバー",
    axis1: "C", axis2: "P", axis3: "A", titleJa: "ビーバータイプ",
    shortCatch: null,
    description: "仲間と協力して，役立つものを計画的に作る",
    imagePath: "assets/images/ビーバー.png"
  },
  CEF: {
    typeCode: "CEF", animalName: "イルカ",
    axis1: "C", axis2: "E", axis3: "F", titleJa: "イルカタイプ",
    shortCatch: null,
    description: "仲間とアイデアを出し合い，いろいろ試しながら未知を探る",
    imagePath: "assets/images/イルカ.png"
  },
  CEA: {
    typeCode: "CEA", animalName: "カワウソ",
    axis1: "C", axis2: "E", axis3: "A", titleJa: "カワウソタイプ",
    shortCatch: null,
    description: "仲間と試行錯誤しながら，使えるアイデアを形にする",
    imagePath: "assets/images/カワウソ.png"
  }
};

const answerLabels = {
  agreement: [
    "まったくそう思わない", "そう思わない", "あまりそう思わない",
    "ややそう思う", "そう思う", "とてもそう思う"
  ],
  bipolar: [
    "Aにとても近い", "Aに近い", "Aにやや近い",
    "Bにやや近い", "Bに近い", "Bにとても近い"
  ]
};

const questions = [
  {
    id: "Q1", axis: "IC", scale: "agreement",
    text: "一人で取り組むよりも，他の人とグループで取り組む方が好きだ．"
  },
  {
    id: "Q2", axis: "IC", scale: "agreement", reversed: true,
    text: "選べるなら，他の人とグループで取り組むよりも，一人で取り組める活動を選びたい．"
  },
  {
    id: "Q3", axis: "IC", scale: "agreement",
    text: "一人で取り組むよりも，グループで取り組む方がよい．"
  },
  {
    id: "Q4", axis: "PE", scale: "bipolar",
    text: "何かに取り組むとき，どちらに近いですか？",
    a: "始める前に，各ステップをどのように進めるかよく考えておきたい．",
    b: "まず取り組み，必要に応じて進め方を見直したい．"
  },
  {
    id: "Q5", axis: "PE", scale: "bipolar",
    text: "何かに取り組むとき，どちらに近いですか？",
    a: "各ステップを具体的に計画してから進めたい．",
    b: "実際に取り組んだ結果をもとに，繰り返し改善しながら進めたい．"
  },
  {
    id: "Q6", axis: "PE", scale: "bipolar",
    text: "何かに取り組むとき，どちらに近いですか？",
    a: "必要になる細かなステップまで，できるだけ前もって考えておきたい．",
    b: "一度終えた部分でも，必要であればもう一度取り組んで改善したい．"
  },
  {
    id: "Q7", axis: "FA", scale: "bipolar",
    text: "研究テーマを選ぶとしたら，どちらにより魅力を感じますか？",
    a: "仕組みや原理を明らかにできる研究テーマ",
    b: "社会や現場の具体的な課題の解決につながる研究テーマ"
  },
  {
    id: "Q8", axis: "FA", scale: "bipolar",
    text: "研究成果として，どちらにより魅力を感じますか？",
    a: "新しい理論や知識を生み出し，物事への理解を深める成果",
    b: "実際に使える方法や技術，仕組みにつながる成果"
  },
  {
    id: "Q9", axis: "FA", scale: "bipolar",
    text: "研究の面白さとして，どちらにより魅力を感じますか？",
    a: "「なぜそうなるのか」を深く理解できること",
    b: "「どのように役立てられるか」を具体化できること"
  }
];

// 提供された書誌情報のみを記載。不明な著者名・DOI・巻号等は公開前に確認する。
const references = [
  { axis: "第1軸：個人 / 協働", citation: "Wagner, J. A. III.（1995）. Studies of individualism-collectivism: Effects on cooperation in groups. Academy of Management Journal, 38, 152–172." },
  { axis: "第2軸：計画 / 試行錯誤", citation: "Bledow et al.（2026）. Planning / Iterationに関する尺度・研究．Journal of Occupational and Organizational Psychology.", pending: true },
  { axis: "第3軸：原理追究 / 社会応用", citation: "Bentley et al.（2015）. 研究者のbasic/theoreticalおよびapplied/practically orientedな研究志向に関する研究．Higher Education.", pending: true },
  { axis: "第3軸：原理追究 / 社会応用", citation: "Stokes, D. E.（1997）. Pasteur's Quadrant." }
];

function calculateResult(answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw new RangeError("9問すべての回答が必要です。");
  }
  const scores = { IC: 0, PE: 0, FA: 0 };
  questions.forEach((question, index) => {
    const answer = answers[index];
    if (!Number.isInteger(answer) || answer < 1 || answer > 6) {
      throw new RangeError(question.id + "の回答は1〜6の整数で指定してください。");
    }
    scores[question.axis] += question.reversed ? 7 - answer : answer;
  });
  const typeCode = Object.entries(axes)
    .map(([key, axis]) => axis.poles[scores[key] <= 10 ? 0 : 1])
    .join("");
  return { typeCode, scores };
}

function initializeApp() {
  const byId = (id) => document.getElementById(id);
  const state = { questionIndex: 0, answers: Array(questions.length).fill(null) };
  const screens = ["start-screen", "question-screen", "result-screen"];
  const nextButton = byId("next-button");
  const startButton = byId("start-button");
  const aboutDialog = byId("about-dialog");

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showScreen(id, headingId) {
    screens.forEach((screenId) => { byId(screenId).hidden = screenId !== id; });
    window.scrollTo({ top: 0, behavior: "instant" });
    byId(headingId).focus({ preventScroll: true });
  }

  function renderQuestion() {
    const question = questions[state.questionIndex];
    byId("question-title").textContent = question.text;
    byId("question-count").textContent = (state.questionIndex + 1) + " / " + questions.length;
    byId("question-progress").value = state.questionIndex + 1;
    byId("question-comparison").hidden = question.scale !== "bipolar";
    byId("statement-a").textContent = question.a || "";
    byId("statement-b").textContent = question.b || "";
    byId("answer-error").hidden = true;

    const options = answerLabels[question.scale].map((text, index) => {
      const label = element("label", "answer-option");
      const input = element("input");
      input.type = "radio";
      input.name = "answer";
      input.value = String(index + 1);
      input.required = true;
      input.checked = state.answers[state.questionIndex] === index + 1;
      const value = element("span", "answer-value", String(index + 1));
      value.setAttribute("aria-hidden", "true");
      const selected = element("span", "answer-state", "選択中");
      selected.setAttribute("aria-hidden", "true");
      label.append(input, value, element("span", "answer-label", text), selected);
      return label;
    });
    byId("answer-options").replaceChildren(...options);
    byId("back-button").textContent = state.questionIndex === 0 ? "スタートへ" : "戻る";
    nextButton.textContent = state.questionIndex === questions.length - 1 ? "結果を見る" : "次へ";
    nextButton.disabled = state.answers[state.questionIndex] === null;
    document.title = "質問 " + (state.questionIndex + 1) + " / " + questions.length + " | 研究者タイプ診断";
    showScreen("question-screen", "question-title");
  }

  function renderResult() {
    const result = calculateResult(state.answers);
    const type = researcherTypes[result.typeCode];
    byId("result-code").textContent = type.typeCode;
    byId("result-title").textContent = type.titleJa;
    byId("result-image").alt = type.animalName + "の研究者キャラクター";
    byId("result-image").src = type.imagePath;
    byId("result-description").textContent = type.description || "";
    byId("result-catch").textContent = type.shortCatch || "";
    byId("result-catch").hidden = !type.shortCatch;
    const rows = Object.values(axes).map((axis, index) => {
      const selectedPole = type["axis" + (index + 1)];
      const row = element("div", "axis-row");
      row.append(element("dt", "axis-label", axis.label));
      const values = element("dd", "axis-poles");
      axis.poles.forEach((pole) => {
        const selected = pole === selectedPole;
        const name = element("span", "axis-pole" + (selected ? " is-selected" : ""));
        const code = element("b", "axis-code", pole);
        code.setAttribute("aria-hidden", "true");
        name.append(code, element("span", "", axis.names[pole]));
        name.append(element("span", "axis-indicator", selected ? "該当" : ""));
        values.append(name);
      });
      row.append(values);
      return row;
    });
    byId("result-axes").replaceChildren(...rows);
    document.title = type.titleJa + "（" + type.typeCode + "）| 研究者タイプ診断";
    showScreen("result-screen", "result-title");
  }

  Object.values(researcherTypes).forEach((type) => {
    const figure = element("figure", "character");
    const img = element("img");
    img.src = type.imagePath;
    img.alt = type.animalName + "の研究者キャラクター";
    img.width = 144;
    img.height = 174;
    img.decoding = "async";
    figure.append(img, element("figcaption", "", type.animalName));
    byId("character-gallery").append(figure);
  });

  Object.values(axes).forEach((axis) => {
    const row = element("div");
    row.append(element("dt", "", axis.label));
    axis.poles.forEach((pole) => {
      row.append(element("dd", "", pole + "：" + axis.english[pole] + " / " + axis.descriptions[pole]));
    });
    byId("about-axes").append(row);
  });

  references.forEach((reference) => {
    const item = element("li");
    item.append(element("span", "reference-axis", reference.axis), element("p", "", reference.citation));
    if (reference.pending) item.append(element("span", "reference-pending", "書誌情報確認中"));
    byId("reference-list").append(item);
  });

  startButton.addEventListener("click", renderQuestion);
  startButton.disabled = false;

  byId("answer-options").addEventListener("change", (event) => {
    if (!event.target.matches('input[name="answer"]')) return;
    state.answers[state.questionIndex] = Number(event.target.value);
    nextButton.disabled = false;
    byId("answer-error").hidden = true;
  });

  byId("question-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.answers[state.questionIndex] === null) {
      byId("answer-error").hidden = false;
      byId("answer-options").querySelector("input").focus();
      return;
    }
    if (state.questionIndex === questions.length - 1) {
      renderResult();
    } else {
      state.questionIndex += 1;
      renderQuestion();
    }
  });

  byId("back-button").addEventListener("click", () => {
    if (state.questionIndex > 0) {
      state.questionIndex -= 1;
      renderQuestion();
    } else {
      startButton.textContent = state.answers.some((answer) => answer !== null) ? "診断をつづける" : "診断をはじめる";
      document.title = "研究者タイプ診断";
      showScreen("start-screen", "site-title");
    }
  });

  byId("restart-button").addEventListener("click", () => {
    state.answers.fill(null);
    state.questionIndex = 0;
    startButton.textContent = "診断をはじめる";
    renderQuestion();
  });

  document.querySelectorAll("[data-about]").forEach((button) => {
    button.disabled = false;
    button.addEventListener("click", () => {
      aboutDialog.showModal();
      document.body.classList.add("dialog-open");
      const target = byId(button.dataset.about);
      target.focus({ preventScroll: true });
      if (button.dataset.about === "references-title") {
        target.scrollIntoView({ block: "start" });
      } else {
        aboutDialog.scrollTop = 0;
      }
    });
  });
  aboutDialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
}

if (typeof document !== "undefined") initializeApp();
