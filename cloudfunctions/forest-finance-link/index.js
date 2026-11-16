"use strict";

const cloudbase = require("@cloudbase/node-sdk");
const { createFinanceHandler } = require("./handler.cjs");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const auth = app.auth();
const db = app.database();

exports.main = createFinanceHandler({
  getUid: () => auth.getUserInfo().uid,
  getLoginEmail: async uid => (await auth.getEndUserInfo(uid)).userInfo?.email,
  loadSavings: async email => {
    const { data } = await db.collection("transactions").aggregate().match({ _id: email }).limit(1).project({
      "transactions.date": 1,
      "transactions.amount": 1,
      "transactions.tags": 1,
      "transactions.deletedAt": 1,
      "settings.noSpendDays": 1,
      "settings.monthlyBudget": 1,
      "settings.dailyBudget": 1,
      "settings.fixedExpensesByMonth": 1,
      "settings.fixedExpenses": 1,
    }).end();
    return data[0];
  },
});
