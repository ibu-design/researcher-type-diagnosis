"use strict";

const SHEET_NAME = "responses";
const TYPE_CODES = ["IPF", "IPA", "IEF", "IEA", "CPF", "CPA", "CEF", "CEA"];
const HEADERS = ["timestamp", "submissionId", "typeCode", "icScore", "peScore", "faScore", "attendance"];

function setupStorage() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) throw new Error("Owner only");
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty("SPREADSHEET_ID");
  if (!id) {
    const spreadsheet = SpreadsheetApp.create("Researcher Type Diagnosis - Private Responses");
    id = spreadsheet.getId();
    properties.setProperties({ SPREADSHEET_ID: id, ACCEPTING: "true" });
  }
  const sheet = ensureSheet_(SpreadsheetApp.openById(id));
  properties.setProperty("ACCEPTING", "true");
  console.log("https://docs.google.com/spreadsheets/d/" + id + "/edit");
  console.log("Sheet: " + sheet.getName());
}

function doGet(event) {
  const params = event && event.parameter || {};
  if (params.mode === "stats") return statsResponse_(params.callback);
  if (params.mode === "save" || typeof params.record === "string") {
    return saveResponseOutput_(parseRecord_(event));
  }
  return HtmlService.createHtmlOutput("This endpoint accepts diagnosis responses and aggregate statistics.");
}

function doPost(event) {
  return saveResponseOutput_(parseRecord_(event));
}

function parseRecord_(event) {
  const params = event && event.parameter || {};
  let raw = params.record;
  if (typeof raw !== "string" && event && event.postData && typeof event.postData.contents === "string") {
    const body = event.postData.contents;
    if (body.trim().indexOf("{") === 0) {
      raw = body;
    } else {
      const match = body.match(/(?:^|&)record=([^&]*)/);
      raw = match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
    }
  }
  try { return JSON.parse(raw || ""); } catch { return null; }
}

function saveResponseOutput_(record) {
  let result;
  try { result = saveResponse(record); } catch (error) {
    console.error(error);
    result = { ok: false, code: "error" };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function validRecord_(record) {
  return record && typeof record === "object" && !Array.isArray(record) &&
    Object.keys(record).sort().join(",") === "attendance,faScore,icScore,peScore,submissionId,typeCode" &&
    typeof record.submissionId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.submissionId) &&
    TYPE_CODES.indexOf(record.typeCode) !== -1 &&
    ["yes", "no", null].indexOf(record.attendance) !== -1 &&
    Number.isInteger(record.icScore) && record.icScore >= 3 && record.icScore <= 18 &&
    Number.isInteger(record.peScore) && record.peScore >= 3 && record.peScore <= 18 &&
    Number.isInteger(record.faScore) && record.faScore >= 3 && record.faScore <= 18;
}

function ensureSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  let initializedEmpty = false;
  if (!sheet && typeof spreadsheet.getSheets === "function") {
    const sheets = spreadsheet.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName(SHEET_NAME);
      initializedEmpty = true;
    }
  }
  if (!initializedEmpty) {
    if (sheet) {
      const columns = Math.max(sheet.getLastColumn(), HEADERS.length);
      const header = sheet.getRange(1, 1, 1, columns).getValues()[0];
      if (header.slice(0, HEADERS.length).join("|") === HEADERS.join("|")) return sheet;
      sheet.setName(SHEET_NAME + "_legacy_" + new Date().getTime());
    }
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#eef6f3");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 320);
  sheet.setColumnWidths(3, 5, 120);
  return sheet;
}

function saveResponse(record) {
  if (!validRecord_(record)) return { ok: false, code: "invalid" };
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("ACCEPTING") !== "true") return { ok: false, code: "closed" };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, code: "busy" };
  try {
    const sheet = ensureSheet_(SpreadsheetApp.openById(properties.getProperty("SPREADSHEET_ID")));
    const lastRow = sheet.getLastRow();
    const cell = lastRow > 1 ? sheet.getRange(2, 2, lastRow - 1, 1).createTextFinder(record.submissionId).matchEntireCell(true).findNext() : null;
    if (cell) {
      const row = cell.getRow();
      const old = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      const attendance = record.attendance === null ? old[6] : record.attendance;
      sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
        old[0], record.submissionId, record.typeCode, record.icScore, record.peScore, record.faScore, attendance || ""
      ]]);
    } else {
      if (lastRow >= 50001) return { ok: false, code: "capacity" };
      sheet.getRange(lastRow + 1, 1, 1, HEADERS.length).setValues([[
        new Date(), record.submissionId, record.typeCode, record.icScore, record.peScore, record.faScore,
        record.attendance === null ? "" : record.attendance
      ]]);
    }
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function statsResponse_(callback) {
  const stats = buildStats_();
  const json = JSON.stringify(stats).replace(/</g, "\\u003c");
  if (!callback || !/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(callback + "(" + json + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function buildStats_() {
  const typeCounts = Object.fromEntries(TYPE_CODES.map(code => [code, 0]));
  const axisCounts = { I: 0, C: 0, P: 0, E: 0, F: 0, A: 0 };
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty("SPREADSHEET_ID");
  if (!id || properties.getProperty("ACCEPTING") !== "true") return { total: 0, typeCounts, axisCounts, updatedAt: new Date().toISOString() };
  const spreadsheet = SpreadsheetApp.openById(id);
  const current = ensureSheet_(spreadsheet);
  const seenIds = new Set();
  let total = 0;

  function addType_(typeCode, recordId) {
    if (TYPE_CODES.indexOf(typeCode) === -1 || (recordId && seenIds.has(recordId))) return;
    if (recordId) seenIds.add(recordId);
    typeCounts[typeCode] += 1;
    axisCounts[typeCode[0]] += 1;
    axisCounts[typeCode[1]] += 1;
    axisCounts[typeCode[2]] += 1;
    total += 1;
  }

  const rows = current.getLastRow() > 1 ? current.getRange(2, 1, current.getLastRow() - 1, HEADERS.length).getValues() : [];
  rows.forEach(row => addType_(row[2], String(row[1] || "")));

  // Keep earlier anonymous responses visible after the schema migration.
  spreadsheet.getSheets().forEach(sheet => {
    if (!/^responses_legacy_/.test(sheet.getName()) || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    const header = values[0].map(value => String(value).trim());
    const typeIndex = header.indexOf("type_code");
    const idIndex = header.indexOf("record_id");
    if (typeIndex === -1) return;
    values.slice(1).forEach(row => addType_(String(row[typeIndex] || "").trim(), idIndex === -1 ? "" : String(row[idIndex] || "").trim()));
  });

  return { total, typeCounts, axisCounts, updatedAt: new Date().toISOString() };
}
