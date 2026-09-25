"use strict";

const typeMeta = [
  ["IPF", "フクロウ", "assets/images/フクロウ.png", "#2f7d73"],
  ["IPA", "キツツキ", "assets/images/キツツキ.png", "#d66f4d"],
  ["IEF", "タコ", "assets/images/タコ.png", "#d6a840"],
  ["IEA", "アライグマ", "assets/images/アライグマ.png", "#6686a6"],
  ["CPF", "ゾウ", "assets/images/ゾウ.png", "#936b9b"],
  ["CPA", "ビーバー", "assets/images/ビーバー.png", "#6d9b63"],
  ["CEF", "イルカ", "assets/images/イルカ.png", "#3b9db0"],
  ["CEA", "カワウソ", "assets/images/カワウソ.png", "#df8b4c"]
];

const axisMeta = [
  ["IC", "個人 / 協働", ["I", "C"]],
  ["PE", "計画 / 試行錯誤", ["P", "E"]],
  ["FA", "原理追究 / 社会応用", ["F", "A"]]
];

function percent(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function gradientFor(counts, keys, colors, total) {
  if (!total) return "conic-gradient(#d9dfdc 0 100%)";
  let start = 0;
  const parts = keys.map((key, index) => {
    const end = start + ((counts[key] || 0) / total) * 100;
    const part = colors[index] + " " + start + "% " + end + "%";
    start = end;
    return part;
  });
  return "conic-gradient(" + parts.join(", ") + ")";
}

function renderTypeStats(data) {
  const total = Number(data.total) || 0;
  const counts = data.typeCounts || {};
  const keys = typeMeta.map(item => item[0]);
  const colors = typeMeta.map(item => item[3]);
  const donut = document.getElementById("type-donut");
  donut.style.background = gradientFor(counts, keys, colors, total);
  document.getElementById("type-donut-total").textContent = total;
  const legend = document.getElementById("type-legend");
  legend.replaceChildren(...typeMeta.map(([code, name, image, color]) => {
    const item = document.createElement("article");
    item.className = "type-item";
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.width = 52;
    img.height = 64;
    const details = document.createElement("div");
    details.className = "type-item-details";
    const heading = document.createElement("h3");
    heading.innerHTML = '<span class="type-dot" style="background:' + color + '"></span>' + code + "｜" + name;
    const value = document.createElement("p");
    value.textContent = (counts[code] || 0) + "人　" + percent(counts[code] || 0, total) + "%";
    details.append(heading, value);
    item.append(img, details);
    return item;
  }));
}

function renderAxisStats(data) {
  const total = Number(data.total) || 0;
  const counts = data.axisCounts || {};
  const grid = document.getElementById("axis-grid");
  grid.replaceChildren(...axisMeta.map(([code, label, keys]) => {
    const card = document.createElement("article");
    card.className = "axis-card";
    const title = document.createElement("h3");
    title.textContent = label;
    const chart = document.createElement("div");
    chart.className = "axis-chart";
    chart.style.background = gradientFor(counts, keys, ["#2f7d73", "#e09252"], total * 1);
    const hole = document.createElement("div");
    hole.className = "axis-chart-hole";
    hole.textContent = total + "人";
    chart.append(hole);
    const values = document.createElement("p");
    values.className = "axis-values";
    values.textContent = keys[0] + " " + percent(counts[keys[0]] || 0, total) + "%　/　" + keys[1] + " " + percent(counts[keys[1]] || 0, total) + "%";
    card.append(title, chart, values);
    return card;
  }));
}

function renderStats(data) {
  renderTypeStats(data);
  renderAxisStats(data);
  document.getElementById("total-count").textContent = Number(data.total) || 0;
  document.getElementById("updated-at").textContent = data.updatedAt
    ? "最終更新 " + new Date(data.updatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "更新時刻を取得できません";
  document.getElementById("stats-status").textContent = "統計データを自動更新しています。";
}

function requestStats() {
  const endpoint = window.diagnosisConfig?.statsUrl;
  if (!endpoint) {
    document.getElementById("stats-status").textContent = "統計APIのURLがまだ設定されていません。";
    return;
  }
  const callback = "__researcherStats_" + Date.now();
  const script = document.createElement("script");
  const cleanup = () => { delete window[callback]; script.remove(); };
  window[callback] = data => { cleanup(); renderStats(data); };
  script.onerror = () => { cleanup(); document.getElementById("stats-status").textContent = "統計データを取得できませんでした。"; };
  script.src = endpoint + (endpoint.includes("?") ? "&" : "?") + "mode=stats&callback=" + callback + "&t=" + Date.now();
  document.body.append(script);
}

requestStats();
setInterval(requestStats, Math.max(1000, Number(window.diagnosisConfig?.statsPollMs) || 5000));
