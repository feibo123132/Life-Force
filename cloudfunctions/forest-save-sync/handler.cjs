"use strict";

const maxSnapshotBytes = 2 * 1024 * 1024;

function createSaveHandler({ getUid, load, compareAndSet, now = () => new Date() }) {
  return async event => {
    try {
      const uid = getUid();
      if (!uid || uid !== event?.expectedUid) return { ok: false, code: "LOGIN_REQUIRED" };

      const { revision, snapshot, writeId } = event;
      if (!Number.isSafeInteger(revision) || revision < 0) return { ok: false, code: "INVALID_SAVE" };
      if (writeId === undefined && snapshot === undefined) {
        const cloud = await load(uid);
        if (!cloud || cloud.revision === revision) return { ok: true, revision: cloud?.revision ?? 0 };
        return { ok: true, revision: cloud.revision, snapshot: cloud.snapshot };
      }

      if (typeof writeId !== "string" || !/^[\w-]{1,64}$/.test(writeId) ||
        revision >= Number.MAX_SAFE_INTEGER || !Array.isArray(snapshot?.entries) || !Array.isArray(snapshot.trees)) {
        return { ok: false, code: "INVALID_SAVE" };
      }
      if (Buffer.byteLength(JSON.stringify(snapshot)) > maxSnapshotBytes) return { ok: false, code: "TOO_LARGE" };
      const next = { revision: revision + 1, writeId, snapshot, updatedAt: now().toISOString() };
      if (await compareAndSet(uid, revision, next)) return { ok: true, revision: next.revision };
      const cloud = await load(uid);
      // A write can succeed even when the browser never receives its response.
      if (cloud?.writeId === writeId && cloud.revision === next.revision) return { ok: true, revision: cloud.revision };
      if (!cloud) return { ok: false, code: "SAVE_UNAVAILABLE" };
      return { ok: false, code: "CONFLICT", revision: cloud.revision, snapshot: cloud.snapshot };
    } catch {
      return { ok: false, code: "SAVE_UNAVAILABLE" };
    }
  };
}

module.exports = { createSaveHandler };
