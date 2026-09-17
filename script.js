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

// 先行研究の概念を参考にしたイベント独自の質問。原尺度の転載・翻訳ではない。
const questions = [
  {
    id: "Q1", axis: "IC", scale: "agreement",
    text: "新しいアイデアを考えるとき，一人で考えるより，誰かと話しながら考えを広げたい。"
  },
  {
    id: "Q2", axis: "IC", scale: "agreement", reversed: true,
    text: "気になることを調べるとき，誰かと一緒に調べるより，一人で取り組みたい。"
  },
  {
    id: "Q3", axis: "IC", scale: "agreement",
    text: "難しい課題に出会ったら，一人で取り組むより，仲間と一緒に考えたい。"
  },
  {
    id: "Q4", axis: "PE", scale: "bipolar",
    text: "初めてのことに挑戦するとき，どちらから始めたいですか？",
    a: "やることと順番を整理してから，取りかかる。",
    b: "まず少し試してみて，進め方を探る。"
  },
  {
    id: "Q5", axis: "PE", scale: "bipolar",
    text: "作ったものをよくしたいとき，どちらの進め方がしっくりきますか？",
    a: "改善する点と手順を決めてから，手を加える。",
    b: "少しずつ手を加え，変化を確かめながら改善する。"
  },
  {
    id: "Q6", axis: "PE", scale: "bipolar",
    text: "思ったように進まないとき，次にどうしたいですか？",
    a: "うまくいかない点を整理して，次の手順を考える。",
    b: "別のやり方を試して，結果を見ながら次を決める。"
  },
  {
    id: "Q7", axis: "FA", scale: "bipolar",
    text: "身近な「不思議」を研究するとしたら，どちらにひかれますか？",
    a: "その現象が起きる理由や仕組みを突き止める。",
    b: "その現象を利用して，暮らしの困りごとを解決する。"
  },
  {
    id: "Q8", axis: "FA", scale: "bipolar",
    text: "研究で新しい発見があったら，次に知りたいのはどちらですか？",
    a: "発見の背景に，どんな仕組みや法則があるのか。",
    b: "発見を，どんな課題の解決に生かせるのか。"
  },
  {
    id: "Q9", axis: "FA", scale: "bipolar",
    text: "自分の研究を紹介するとき，どちらを伝えられるとうれしいですか？",
    a: "「これまで分からなかった理由が，分かりました」",
    b: "「誰かの困りごとを解決する方法が，できました」"
  }
];

// 確認できた出版社情報へのリンクを添付。独自の質問・採点の検証根拠ではない。
const references = [
  { axis: "第1軸：個人 / 協働", citation: "Wagner, J. A. III.（1995）. Studies of individualism-collectivism: Effects on cooperation in groups. Academy of Management Journal, 38, 152–172.", url: "https://doi.org/10.5465/256731" },
  { axis: "第2軸：計画 / 試行錯誤", citation: "Bledow, R., Eun, H.-J., & Vossaert, L.（2026）. A closer look at the innovator: The interplay between divergent and convergent processes of self-regulation. Journal of Occupational and Organizational Psychology, 99(1), e70102.", url: "https://doi.org/10.1111/joop.70102" },
  { axis: "第3軸：原理追究 / 社会応用", citation: "Bentley, P. J., Gulbrandsen, M., & Kyvik, S.（2015）. The relationship between basic and applied research in universities. Higher Education, 70, 689–709.", url: "https://doi.org/10.1007/s10734-015-9861-2" },
  { axis: "第3軸：原理追究 / 社会応用", citation: "Stokes, D. E.（1997）. Pasteur's Quadrant." }
];

const resultStorageKey = "researcher-type-diagnosis:result";
// 質問の意味や採点を変更する場合は更新し，旧版の結果を誤って復元しない。
const resultStorageVersion = 1;

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
  return resultFromScores(scores);
}

