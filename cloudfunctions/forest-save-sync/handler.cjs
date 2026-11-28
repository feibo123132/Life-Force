"use strict";

const maxSnapshotBytes = 2 * 1024 * 1024;

function createSaveHandler({ getUid, load, compareAndSet, now = () => new Date() }) {
  return async event => {
    try {
      const uid = getUid();
      if (!uid || uid !== event?.expectedUid) return { ok: false, code: "LOGIN_REQUIRED" };

      // Nested requests have no top-level revision, so old deployments reject them before touching daily saves.
      const experiment = event.experiment !== undefined;
      const scope = experiment ? "experiment" : "daily";
      const payload = experiment ? event.experiment : event;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, code: "INVALID_SAVE" };
      const { revision, snapshot, writeId } = payload;
      const responseScope = experiment ? { scope } : {};
      if (!Number.isSafeInteger(revision) || revision < 0) return { ok: false, code: "INVALID_SAVE" };
      if (writeId === undefined && snapshot === undefined) {
        const cloud = await load(uid, scope);
        if (!cloud || cloud.revision === revision) return { ...responseScope, ok: true, revision: cloud?.revision ?? 0 };
        return { ...responseScope, ok: true, revision: cloud.revision, snapshot: cloud.snapshot };
      }

      if (typeof writeId !== "string" || !/^[\w-]{1,64}$/.test(writeId) ||
        revision >= Number.MAX_SAFE_INTEGER || !Array.isArray(snapshot?.entries) || !Array.isArray(snapshot.trees)) {
        return { ok: false, code: "INVALID_SAVE" };
      }
      if (Buffer.byteLength(JSON.stringify(snapshot)) > maxSnapshotBytes) return { ...responseScope, ok: false, code: "TOO_LARGE" };
      const next = { revision: revision + 1, writeId, snapshot, updatedAt: now().toISOString() };
      if (await compareAndSet(uid, revision, next, scope)) return { ...responseScope, ok: true, revision: next.revision };
      const cloud = await load(uid, scope);
      // A write can succeed even when the browser never receives its response.
      if (cloud?.writeId === writeId && cloud.revision === next.revision) return { ...responseScope, ok: true, revision: cloud.revision };
      if (!cloud) return { ok: false, code: "SAVE_UNAVAILABLE" };
      return { ...responseScope, ok: false, code: "CONFLICT", revision: cloud.revision, snapshot: cloud.snapshot };
    } catch {
      return { ok: false, code: "SAVE_UNAVAILABLE" };
    }
  };
}

module.exports = { createSaveHandler };
