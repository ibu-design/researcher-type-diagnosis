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
const plain = x => JSON.parse(JSON.stringify(x));

function server() {
  const rows = [['record_id', 'type_code', 'attendance', 'revision']];
  const props = new Map([['ACCEPTING', 'true'], ['SPREADSHEET_ID', 'private']]);
  let locked = false;
  let released = 0;
  let flushFails = false;
  const sheet = {
    getLastRow: () => rows.length,
    getRange: (row, col, length, width) => ({
      createTextFinder: value => ({ matchEntireCell: () => ({ findNext: () => {
        const index = rows.findIndex((r, i) => i >= row - 1 && r[0] === value);
        return index < 0 ? null : { getRow: () => index + 1 };
      } }) }),
      getValues: () => [rows[row - 1].slice()],
      setValues: values => { rows[row - 1] = plain(values[0]); }
    })
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => { released++; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush: () => { if (flushFails) throw Error('unavailable'); } }
  });
  vm.runInContext(backend, context);
  return { rows, props, context, save: record => plain(context.saveResponse(record)),
    lock: () => { locked = true; }, fail: () => { flushFails = true; }, releases: () => released };
}

test('server accepts only the four fields and the eight types, never formulas or extra personal data', () => {
  const s = server();
  for (const typeCode of ['IPF','IPA','IEF','IEA','CPF','CPA','CEF','CEA']) {
    assert.equal(s.save({id, typeCode, intent: null, revision: s.rows[1]?.[3] + 1 || 1}).ok, true);
  }
  const valid = {id, typeCode:'IPF', intent:'yes', revision:20};
  for (const bad of [null, {}, {...valid,email:'private'}, {...valid,typeCode:'=IMPORTXML("x")'}, {...valid,id:'x'},
    {...valid,intent:'maybe'}, {...valid,revision:0}, {...valid,revision:1.5}, {...valid,revision:1000000001}]) {
    assert.equal(s.save(bad).ok, false);
  }
  assert.equal(s.rows.length, 2);
});

test('server deduplicates retries, updates the same row, rejects stale or conflicting writes', () => {
  const s = server();
  const first = { id, typeCode:'IPF', intent:null, revision:1 };
  assert.equal(s.save(first).ok, true);
  assert.equal(s.save(first).ok, true);
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[1][2], '');
  assert.equal(s.save({...first,intent:'yes',revision:2}).ok, true);
  assert.equal(s.save({...first,typeCode:'CEA',intent:'no',revision:3}).ok, true);
  assert.equal(s.save(first).code, 'conflict');
  assert.equal(s.save({...first,revision:3}).code, 'conflict');
  assert.deepEqual(s.rows[1], [id,'CEA','no',3]);
});

test('server handles closure and lock contention, always releases its acquired lock', () => {
  const record = {id,typeCode:'IPF',intent:null,revision:1};
  const s = server();
  s.props.set('ACCEPTING','false');
  assert.equal(s.save(record).code, 'closed');
  s.props.set('ACCEPTING','true');
  s.fail();
  assert.throws(() => s.save(record));
  assert.equal(s.releases(), 1);
  s.lock();
  assert.equal(s.save(record).code, 'busy');
  assert.equal(s.releases(), 1);
});

function client(initial = null, deny = false) {
  const map = new Map(initial ? [['researcher-type-diagnosis:collection', JSON.stringify(initial)]] : []);
  const frames = [];
  const timers = new Set();
  const statuses = [];
  const window = {};
  const storage = {
    getItem: key => map.get(key) || null,
    setItem: (key, value) => { if (deny) throw Error('denied'); map.set(key,value); }
  };
  const context = vm.createContext({window, URL, crypto:webcrypto,
    document:{createElement:() => ({remove(){this.removed=true;}}),body:{append:frame=>frames.push(frame)}},
    setTimeout: fn => {timers.add(fn);return fn;}, clearTimeout: fn => timers.delete(fn)
  });
  vm.runInContext(source,context);
  const make = endpoint => window.createDiagnosisCollector(endpoint,storage,s=>statuses.push(plain(s)));
  function ready(frame = frames.at(-1)) {
    const request = new URL(frame.src);
    const payload = JSON.parse(request.searchParams.get('record'));
    return {payload, ack: (ok=true,code) => {
      if (ok) frame.onload(); else frame.onerror();
    }};
  }
  return {make,frames,statuses,ready,map,timers};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));

test('unconfigured or untrusted endpoint never sends data', () => {
  const c = client();
  for (const value of ['', 'https://evil.example/exec', url+'?extra=1',url.replace('/exec','/dev')]) {
    const app=c.make(value);
    assert.equal(app.enabled,false);
    app.result('IPF',true);
    app.choose('IPF','yes');
  }
  assert.equal(c.frames.length,0);
});

test('client sends minimum fields, waits for load acknowledgement, changes and restores intent', async () => {
  const c = client();
  const app = c.make(url);
  app.result('IPF',true);
  assert.equal(c.statuses.at(-1).busy,true);
  const first=c.ready();
  assert.deepEqual(Object.keys(first.payload).sort(),['id','intent','revision','typeCode']);
  assert.equal(first.payload.intent,null);
  first.ack(); await tick();
  assert.equal(c.statuses.at(-1).busy,false);
  app.choose('IPF','yes');
  const second=c.ready();
  assert.equal(second.payload.id,first.payload.id);
  assert.equal(second.payload.revision,2);
  second.ack(); await tick();
  assert.equal(c.statuses.at(-1).intent,'yes');
  app.choose('IPF','yes');
  assert.equal(c.frames.length,2);
  const restored=c.make(url);
  restored.result('IPF',false);
  assert.equal(c.frames.length,2);
  restored.choose('IPF','no');
  const third=c.ready(); third.ack(); await tick();
  assert.equal(c.statuses.at(-1).intent,'no');
});

test('failed send preserves pending revision for an idempotent retry', async () => {
  const c=client(); const app=c.make(url);
  app.result('CEA',true);
  const first=c.ready(); first.ack(false); await tick();
  assert.equal(c.statuses.at(-1).retry,true);
  app.retry();
  const retry=c.ready();
  assert.deepEqual(retry.payload,first.payload);
  retry.ack(); await tick();
  assert.equal(c.statuses.at(-1).error,false);
});

test('storage denial, old results, and malformed saved records do not silently send', () => {
  const c=client(null,true); c.make(url).result('IPF',true);
  assert.equal(c.frames.length,0);
  assert.equal(c.statuses.at(-1).error,true);
  const old=client(); old.make(url).result('IPF',false);
  assert.equal(old.frames.length,0);
  const corrupt=client({version:1,id,typeCode:'IPF',intent:'yes',revision:-1,syncedRevision:0});
  corrupt.make(url).result('IPF',false);
  assert.equal(corrupt.frames.length,0);
});

test('a new completed result during a request is sent after the first acknowledgement', async () => {
  const c=client(); const app=c.make(url);
  app.result('IPF',true); const first=c.ready();
  app.result('CEA',true); first.ack(); await tick();
  assert.equal(c.frames.length,2);
  const second=c.ready();
  assert.equal(second.payload.typeCode,'CEA');
  second.ack(); await tick();
  assert.equal(c.statuses.at(-1).error,false);
});
