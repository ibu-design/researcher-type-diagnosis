"use strict";

(() => {
  const key = "researcher-type-diagnosis:collection";
  const typePattern = /^(I|C)(P|E)(F|A)$/;
  const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const scoreKeys = ["IC", "PE", "FA"];

  function validScores(scores) {
    return scores && scoreKeys.every((key) => Number.isInteger(scores[key]) && scores[key] >= 3 && scores[key] <= 18);
  }

  function read(storage) {
    try {
      const value = JSON.parse(storage.getItem(key));
      if (!value || value.version !== 2 || !idPattern.test(value.submissionId) || !typePattern.test(value.typeCode) ||
          !validScores(value.scores) || ![null, "yes", "no"].includes(value.attendance) ||
          !Number.isSafeInteger(value.revision) || value.revision < 1 || value.revision > 1000000000 ||
          !Number.isInteger(value.syncedRevision) || value.syncedRevision < 0 || value.syncedRevision > value.revision) return null;
      return {
        version: 2,
        submissionId: value.submissionId,
        typeCode: value.typeCode,
        scores: { IC: value.scores.IC, PE: value.scores.PE, FA: value.scores.FA },
        attendance: value.attendance,
        revision: value.revision,
        syncedRevision: value.syncedRevision
      };
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
    const payload = JSON.stringify({
      submissionId: record.submissionId,
      typeCode: record.typeCode,
      icScore: record.scores.IC,
      peScore: record.scores.PE,
      faScore: record.scores.FA,
      attendance: record.attendance
    });
    const body = "mode=save&record=" + encodeURIComponent(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon && typeof Blob !== "undefined") {
      const accepted = navigator.sendBeacon(url, new Blob([body], { type: "application/x-www-form-urlencoded;charset=UTF-8" }));
      if (accepted) return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.hidden = true;
      frame.title = "診断データの送信";
      frame.referrerPolicy = "no-referrer";
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        frame.onload = null;
        frame.onerror = null;
        frame.remove();
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(new Error("timeout")), 15000);
      frame.onload = () => finish();
      frame.onerror = () => finish(new Error("network"));
      frame.src = url + "?mode=save&record=" + encodeURIComponent(payload);
      document.body.append(frame);
    });
  }

  window.createDiagnosisCollector = (value, storage, onChange) => {
    const url = endpoint(value);
    let record = read(storage);
    let busy = false;
    let persistenceFailed = false;
    let forceNewSession = false;

    function notify(message, error = false, retry = false) {
      onChange({ message, error, retry, busy, attendance: record?.attendance ?? null });
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

    function sync() {
      if (!url || !record || busy || persistenceFailed) return;
      if (record.syncedRevision === record.revision) {
        notify(record.attendance === null ? "診断結果を送信しました。" : "参加意向を保存しました。ありがとうございます。");
        return;
      }
      busy = true;
      notify("診断データを送信しています…");
      const snapshotRevision = record.revision;
      send(url, record).then(() => {
        const latest = read(storage);
        if (latest?.submissionId === record.submissionId && latest.revision === snapshotRevision) {
          record = { ...latest, syncedRevision: latest.revision };
          try { storage.setItem(key, JSON.stringify(record)); } catch { /* The next attempt remains idempotent. */ }
        } else if (latest?.submissionId === record.submissionId && latest.revision >= record.revision) {
          record = latest;
        }
        busy = false;
        if (record.syncedRevision !== record.revision) { sync(); return; }
        notify(record.attendance === null ? "診断結果を送信しました。" : "参加意向を保存しました。ありがとうございます。");
      }).catch((error) => {
        busy = false;
        if (record.revision !== snapshotRevision) { sync(); return; }
        notify(error.message === "timeout" ? "送信を確認できませんでした。再試行してください。" :
          "保存を確認できませんでした。通信状況を確認して、再試行してください。", true, true);
      });
    }

    return {
      enabled: Boolean(url),
      result(result) {
        if (!url || !result || !typePattern.test(result.typeCode) || !validScores(result.scores)) return;
        const sameResult = !forceNewSession && record && record.typeCode === result.typeCode &&
          scoreKeys.every((key) => record.scores[key] === result.scores[key]);
        const next = sameResult ? {
          ...record,
          revision: record.revision + 1,
          syncedRevision: 0
        } : {
          version: 2,
          submissionId: crypto.randomUUID(),
          typeCode: result.typeCode,
          scores: { IC: result.scores.IC, PE: result.scores.PE, FA: result.scores.FA },
          attendance: null,
          revision: 1,
          syncedRevision: 0
        };
        forceNewSession = false;
        if (persist(next)) sync();
      },
      choose(attendance) {
        if (!url || !record || !["yes", "no"].includes(attendance)) return;
        if (record.attendance === attendance && !persistenceFailed) { sync(); return; }
        if (persist({ ...record, attendance, revision: record.revision + 1, syncedRevision: 0 })) sync();
      },
      newSession() { forceNewSession = true; },
      retry() { sync(); }
    };
  };
})();
