const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../collection.js'), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '../backend/Code.gs'), 'utf8');
const url = 'https://script.google.com/macros/s/test-deployment/exec';
const id = 'd84b1000-354d-4221-9fb0-162cf81d521f';
const scores = { IC: 7, PE: 12, FA: 16 };
const plain = value => JSON.parse(JSON.stringify(value));
const result = (typeCode = 'IPF', values = scores) => ({ typeCode, scores: { ...values } });

function server() {
  const rows = [['timestamp', 'submissionId', 'typeCode', 'icScore', 'peScore', 'faScore', 'attendance']];
  const props = new Map([['ACCEPTING', 'true'], ['SPREADSHEET_ID', 'private']]);
  let locked = false;
  let released = 0;
  let flushFails = false;
  const sheet = {
    getLastRow: () => rows.length,
    getLastColumn: () => 7,
    getRange: (row, col, length, width) => ({
      createTextFinder: value => ({ matchEntireCell: () => ({ findNext: () => {
        const index = rows.findIndex((current, index) => index >= row - 1 && current[col - 1] === value);
        return index < 0 ? null : { getRow: () => index + 1 };
      } }) }),
      getValues: () => rows.slice(row - 1, row - 1 + length).map(current => current.slice()),
      setValues: values => { rows[row - 1] = plain(values[0]); },
      setValue: value => { rows[row - 1][col - 1] = value; }
    })
  };
  const spreadsheet = { getSheetByName: () => sheet, getSheets: () => [] };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => { released++; } }) },
    SpreadsheetApp: { openById: () => spreadsheet, flush: () => { if (flushFails) throw Error('unavailable'); } },
    ContentService: { createTextOutput: value => ({ value, setMimeType: () => ({ value }) }), MimeType: { JSON: 'json', JAVASCRIPT: 'javascript' } },
    Utilities: { formatDate: () => '' },
    console
  });
  vm.runInContext(backend, context);
  return {
    rows, props, context, save: record => plain(context.saveResponse(record)),
    lock: () => { locked = true; }, fail: () => { flushFails = true; }, releases: () => released
  };
}

test('server validates anonymous result fields and scores', () => {
  const s = server();
  const valid = { submissionId: id, typeCode: 'IPF', icScore: 7, peScore: 12, faScore: 16, attendance: null };
  assert.equal(s.save(valid).ok, true);
  for (const bad of [
    null, {}, { ...valid, email: 'private' }, { ...valid, typeCode: 'BAD' }, { ...valid, submissionId: 'x' },
    { ...valid, attendance: 'maybe' }, { ...valid, icScore: 2 }, { ...valid, peScore: 19 }, { ...valid, faScore: 1.5 }
  ]) assert.equal(s.save(bad).ok, false);
  assert.equal(s.rows.length, 2);
});

test('server deduplicates submissions and updates the result while preserving attendance', () => {
  const s = server();
  const first = { submissionId: id, typeCode: 'IPF', icScore: 7, peScore: 12, faScore: 16, attendance: null };
  assert.equal(s.save(first).ok, true);
  assert.equal(s.save(first).ok, true);
  assert.equal(s.rows.length, 2);
  assert.equal(s.save({ ...first, attendance: 'yes' }).ok, true);
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[1][6], 'yes');
  assert.equal(s.save({ ...first, typeCode: 'CEA', icScore: 12, peScore: 7, faScore: 4, attendance: null }).ok, true);
  assert.deepEqual(s.rows[1].slice(1), [id, 'CEA', 12, 7, 4, 'yes']);
});

test('server handles closure, lock contention, and write failures', () => {
  const record = { submissionId: id, typeCode: 'IPF', icScore: 7, peScore: 12, faScore: 16, attendance: null };
  const s = server();
  s.props.set('ACCEPTING', 'false');
  assert.equal(s.save(record).code, 'closed');
  s.props.set('ACCEPTING', 'true');
  s.fail();
  assert.throws(() => s.save(record));
  assert.equal(s.releases(), 1);
  s.lock();
  assert.equal(s.save(record).code, 'busy');
  assert.equal(s.releases(), 1);
});

