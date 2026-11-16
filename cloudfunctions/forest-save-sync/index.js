"use strict";

const cloudbase = require("@cloudbase/node-sdk");
const { createSaveHandler } = require("./handler.cjs");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const auth = app.auth();
const collection = app.database().collection("life_forest_saves");

async function load(uid) {
  const { data } = await collection.where({ _id: uid }).limit(1).get();
  const record = data[0];
  if (!record) return undefined;
  return { ...record, snapshot: JSON.parse(record.snapshot) };
}

exports.main = createSaveHandler({
  getUid: () => auth.getUserInfo().uid,
  load,
  compareAndSet: async (uid, revision, next) => {
    const data = { ...next, snapshot: JSON.stringify(next.snapshot) };
    if (revision === 0) {
      try {
        const result = await collection.add({ _id: uid, ...data });
        if (result.code) throw new Error(result.code);
        return true;
      } catch (error) {
        // A concurrent first save may already have inserted this account's document.
        if (!(await load(uid))) throw error;
        return false;
      }
    }
    const result = await collection.where({ _id: uid, revision }).update(data);
    if (result.code) throw new Error(result.code);
    return result.updated === 1;
  },
});
