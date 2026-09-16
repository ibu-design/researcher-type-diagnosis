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
      return url.origin === "https://script.google.com" && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)
        && !url.search && !url.hash && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  // JSONP avoids CORS and Apps Script's nested HTML-service iframe wrapper.
  function send(url, record) {
    return new Promise((resolve, reject) => {
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
      const callbackName = "__researcherDiagnosisSave_" + nonce;
      const script = document.createElement("script");
      const finish = (error, value) => {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
        if (error) reject(error); else resolve(value);
      };
      window[callbackName] = (data) => {
        if (!data || data.revision !== record.revision) {
          finish(new Error("save-failed"));
        } else if (data.ok === true) {
          finish(null, data);
        } else {
          finish(new Error(data.code === "closed" ? "closed" : "save-failed"));
        }
      };
      const timer = setTimeout(() => finish(new Error("timeout")), 25000);
      script.async = true;
      script.onerror = () => finish(new Error("network"));
      script.src = url + "?callback=" + callbackName + "&record=" + encodeURIComponent(JSON.stringify(record));
      document.body.append(script);
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
        notify("ブラウザに送信状態を保存できないため，集計用データは送信していません。", true);
        return false;
      }
    }

    function prepare(typeCode, intent) {
      if (!typePattern.test(typeCode)) return false;
      // Read again so another tab's completed write is not silently overwritten.
      const previous = read(storage) || record;
      try {
        return persist({ version: 1, id: previous?.id || crypto.randomUUID(), typeCode,
          intent: intent === undefined ? (previous?.intent ?? null) : intent,
          revision: (previous?.revision || 0) + 1, syncedRevision: previous?.syncedRevision || 0 });
      } catch {
        notify("このブラウザでは集計用データを送信できません。診断結果はご利用いただけます。", true);
        return false;
      }
    }

    async function sync() {
      if (!url || !record || busy || persistenceFailed || record.typeCode !== currentType) return;
      if (record.syncedRevision === record.revision) {
        notify(record.intent === null ? "診断タイプを集計用に保存しました。" : "参加意向を保存しました。ありがとうございます。");
        return;
      }
      busy = true;
      notify("集計用データを保存しています…");
      const snapshot = { id: record.id, typeCode: record.typeCode, intent: record.intent, revision: record.revision };
      try {
        await send(url, snapshot);
        if (record.revision === snapshot.revision) {
          const latest = read(storage);
          // Do not undo a newer local revision written in another tab.
          if (latest?.id === record.id && latest.revision === snapshot.revision) {
            const next = { ...record, syncedRevision: snapshot.revision };
            try { storage.setItem(key, JSON.stringify(next)); } catch { /* Resending the same revision is idempotent. */ }
            record = next;
          } else if (latest) record = latest;
        }
        busy = false;
        if (record.revision !== snapshot.revision) {
          if (record.typeCode === currentType) { sync(); return; }
          notify("別の診断結果が保存されています。ページを開き直してください。", true);
          return;
        }
        notify(record.intent === null ? "診断タイプを集計用に保存しました。" : "参加意向を保存しました。ありがとうございます。");
      } catch (error) {
        busy = false;
        notify(error.message === "closed" ? "現在，集計用データの受付を停止しています。" : "保存を確認できませんでした。通信状況を確認して，再試行してください。", true, error.message !== "closed");
      }
    }

    return {
      enabled: Boolean(url),
      result(typeCode, completed) {
        currentType = typeCode;
        if (!url) return;
        if (completed && !prepare(typeCode)) return;
        if (!record || record.typeCode !== typeCode) { notify("参加意向への回答は任意です。"); return; }
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
