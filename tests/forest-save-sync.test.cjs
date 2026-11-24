"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createForestSaveSync } = require("../save-sync.js");
const { createSaveHandler } = require("../cloudfunctions/forest-save-sync/handler.cjs");

const legacyKey = "life-forest-v2";
const snapshot = (name, entries = []) => ({
  entries, trees: [], player: { name, xp: 420, avatar: "data:image/png;base64,AA==" },
});

function makeStorage() {
  const records = new Map();
  return {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
}

function makeCloud() {
  const records = new Map();
  const handle = uid => createSaveHandler({
    getUid: () => uid,
    load: async key => records.get(key),
    compareAndSet: async (key, base, next) => {
      if ((records.get(key)?.revision ?? 0) !== base) return false;
      records.set(key, next);
      return true;
    },
  });
  return { handle, records };
}

function makeClient(storage = makeStorage()) {
  const statuses = [];
  const sync = createForestSaveSync({
    legacyKey, storage, onChange: () => sync.read(), onStatus: status => statuses.push(status),
    schedule: () => {}, online: () => true, visible: () => true,
  });
  return { sync, storage, statuses };
}

test("imports existing progress once and loads the full save on another device", async () => {
  const { handle } = makeCloud();
  const { sync: local, storage } = makeClient();
  const { sync: pages } = makeClient();
  const save = snapshot("森林旅人", [{ id: "grant", kind: "sample", reward: 50, collected: true }]);
  storage.setItem(legacyKey, JSON.stringify(save));
  local.connect("owner", handle("owner"));
  await local.sync();
  pages.connect("owner", handle("owner"));
  await pages.sync();
  assert.deepEqual(pages.read(), save);
  assert.equal(storage.getItem(legacyKey), JSON.stringify(save));
  local.connect("another", handle("another"));
  await local.sync();
  assert.equal(local.read(), null);
  local.connect("owner", handle("owner"));
  assert.deepEqual(local.read(), save);
});

test("a stale device cannot erase a newer version and keeps both saves on conflict", async () => {
  const { handle, records } = makeCloud();
  const { sync: local } = makeClient();
  const { sync: phone, storage, statuses } = makeClient();
  local.connect("owner", handle("owner"));
  local.write(snapshot("原始存档", [{ id: "old" }]));
  await local.sync();
  phone.connect("owner", handle("owner"));
  await phone.sync();
  phone.write(snapshot("离线改过", [{ id: "old" }]));
  local.write(snapshot("删除行动"));
  await local.sync();
  await phone.sync();
  assert.equal(statuses.at(-1), "conflict");
  assert.equal(phone.read().player.name, "离线改过");
  assert.equal(records.get("owner").snapshot.player.name, "删除行动");
  phone.resolveConflict("cloud");
  assert.equal(phone.read().entries.length, 0);
  assert.equal(JSON.parse(storage.getItem(phone.key() + ":backup")).snapshot.player.name, "离线改过");
});

test("journal notes keep all pages across device sync, reload and account switches", async () => {
  const { handle } = makeCloud();
  const { sync: desktop } = makeClient();
  const { sync: phone, storage } = makeClient();
  const now = new Date().toISOString();
  const todayNotes = { activePageId: "new", pages: [
    {
      id: "new", title: "这一年的 AI 使用记录", content: "今日安排\n✅ 完成\n<原样保留>", createdAt: now, updatedAt: now,
      html: "<b>今日安排</b>\n✅ 完成\n&lt;原样保留&gt;", layout: "split",
      leftTitle: "待验证", rightTitle: "已验证", rightContent: "对照内容",
      rightHtml: '<font color="#245eb0">对照内容</font>',
    },
    { id: "old", content: "往日记录".repeat(2500), createdAt: now, updatedAt: now },
  ] };
  desktop.connect("owner", handle("owner"));
  desktop.write({ ...snapshot("笔记主人"), todayNotes });
  await desktop.sync();
  phone.connect("owner", handle("owner"));
  await phone.sync();
  assert.deepEqual(phone.read().todayNotes, todayNotes);
  const { sync: reloaded } = makeClient(storage);
  reloaded.connect("owner", handle("owner"));
  assert.deepEqual(reloaded.read().todayNotes, todayNotes);
  reloaded.connect("another", handle("another"));
  await reloaded.sync();
  assert.equal(reloaded.read(), null);
  reloaded.connect("owner", handle("owner"));
  assert.deepEqual(reloaded.read().todayNotes, todayNotes);
});

test("a late response cannot overwrite edits made while uploading", async () => {
  const { handle, records } = makeCloud();
  const { sync } = makeClient();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  sync.connect("owner", async request => {
    await gate;
    return handle("owner")(request);
  });
  sync.write(snapshot("第一笔"));
  const uploading = sync.sync();
  sync.write(snapshot("第二笔"));
  release();
  await uploading;
  assert.equal(sync.read().player.name, "第二笔");
  await sync.sync();
  assert.equal(records.get("owner").snapshot.player.name, "第二笔");
});

test("a lost response keeps local progress and retries the same write after a reload", async () => {
  const { handle, records } = makeCloud();
  const { sync, storage, statuses } = makeClient();
  sync.connect("owner", async request => {
    await handle("owner")(request);
    throw new Error("connection closed");
  });
  const progress = snapshot("断网前的存档");
  sync.write(progress);
  await sync.sync();
  assert.equal(statuses.at(-1), "unavailable");
  assert.deepEqual(sync.read(), progress);

  const { sync: reloaded, statuses: restoredStatuses } = makeClient(storage);
  reloaded.connect("owner", handle("owner"));
  await reloaded.sync();
  assert.equal(restoredStatuses.at(-1), "synced");
  assert.equal(records.get("owner").revision, 1);
  assert.deepEqual(reloaded.read(), progress);
});

test("switching accounts ignores the previous account's delayed cloud read", async () => {
  const { sync } = makeClient();
  let respond;
  sync.connect("owner", () => new Promise(resolve => { respond = resolve; }));
  const loading = sync.sync();
  const { handle } = makeCloud();
  sync.connect("another", handle("another"));
  sync.write(snapshot("另一个账号"));
  respond({ ok: true, revision: 1, snapshot: snapshot("原账号") });
  await loading;
  await sync.sync();
  assert.equal(sync.read().player.name, "另一个账号");
});

test("concurrent first uploads save once, and a retry of the same write succeeds", async () => {
  const { handle } = makeCloud();
  const request = (name, writeId) => ({ expectedUid: "owner", revision: 0, snapshot: snapshot(name), writeId });
  const first = request("第一个设备", "first");
  const second = request("第二个设备", "second");
  const results = await Promise.all([handle("owner")(first), handle("owner")(second)]);
  assert.equal(results.filter(result => result.code === "CONFLICT").length, 1);
  assert.deepEqual(await handle("owner")(first), { ok: true, revision: 1 });
  assert.equal((await handle("other")(first)).code, "LOGIN_REQUIRED");
  assert.equal((await handle(undefined)(first)).code, "LOGIN_REQUIRED");
});
