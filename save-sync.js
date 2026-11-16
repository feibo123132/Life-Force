"use strict";

function createForestSaveSync({
  legacyKey, storage, onChange, onStatus,
  online = () => navigator.onLine, visible = () => !document.hidden,
  schedule = callback => setTimeout(callback, 400),
}) {
  const ownerKey = legacyKey + ":legacy-owner";
  const guestKey = legacyKey + ":guest";
  let session;
  let seen;
  let queued = false;

  function key() {
    return session?.key ?? (storage.getItem(ownerKey) ? guestKey : legacyKey);
  }

  function read() {
    seen = storage.getItem(key());
    const saved = JSON.parse(seen);
    return session ? saved?.snapshot ?? null : saved;
  }

  function save(record) {
    const raw = JSON.stringify(record);
    storage.setItem(key(), raw);
    seen = raw;
  }

  function queueSync() {
    if (queued) return;
    queued = true;
    schedule(() => {
      queued = false;
      void sync();
    });
  }

  function write(snapshot) {
    const raw = storage.getItem(key());
    const record = session && JSON.parse(raw);
    // An upload acknowledgement in another tab can change the revision alone.
    const sameSnapshot = session && JSON.stringify(record?.snapshot) === JSON.stringify(JSON.parse(seen)?.snapshot);
    if (raw !== seen && !sameSnapshot) {
      queueMicrotask(onChange);
      throw new Error("Local save changed in another tab");
    }
    if (!session) {
      save(snapshot);
      return;
    }
    const revision = record?.revision ?? 0;
    save({ revision, snapshot, writeId: crypto.randomUUID() });
    onStatus(session.conflict ? "conflict" : "pending");
    queueSync();
  }

  function connect(uid, request) {
    if ((session?.uid ?? "") === (uid ?? "")) return;
    session = uid ? { uid, key: legacyKey + ":account:" + encodeURIComponent(uid), request } : undefined;
    if (session) {
      try {
        const owner = storage.getItem(ownerKey);
        let record = JSON.parse(storage.getItem(session.key));
        if (!record && !owner) {
          const legacy = JSON.parse(storage.getItem(legacyKey));
          if (Array.isArray(legacy?.entries) && Array.isArray(legacy.trees)) {
            record = { revision: 0, snapshot: legacy, writeId: crypto.randomUUID() };
            save(record);
            storage.setItem(ownerKey, uid);
          }
        }
        session.ready = Boolean(record?.snapshot);
      } catch {
        onChange();
        onStatus("storage");
        return;
      }
    }
    onChange();
    onStatus(session ? "connecting" : "guest");
  }

  function storageChanged(changedKey) {
    try {
      if (changedKey !== key() && changedKey !== ownerKey && changedKey !== null) return;
      onChange();
      if (!session) return;
      const current = JSON.parse(seen);
      if (session.conflict && current?.revision >= session.conflict.revision) session.conflict = undefined;
      if (current?.snapshot) session.ready = true;
      queueSync();
    } catch {
      onStatus("storage");
    }
  }

  async function exchange(currentSession) {
    const raw = storage.getItem(currentSession.key);
    if (raw !== seen) onChange();
    const local = JSON.parse(raw);
    if (!visible() && !local?.writeId) return;
    const revision = local?.revision ?? 0;
    const pushing = Boolean(local?.writeId && !currentSession.conflict);
    const response = await currentSession.request({
      expectedUid: currentSession.uid, revision,
      ...(pushing ? { snapshot: local.snapshot, writeId: local.writeId } : {}),
    });
    if (session !== currentSession) return;

    const latestRaw = storage.getItem(currentSession.key);
    const latest = JSON.parse(latestRaw);
    const latestRevision = latest?.revision ?? 0;
    if (latestRevision !== revision) return queueSync();
    if (!response?.ok && response?.code !== "CONFLICT") {
      onStatus(response?.code === "TOO_LARGE" ? "too-large" : "unavailable");
      return;
    }
    if (!Number.isSafeInteger(response.revision) || response.revision < revision) {
      onStatus("unavailable");
      return;
    }
    currentSession.ready = true;
    if (pushing && response.ok) {
      if (response.revision !== revision + 1 || !latest?.snapshot) throw new Error("Invalid save acknowledgement");
      const unchanged = latest.writeId === local.writeId;
      save({
        revision: response.revision, snapshot: latest.snapshot,
        ...(!unchanged ? { writeId: latest.writeId } : {}),
      });
    } else if (response.revision > revision) {
      if (!Array.isArray(response.snapshot?.entries) || !Array.isArray(response.snapshot.trees)) {
        throw new Error("Invalid cloud snapshot");
      }
      if (latest?.writeId && JSON.stringify(latest.snapshot) !== JSON.stringify(response.snapshot)) {
        currentSession.conflict = response;
        onStatus("conflict");
        return;
      }
      save({ revision: response.revision, snapshot: response.snapshot });
      currentSession.conflict = undefined;
      onChange();
    }

    if (JSON.parse(seen)?.writeId) {
      onStatus("pending");
      queueSync();
    } else {
      onStatus("synced");
    }
  }

  function sync() {
    const current = session;
    if (!current) return Promise.resolve();
    if (!online()) {
      if (!current.conflict) onStatus("offline");
      return Promise.resolve();
    }
    current.inFlight ??= exchange(current).catch(() => {
      if (session === current && !current.conflict) onStatus("unavailable");
    }).finally(() => {
      current.inFlight = undefined;
    });
    return current.inFlight;
  }

  function resolveConflict(choice) {
    const cloud = session?.conflict;
    if (!cloud) return;
    try {
      const raw = storage.getItem(key());
      const local = JSON.parse(raw);
      if (raw !== seen || !local?.writeId || local.revision >= cloud.revision) {
        onChange();
        return queueSync();
      }
      if (choice === "cloud") {
        storage.setItem(key() + ":backup", raw);
        save({ revision: cloud.revision, snapshot: cloud.snapshot });
        onChange();
      } else if (choice === "local") {
        storage.setItem(key() + ":backup", JSON.stringify({ revision: cloud.revision, snapshot: cloud.snapshot }));
        save({ ...local, revision: cloud.revision, writeId: crypto.randomUUID() });
      } else {
        return;
      }
      session.conflict = undefined;
      onStatus(choice === "local" ? "pending" : "synced");
      queueSync();
    } catch {
      onStatus("conflict-storage");
    }
  }

  return { key, read, write, connect, sync, storageChanged, resolveConflict, ready: () => Boolean(session?.ready && !session.conflict) };
}

if (typeof module === "object") module.exports = { createForestSaveSync };