test('server returns aggregate statistics without individual rows', () => {
  const s = server();
  s.save({ submissionId: id, typeCode: 'IPF', icScore: 7, peScore: 12, faScore: 16, attendance: null });
  s.save({ submissionId: 'd84b1000-354d-4221-9fb0-162cf81d5222', typeCode: 'CEA', icScore: 12, peScore: 7, faScore: 4, attendance: 'no' });
  const stats = s.context.buildStats_();
  assert.equal(stats.total, 2);
  assert.equal(stats.typeCounts.IPF, 1);
  assert.equal(stats.typeCounts.CEA, 1);
  assert.deepEqual(plain(stats.axisCounts), { I: 1, C: 1, P: 1, E: 1, F: 1, A: 1 });
  assert.equal(Object.hasOwn(stats, 'submissionId'), false);
});

test('server parses sendBeacon form bodies', () => {
  const s = server();
  const record = { submissionId: id, typeCode: 'IPF', icScore: 7, peScore: 12, faScore: 16, attendance: 'yes' };
  const body = 'mode=save&record=' + encodeURIComponent(JSON.stringify(record));
  assert.deepEqual(plain(s.context.parseRecord_({ postData: { contents: body } })), record);
});

function client(initial = null, deny = false) {
  const map = new Map(initial ? [['researcher-type-diagnosis:collection', JSON.stringify(initial)]] : []);
  const frames = [];
  const timers = new Set();
  const statuses = [];
  const storage = {
    getItem: key => map.get(key) || null,
    setItem: (key, value) => { if (deny) throw Error('denied'); map.set(key, value); }
  };
  const context = vm.createContext({
    window: {}, URL, crypto: webcrypto, navigator: {}, Blob: undefined,
    document: { createElement: () => ({ remove() { this.removed = true; } }), body: { append: frame => frames.push(frame) } },
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn)
  });
  vm.runInContext(source, context);
  const make = endpoint => context.window.createDiagnosisCollector(endpoint, storage, status => statuses.push(plain(status)));
  function ready(frame = frames.at(-1)) {
    const request = new URL(frame.src);
    return { payload: JSON.parse(request.searchParams.get('record')), complete: () => frame.onload() };
  }
  return { make, frames, statuses, ready, map, timers };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('unconfigured or untrusted endpoint never sends data', () => {
  const c = client();
  for (const value of ['', 'https://evil.example/exec', url + '?extra=1', url.replace('/exec', '/dev')]) {
    const app = c.make(value);
    assert.equal(app.enabled, false);
    app.result(result());
    app.choose('yes');
  }
  assert.equal(c.frames.length, 0);
});

test('client sends result fields, then updates the same submission with attendance', async () => {
  const c = client();
  const app = c.make(url);
  app.result(result());
  const first = c.ready();
  assert.deepEqual(Object.keys(first.payload).sort(), ['attendance', 'faScore', 'icScore', 'peScore', 'submissionId', 'typeCode']);
  assert.equal(first.payload.attendance, null);
  first.complete();
  await tick();
  assert.equal(c.statuses.at(-1).busy, false);
  app.choose('yes');
  const second = c.ready();
  assert.equal(second.payload.submissionId, first.payload.submissionId);
  assert.equal(second.payload.attendance, 'yes');
  second.complete();
  await tick();
  assert.equal(c.statuses.at(-1).attendance, 'yes');
});

test('a new diagnosis session keeps the browser anonymous ID and updates the same row', async () => {
  const c = client();
  const app = c.make(url);
  app.result(result());
  const first = c.ready();
  first.complete();
  await tick();
  app.choose('no');
  const second = c.ready();
  second.complete();
  await tick();
  app.newSession();
  app.result(result('CEA', { IC: 12, PE: 7, FA: 4 }));
  const third = c.ready();
  assert.equal(third.payload.submissionId, first.payload.submissionId);
  assert.equal(third.payload.typeCode, 'CEA');
  assert.equal(third.payload.attendance, 'no');
});

test('attendance selected while the result is sending is queued', async () => {
  const c = client();
  const app = c.make(url);
  app.result(result());
  app.choose('yes');
  assert.equal(c.frames.length, 1);
  c.ready().complete();
  await tick();
  assert.equal(c.frames.length, 2);
  assert.equal(c.ready().payload.attendance, 'yes');
});

test('storage denial does not silently send', () => {
  const c = client(null, true);
  c.make(url).result(result());
  assert.equal(c.frames.length, 0);
  assert.equal(c.statuses.at(-1).error, true);
});
