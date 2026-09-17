"use strict";

const SHEET_NAME = "responses";
const TYPE_CODES = ["IPF", "IPA", "IEF", "IEA", "CPF", "CPA", "CEF", "CEA"];
const ANIMAL_NAMES = {
  IPF: "フクロウ", IPA: "キツツキ", IEF: "タコ", IEA: "アライグマ",
  CPF: "ゾウ", CPA: "ビーバー", CEF: "イルカ", CEA: "カワウソ"
};
const HEADERS = ["record_id", "completed_at", "type_code", "animal_name", "attendance", "revision"];

// Run once in the editor as the owner. This never changes sharing permissions.
function setupStorage() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) throw new Error("Owner only");
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty("SPREADSHEET_ID");
  if (!id) {
    const spreadsheet = SpreadsheetApp.create("Researcher Type Diagnosis - Private Responses");
    const sheet = spreadsheet.getSheets()[0];
    sheet.setName(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#eef6f3");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 320);
    sheet.setColumnWidths(2, 5, 140);
    id = spreadsheet.getId();
    properties.setProperties({ SPREADSHEET_ID: id, ACCEPTING: "true" });
  } else {
    migrateSheet_(SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME));
  }
  console.log("https://docs.google.com/spreadsheets/d/" + id + "/edit");
}

function doGet(event) {
  const params = event && event.parameter || {};
  if (typeof params.record !== "string") {
    return HtmlService.createHtmlOutput("This endpoint accepts responses from the diagnosis site.");
  }
  let record = null;
  let result;
  try {
    record = JSON.parse(params.record || "");
    result = saveResponse(record);
  } catch (error) {
    console.error(error);
    result = { ok: false, code: "error" };
  }
  const payload = {
    kind: "saved",
    channel: typeof params.channel === "string" ? params.channel : null,
    ok: result.ok === true,
    revision: record && record.revision,
    code: result.code || "error"
  };
  const message = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>' +
    'window.top.postMessage(' + message + ', "*");' +
    '</script></body></html>';
  return HtmlService.createHtmlOutput(html);
}

function validRecord_(record) {
  return record && typeof record === "object" && !Array.isArray(record) &&
    Object.keys(record).sort().join(",") === "animalName,completedAt,id,intent,revision,typeCode" &&
    typeof record.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.id) &&
    TYPE_CODES.indexOf(record.typeCode) !== -1 && record.animalName === ANIMAL_NAMES[record.typeCode] &&
    typeof record.completedAt === "string" && !isNaN(Date.parse(record.completedAt)) &&
    [null, "yes", "no"].indexOf(record.intent) !== -1 &&
    Number.isInteger(record.revision) && record.revision >= 1 && record.revision <= 1000000000;
}

function migrateSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const header = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  if (header.slice(0, HEADERS.length).join("|") === HEADERS.join("|")) return;
  const oldRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, Math.min(lastColumn, 4)).getValues() : [];
  const rows = [HEADERS].concat(oldRows.map(row => [row[0] || "", "", row[1] || "", "", row[2] || "", row[3] || ""]));
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#eef6f3");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 320);
  sheet.setColumnWidths(2, 5, 140);
}

// No public read/list/aggregate endpoint. Only the holder of a random ID can update its row.
function saveResponse(record) {
  if (!validRecord_(record)) return { ok: false, code: "invalid" };
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("ACCEPTING") !== "true") return { ok: false, code: "closed" };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return { ok: false, code: "busy" };
  try {
    const sheet = SpreadsheetApp.openById(properties.getProperty("SPREADSHEET_ID")).getSheetByName(SHEET_NAME);
    migrateSheet_(sheet);
    const lastRow = sheet.getLastRow();
    const cell = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(record.id).matchEntireCell(true).findNext() : null;
    const values = [record.id, record.completedAt, record.typeCode, record.animalName,
      record.intent === null ? "" : record.intent, record.revision];
    if (cell) {
      const range = sheet.getRange(cell.getRow(), 1, 1, HEADERS.length);
      const old = range.getValues()[0];
      if (old[5] > record.revision || (old[5] === record.revision && (old[2] !== values[2] || old[3] !== values[3] || old[4] !== values[4]))) return { ok: false, code: "conflict" };
      if (old[5] < record.revision) range.setValues([values]);
    } else {
      if (lastRow >= 50001) return { ok: false, code: "capacity" };
      sheet.getRange(lastRow + 1, 1, 1, HEADERS.length).setValues([values]);
    }
    SpreadsheetApp.flush();
    return { ok: true, revision: record.revision };
  } finally {
    lock.releaseLock();
  }
}
