"use strict";

(() => {
  const key = "researcher-type-diagnosis:collection";
  const typePattern = /^(I|C)(P|E)(F|A)$/;
  const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function read(storage) {
    try {
      const value = JSON.parse(storage.getItem(key));
      if (!value || value.version !== 1 || !idPattern.test(value.id) ||
          !typePattern.test(value.typeCode) || ![null, "yes", "no"].includes(value.intent) ||
          !Number.isSafeInteger(value.revision) || value.revision < 1 || value.revision > 1000000000 ||
          !Number.isInteger(value.syncedRevision) || value.syncedRevision < 0 || value.syncedRevision > value.revision) return null;
      return { version: 1, id: value.id, typeCode: value.typeCode, intent: value.intent,
        revision: value.revision, syncedRevision: value.syncedRevision };
    } catch { return null; }
  }

  function endpoint(value) {
    try {
      const url = new URL(value);
      return url.origin === "https://script.google.com" && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) &&
        !url.search && !url.hash && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  function send(url, record) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.hidden = true;
      frame.title = "診断データの保存";
      frame.referrerPolicy = "no-referrer";
      const channel = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
      let receive;
      const finish = (error, value) => {
        clearTimeout(timer);
        window.removeEventListener("message", receive);
        frame.onload = null;
        frame.onerror = null;
        frame.remove();
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => finish(new Error("timeout")), 25000);
      receive = event => {
        const data = event.data;
        if (!data || data.kind !== "saved" || data.channel !== channel) return;
        if (data.ok !== true || data.revision !== record.revision) {
          finish(new Error(data.code === "closed" ? "closed" : "save-failed"));
          return;
        }
        finish(null, data);
      };
      window.addEventListener("message", receive);
      frame.onload = () => {};
      frame.onerror = () => finish(new Error("network"));
      frame.src = url + "?channel=" + channel + "&record=" + encodeURIComponent(JSON.stringify(record));
      document.body.append(frame);
    });
  }

  window.createDiagnosisCollector = (value, storage, onChange) => {
    const url = endpoint(value);
    let record = read(storage);
    let busy = false;
    let currentType = null;
    let persistenceFailed = false;

    function notify(message, error = false, retry = false) {
      onChange({ message, error, retry, busy,
        intent: record && record.typeCode === currentType ? record.intent : null });
    }

    function persist(next) {
      try {
        storage.setItem(key, JSON.stringify(next));
        record = next;
        persistenceFailed = false;
        return true;
      } catch {
        persistenceFailed = true;
        notify("この端末に診断データを保存できないため、送信できません。", true);
        return false;
      }
    }

    function prepare(typeCode, intent) {
      if (!typePattern.test(typeCode)) return false;
      const previous = read(storage) || record;
      try {
        return persist({ version: 1, id: previous?.id || crypto.randomUUID(), typeCode,
          intent: intent === undefined ? (previous?.intent ?? null) : intent,
          revision: (previous?.revision || 0) + 1, syncedRevision: previous?.syncedRevision || 0 });
      } catch {
        notify("このブラウザでは診断データを送信できません。診断結果はこの端末だけで利用できます。", true);
        return false;
      }
    }

    async function sync() {
      if (!url || !record || busy || persistenceFailed || record.typeCode !== currentType) return;
      if (record.syncedRevision === record.revision) {
        notify(record.intent === null ? "診断タイプを保存しました。" : "参加意向を保存しました。ありがとうございます。");
        return;
      }
      busy = true;
      notify("診断データを保存しています…");
      const snapshot = { id: record.id, typeCode: record.typeCode, intent: record.intent, revision: record.revision };
      try {
        await send(url, snapshot);
        if (record.revision === snapshot.revision) {
          const latest = read(storage);
          if (latest?.id === record.id && latest.revision === snapshot.revision) {
            const next = { ...record, syncedRevision: snapshot.revision };
            try { storage.setItem(key, JSON.stringify(next)); } catch { /* The server write is idempotent. */ }
            record = next;
          } else if (latest) record = latest;
        }
        busy = false;
        if (record.revision !== snapshot.revision) {
          if (record.typeCode === currentType) { sync(); return; }
          notify("別の診断結果が保存されています。ページを開き直してください。", true);
          return;
        }
        notify(record.intent === null ? "診断タイプを保存しました。" : "参加意向を保存しました。ありがとうございます。");
      } catch (error) {
        busy = false;
        notify(error.message === "closed" ? "現在、参加意向データの受付を停止しています。" :
          "保存を確認できませんでした。通信状況を確認して、再試行してください。", true, error.message !== "closed");
      }
    }

    return {
      enabled: Boolean(url),
      result(typeCode, completed) {
        currentType = typeCode;
        if (!url) return;
        if (completed && !prepare(typeCode)) return;
        if (!record || record.typeCode !== typeCode) { notify("参加意向への回答が必要です。"); return; }
        sync();
      },
      choose(typeCode, intent) {
        if (!url || busy || !["yes", "no"].includes(intent)) return;
        currentType = typeCode;
        if (record?.typeCode === typeCode && record.intent === intent && !persistenceFailed) { sync(); return; }
        if (prepare(typeCode, intent)) sync();
      },
      retry() { sync(); }
    };
  };
})();
