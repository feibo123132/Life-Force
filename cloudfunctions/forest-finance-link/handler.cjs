"use strict";

const {
  getExpectedDailyBudget, getMonthlySpendingMetrics, getSpendingDayIndex,
  getWeeklyEncouragement, getWhaleMood, whaleMoods,
} = require("./finance-rules.cjs");

const chinaDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" });

function createFinanceHandler({ getUid, getLoginEmail, loadSavings, now = () => new Date() }) {
  return async () => {
    try {
      const uid = getUid();
      if (!uid) return { ok: false, code: "LOGIN_REQUIRED" };
      // The document key comes from the authenticated caller, never the request body.
      const email = (await getLoginEmail(uid))?.trim().toLowerCase();
      if (!email) return { ok: false, code: "LOGIN_REQUIRED" };
      const date = chinaDay.format(now());
      const snapshot = await loadSavings(email);
      if (!snapshot) return { ok: true, date, recorded: false, happy: false };

      const { transactions = [], settings = {} } = snapshot;
      const days = getSpendingDayIndex(transactions, settings.noSpendDays);
      if (!days.recorded.has(date)) return { ok: true, date, recorded: false, happy: false };

      // These rules use local calendar arithmetic. Give them the Shanghai day in the runtime's calendar.
      const [year, month, day] = date.split("-").map(Number);
      const today = new Date(year, month - 1, day);
      const expected = getExpectedDailyBudget(settings, date.slice(0, 7));
      const metrics = getMonthlySpendingMetrics(transactions, settings, today, today);
      const encouragement = getWeeklyEncouragement(days, expected, today);
      const happy = getWhaleMood(metrics, expected, encouragement) === whaleMoods.happy;
      return { ok: true, date, recorded: true, happy };
    } catch {
      return { ok: false, code: "STATUS_UNAVAILABLE" };
    }
  };
}

module.exports = { createFinanceHandler };