function resultFromScores(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RangeError("3軸の得点が必要です。");
  }
  const scores = {};
  Object.keys(axes).forEach((key) => {
    if (!Number.isInteger(input[key]) || input[key] < 3 || input[key] > 18) {
      throw new RangeError(key + "の得点は3〜18の整数で指定してください。");
    }
    scores[key] = input[key];
  });
  const typeCode = Object.entries(axes)
    .map(([key, axis]) => axis.poles[scores[key] <= 10 ? 0 : 1])
    .join("");
  // 各軸の得点範囲3〜18を百分率に換算。丸めた後も両側の合計を100%にする。
  const percentages = Object.fromEntries(Object.entries(axes).map(([key, axis]) => {
    const rightPercent = Math.round(((scores[key] - 3) / 15) * 100);
    return [key, {
      [axis.poles[0]]: 100 - rightPercent,
      [axis.poles[1]]: rightPercent
    }];
  }));
  return { typeCode, scores, percentages };
}

function readSavedResult(storage) {
  try {
    const record = JSON.parse(storage.getItem(resultStorageKey));
    if (!record || record.version !== resultStorageVersion) return null;
    return resultFromScores(record.scores);
  } catch {
    return null;
  }
}

function writeSavedResult(storage, result) {
  try {
    const { scores } = resultFromScores(result.scores);
    storage.setItem(resultStorageKey, JSON.stringify({ version: resultStorageVersion, scores }));
    return true;
  } catch {
    return false;
  }
}

function removeSavedResult(storage) {
  try {
    storage.removeItem(resultStorageKey);
    return true;
  } catch {
    return false;
  }
}

