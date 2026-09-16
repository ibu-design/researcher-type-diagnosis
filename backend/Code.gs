"use strict";

const SHEET_NAME = "responses";
const TYPE_CODES = ["IPF", "IPA", "IEF", "IEA", "CPF", "CPA", "CEF", "CEA"];

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
    sheet.getRange(1, 1, 1, 4).setValues([["record_id", "type_code", "attendance", "revision"]]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#eef6f3");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 320);
    sheet.setColumnWidths(2, 3, 140);
    id = spreadsheet.getId();
    properties.setProperties({ SPREADSHEET_ID: id, ACCEPTING: "true" });
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
    Object.keys(record).sort().join(",") === "id,intent,revision,typeCode" &&
    typeof record.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.id) &&
    TYPE_CODES.indexOf(record.typeCode) !== -1 && [null, "yes", "no"].indexOf(record.intent) !== -1 &&
    Number.isInteger(record.revision) && record.revision >= 1 && record.revision <= 1000000000;
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
    const lastRow = sheet.getLastRow();
    const cell = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(record.id).matchEntireCell(true).findNext() : null;
    const values = [record.id, record.typeCode, record.intent === null ? "" : record.intent, record.revision];
    if (cell) {
      const range = sheet.getRange(cell.getRow(), 1, 1, 4);
      const old = range.getValues()[0];
      if (old[3] > record.revision || (old[3] === record.revision && (old[1] !== values[1] || old[2] !== values[2]))) return { ok: false, code: "conflict" };
      if (old[3] < record.revision) range.setValues([values]);
    } else {
      if (lastRow >= 50001) return { ok: false, code: "capacity" };
      sheet.getRange(lastRow + 1, 1, 1, 4).setValues([values]);
    }
    SpreadsheetApp.flush();
    return { ok: true, revision: record.revision };
  } finally {
    lock.releaseLock();
  }
}