function initializeApp() {
  const byId = (id) => document.getElementById(id);
  let storage;
  try { storage = window.localStorage; } catch { /* 保存を拒否するブラウザでも診断を継続する。 */ }
  const state = { questionIndex: 0, answers: Array(questions.length).fill(null), savedResult: readSavedResult(storage) };
  const screens = ["start-screen", "question-screen", "interest-screen", "result-screen"];
  const nextButton = byId("next-button");
  const startButton = byId("start-button");
  const aboutDialog = byId("about-dialog");
  const deleteDialog = byId("delete-result-dialog");
  const collector = window.createDiagnosisCollector(window.diagnosisConfig?.collectionUrl, storage, updateCollection);
  let displayedType = null;
  let pendingResult = null;
  if (collector.enabled) {
    byId("collection-notice").hidden = false;
    byId("collection-privacy").textContent = "診断完了時にタイプを，参加意向への回答時にその選択を，主催者の非公開Googleスプレッドシートに保存します。氏名・メールアドレス・個々の回答・軸の得点は送信しません。重複防止用のランダムな識別子と更新番号を使用します。同じブラウザでは最新の内容に更新しますが，別端末等の重複を完全には防げないため，実人数ではなく集計件数として扱います。個別データや集計値を本サイトで公開することはありません。タイプ別の集計結果は会場で紹介予定です。端末内の保存結果を削除しても，送信済みの記録や集計用の識別子・送信状態は削除されません。";
  }

  function updateCollection(status) {
    byId("collection-status").hidden = !collector.enabled || !status.message;
    byId("collection-status").textContent = status.message;
    byId("collection-status").classList.toggle("is-error", status.error);
    byId("collection-retry").hidden = !status.retry;
    document.querySelectorAll("[data-interest]").forEach((button) => {
      button.disabled = status.busy;
      button.setAttribute("aria-pressed", String(button.dataset.interest === status.intent));
    });
  }
  document.querySelectorAll("[data-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!pendingResult) return;
      const pending = pendingResult;
      pendingResult = null;
      collector.choose(pending.result.typeCode, button.dataset.interest);
      renderResult(pending.result, pending.saved, false);
    });
  });
  byId("collection-retry").addEventListener("click", () => collector.retry());

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

  function renderResult(result, saved, completed = false) {
    displayedType = result.typeCode;
    const type = researcherTypes[result.typeCode];
    byId("result-code").textContent = type.typeCode;
    byId("result-title").textContent = type.titleJa;
    byId("result-image").alt = type.animalName + "の研究者キャラクター";
    byId("result-image").src = type.imagePath;
    byId("result-description").textContent = type.description || "";
    byId("result-catch").textContent = type.shortCatch || "";
    byId("result-catch").hidden = !type.shortCatch;
    const rows = Object.entries(axes).map(([key, axis], index) => {
      const selectedPole = type["axis" + (index + 1)];
      const row = element("div", "axis-row");
      row.append(element("dt", "axis-label", axis.label));
      const values = element("dd", "axis-values");
      const poles = element("div", "axis-poles");
      axis.poles.forEach((pole) => {
        const selected = pole === selectedPole;
        const name = element("span", "axis-pole" + (selected ? " is-selected" : ""));
        const code = element("b", "axis-code", pole);
        code.setAttribute("aria-hidden", "true");
        name.append(code, element("span", "", axis.names[pole]));
        name.append(element("b", "axis-percent", result.percentages[key][pole] + "%"));
        if (selected) name.append(element("span", "visually-hidden", "寄り"));
        poles.append(name);
      });
      const bar = element("div", "axis-bar");
      bar.setAttribute("aria-hidden", "true");
      const leftPercent = result.percentages[key][axis.poles[0]];
      const rightPercent = result.percentages[key][axis.poles[1]];
      const leftSegment = element("span", "axis-segment" + (axis.poles[0] === selectedPole ? " is-selected" : ""));
      leftSegment.style.width = (leftPercent / 2) + "%";
      leftSegment.style.left = "calc(50% - " + (leftPercent / 2) + "%)";
      const rightSegment = element("span", "axis-segment" + (axis.poles[1] === selectedPole ? " is-selected" : ""));
      rightSegment.style.width = (rightPercent / 2) + "%";
      rightSegment.style.left = "50%";
      bar.append(leftSegment, rightSegment);
      values.append(poles, bar);
      row.append(values);
      return row;
    });
    byId("result-axes").replaceChildren(...rows);
    byId("result-storage-status").textContent = saved
      ? "このブラウザに結果を保存しています。"
      : (state.savedResult ? "今回の結果を保存できませんでした。前回の保存結果は残っています。" : "結果を保存できませんでした。ページを閉じるとこの結果は失われます。");
    byId("result-storage-status").classList.toggle("is-error", !saved);
    byId("delete-result-button").hidden = !state.savedResult;
    byId("saved-result-button").hidden = !state.savedResult;
    document.title = type.titleJa + "（" + type.typeCode + "）| 研究者タイプ診断";
    showScreen("result-screen", "result-title");
    collector.result(result.typeCode, completed);
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
    if (reference.url) {
      const link = element("a", "reference-link", "論文の掲載ページ");
      link.href = reference.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = "新しいタブで開きます";
      item.append(link);
    }
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
      const result = calculateResult(state.answers);
      const saved = writeSavedResult(storage, result);
      if (saved) state.savedResult = result;
      pendingResult = { result, saved };
      byId("collection-status").hidden = true;
      byId("collection-retry").hidden = true;
      document.querySelectorAll("[data-interest]").forEach((button) => {
        button.disabled = false;
        button.setAttribute("aria-pressed", "false");
      });
      showScreen("interest-screen", "interest-title");
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

  byId("saved-result-button").addEventListener("click", () => {
    if (state.savedResult) renderResult(state.savedResult, true);
  });

  byId("delete-result-button").addEventListener("click", () => {
    deleteDialog.returnValue = "";
    deleteDialog.showModal();
    document.body.classList.add("dialog-open");
  });
  deleteDialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (deleteDialog.returnValue !== "delete") return;
    if (!removeSavedResult(storage)) {
      byId("result-storage-status").textContent = "保存結果を削除できませんでした。ブラウザの設定からサイトデータを削除してください。";
      byId("result-storage-status").classList.add("is-error");
      return;
    }
    state.savedResult = null;
    state.answers.fill(null);
    state.questionIndex = 0;
    byId("saved-result-button").hidden = true;
    startButton.textContent = "診断をはじめる";
    document.title = "研究者タイプ診断";
    showScreen("start-screen", "site-title");
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
  if (state.savedResult) renderResult(state.savedResult, true);
}

if (typeof document !== "undefined") initializeApp();
