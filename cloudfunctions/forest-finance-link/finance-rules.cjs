// Generated from JIEYOU 存钱罐 by scripts/build-finance-rules.mjs.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  getExpectedDailyBudget: () => getExpectedDailyBudget,
  getMonthlySpendingMetrics: () => getMonthlySpendingMetrics,
  getSpendingDayIndex: () => getSpendingDayIndex,
  getWeeklyEncouragement: () => getWeeklyEncouragement,
  getWhaleMood: () => getWhaleMood,
  whaleMoods: () => whaleMoods
});
module.exports = __toCommonJS(stdin_exports);

// src/lib/spendingMetrics.ts
var import_date_fns2 = require("date-fns");

// src/lib/expenseChartData.ts
var import_date_fns = require("date-fns");
function getDailyExpenseSeries(transactions, month, today = /* @__PURE__ */ new Date()) {
  const todayKey = (0, import_date_fns.format)(today, "yyyy-MM-dd");
  const totals = /* @__PURE__ */ new Map();
  const occasionalTotals = /* @__PURE__ */ new Map();
  const foodTotals = /* @__PURE__ */ new Map();
  const gooseDays = /* @__PURE__ */ new Set();
  for (const transaction of transactions) {
    if (transaction.deletedAt) continue;
    if (transaction.tags.includes("goose")) {
      gooseDays.add(transaction.date);
      continue;
    }
    if (transaction.tags.includes("food")) {
      foodTotals.set(transaction.date, (foodTotals.get(transaction.date) ?? 0) + transaction.amount);
    }
    if (transaction.tags.includes("unfixed")) {
      occasionalTotals.set(transaction.date, (occasionalTotals.get(transaction.date) ?? 0) + transaction.amount);
    }
    if (transaction.tags.includes("fixed")) continue;
    totals.set(transaction.date, (totals.get(transaction.date) ?? 0) + transaction.amount);
  }
  const days = (0, import_date_fns.eachDayOfInterval)({ start: (0, import_date_fns.startOfMonth)(month), end: (0, import_date_fns.endOfMonth)(month) }).map((date) => {
    const key = (0, import_date_fns.format)(date, "yyyy-MM-dd");
    const visible = key <= todayKey || totals.has(key) || occasionalTotals.has(key) || foodTotals.has(key) || gooseDays.has(key);
    return {
      date: key,
      day: date.getDate(),
      amount: visible ? totals.get(key) ?? 0 : null,
      occasionalAmount: visible ? occasionalTotals.get(key) ?? 0 : null,
      foodAmount: visible ? foodTotals.get(key) ?? 0 : null,
      hasGoose: gooseDays.has(key)
    };
  });
  const elapsedDays = days.filter((day) => day.date <= todayKey);
  const total = elapsedDays.reduce((sum, day) => sum + (day.amount ?? 0), 0);
  const elapsedOccasionalTotal = elapsedDays.reduce((sum, day) => sum + (day.occasionalAmount ?? 0), 0);
  const occasionalAverage = elapsedDays.length ? Number((elapsedOccasionalTotal / elapsedDays.length).toPrecision(15)) : 0;
  const occasionalTotal = days.reduce((sum, day) => sum + (occasionalTotals.get(day.date) ?? 0), 0);
  const foodTotal = days.reduce((sum, day) => sum + (foodTotals.get(day.date) ?? 0), 0);
  const monthFood = transactions.filter((t) => !t.deletedAt && t.tags.includes("food") && !t.tags.includes("goose") && t.date.startsWith((0, import_date_fns.format)(month, "yyyy-MM")));
  const necessaryFoodTotal = monthFood.filter((t) => t.tags.includes("necessary")).reduce((sum, t) => sum + t.amount, 0);
  const optionalFoodTotal = monthFood.filter((t) => t.tags.includes("optional") || t.tags.includes("unnatural")).reduce((sum, t) => sum + t.amount, 0);
  return { days, elapsedDays: elapsedDays.length, average: elapsedDays.length ? total / elapsedDays.length : 0, occasionalAverage, occasionalTotal, foodTotal, necessaryFoodTotal, optionalFoodTotal };
}

// src/lib/fixedExpenses.ts
var isValidMonth = (value) => /^\d{4}-\d{2}$/.test(value);
var compareMonth = (a, b) => {
  if (a === b) return 0;
  return a > b ? 1 : -1;
};
var cloneExpenses = (expenses) => expenses.map((expense) => ({ ...expense }));
var normalizeFixedExpenseSnapshots = (snapshots) => {
  if (!snapshots || snapshots.length === 0) return [];
  const latestByMonth = /* @__PURE__ */ new Map();
  snapshots.forEach((snapshot) => {
    if (!snapshot || !isValidMonth(snapshot.month) || !Array.isArray(snapshot.expenses)) return;
    latestByMonth.set(snapshot.month, cloneExpenses(snapshot.expenses));
  });
  return [...latestByMonth.entries()].sort(([monthA], [monthB]) => compareMonth(monthA, monthB)).map(([month, expenses]) => ({
    month,
    expenses
  }));
};
var getFixedExpensesForMonth = (snapshots, month, legacyFixedExpenses) => {
  const normalized = normalizeFixedExpenseSnapshots(snapshots);
  if (!isValidMonth(month)) return cloneExpenses(legacyFixedExpenses || []);
  const exactMatch = normalized.find((snapshot) => snapshot.month === month);
  if (exactMatch) return cloneExpenses(exactMatch.expenses);
  const inherited = [...normalized].reverse().find((snapshot) => compareMonth(snapshot.month, month) < 0);
  if (inherited) return cloneExpenses(inherited.expenses);
  return cloneExpenses(legacyFixedExpenses || []);
};

// src/lib/spendingMetrics.ts
function getExpectedDailyBudget(settings, month) {
  if (settings.dailyBudget > 0) return settings.dailyBudget;
  const fixedTotal = getFixedExpensesForMonth(settings.fixedExpensesByMonth, month, settings.fixedExpenses).reduce((sum, expense) => sum + expense.amount, 0);
  return Math.max(0, (settings.monthlyBudget - fixedTotal) / 30);
}
function getDailySpendingMetrics(transactions, settings, month, today = /* @__PURE__ */ new Date()) {
  const monthKey = (0, import_date_fns2.format)(month, "yyyy-MM");
  const records = transactions.filter((transaction) => transaction.date.startsWith(monthKey));
  const fixed = getFixedExpensesForMonth(settings.fixedExpensesByMonth, monthKey, settings.fixedExpenses);
  let remainingBudget = settings.monthlyBudget - fixed.reduce((sum, expense) => sum + expense.amount, 0);
  const budgetSpendingByDay = /* @__PURE__ */ new Map();
  for (const transaction of records) {
    if (transaction.deletedAt || transaction.tags.includes("fixed")) continue;
    budgetSpendingByDay.set(transaction.date, (budgetSpendingByDay.get(transaction.date) ?? 0) + transaction.amount);
  }
  const { days, elapsedDays } = getDailyExpenseSeries(records, month, today);
  let spent = 0;
  let occasional = 0;
  return days.map(({ date, day, amount, occasionalAmount }) => {
    if (day > elapsedDays) return { date, day, metrics: null };
    remainingBudget -= budgetSpendingByDay.get(date) ?? 0;
    spent += amount ?? 0;
    occasional += occasionalAmount ?? 0;
    return {
      date,
      day,
      metrics: {
        dailyRemaining: remainingBudget / (days.length - day + 1),
        dailyAverage: spent / day,
        occasionalAverage: Number((occasional / day).toPrecision(15))
      }
    };
  });
}
function getMonthlySpendingMetrics(transactions, settings, month, today = /* @__PURE__ */ new Date()) {
  const recordedDays = getDailySpendingMetrics(transactions, settings, month, today).filter((point) => point.metrics !== null);
  return recordedDays[recordedDays.length - 1]?.metrics ?? { dailyRemaining: 0, dailyAverage: 0, occasionalAverage: 0 };
}

// src/lib/whaleMood.ts
var import_date_fns3 = require("date-fns");
var moodFolder = `${""}whale-moods/`;
var whaleMoods = {
  happy: { label: "\u5F00\u5FC3", image: moodFolder + "happy.png", animation: moodFolder + "happy.gif", color: "#16a34a" },
  calm: { label: "\u5E73\u9759", image: moodFolder + "calm.png", animation: moodFolder + "calm.gif", color: "#2563eb" },
  worried: { label: "\u62C5\u5FC3", image: moodFolder + "worried.png", animation: moodFolder + "worried.gif", color: "#d97706" },
  crying: { label: "\u5927\u54ED", image: moodFolder + "crying.png", animation: moodFolder + "crying.gif", color: "#dc2626" }
};
function getWhaleSpendingAlerts({ dailyRemaining, dailyAverage, occasionalAverage }, expectedDaily) {
  const remainingAlert = dailyRemaining < 0 ? 2 : dailyRemaining < expectedDaily * 0.5 ? 1 : dailyRemaining < expectedDaily * 0.8 ? 0.5 : 0;
  const occasionalAlerts = occasionalAverage > 20 ? 1.5 : occasionalAverage > 15 ? 1 : occasionalAverage > 10 ? 0.5 : 0;
  const spendingAlerts = dailyAverage > expectedDaily * 2 ? 1.5 : dailyAverage > expectedDaily * 1.5 ? 1 : dailyAverage > expectedDaily * 1.2 ? 0.5 : 0;
  return { remainingAlert, occasionalAlerts, spendingAlerts };
}
var money = (value) => `\xA5${value.toFixed(2)}`;
function getWhaleMoodReport(metrics, expectedDaily, encouragement) {
  const { dailyRemaining, dailyAverage, occasionalAverage } = metrics;
  const { remainingAlert, occasionalAlerts, spendingAlerts } = getWhaleSpendingAlerts(metrics, expectedDaily);
  const target = money(expectedDaily);
  if (remainingAlert === 2) {
    return { mood: whaleMoods.crying, reason: { title: "\u6708\u9884\u7B97\u5DF2\u900F\u652F", detail: `\u65E5\u5747\u5269\u4F59 ${money(dailyRemaining)}` } };
  }
  if (expectedDaily > 0 && dailyRemaining >= expectedDaily) {
    return { mood: whaleMoods.happy, reason: { title: "\u6708\u5185\u65E5\u5747\u5269\u4F59\u8FBE\u6807", detail: `${money(dailyRemaining)} \u2265 \u671F\u671B ${target}` } };
  }
  if (encouragement?.streak || encouragement?.weekly) {
    const weekAverage = money(encouragement.weekAverage ?? dailyAverage);
    if (encouragement.streak && encouragement.weekly) {
      return { mood: whaleMoods.happy, reason: { title: "\u8FDE\u7EED 3 \u5929\u4E14\u672C\u5468\u8FBE\u6807", detail: `\u672C\u5468\u65E5\u5747 ${weekAverage} < ${target}` } };
    }
    return encouragement.streak ? { mood: whaleMoods.happy, reason: { title: "\u8FDE\u7EED 3 \u5929\u4F4E\u4E8E\u671F\u671B", detail: `\u6BCF\u5929\u5F00\u9500 < ${target}` } } : { mood: whaleMoods.happy, reason: { title: "\u672C\u5468\u65E5\u5747\u4F4E\u4E8E\u671F\u671B", detail: `${weekAverage} < ${target}` } };
  }
  if (remainingAlert === 0) {
    return { mood: whaleMoods.calm, reason: { title: "\u672A\u8FBE\u671F\u671B\u65E5\u5747", detail: `\u5269\u4F59 ${money(dailyRemaining)} < \u671F\u671B ${target}` } };
  }
  const totalAlerts = remainingAlert + Math.max(spendingAlerts, occasionalAlerts);
  const mood = totalAlerts >= 2 ? whaleMoods.crying : totalAlerts >= 1 ? whaleMoods.worried : whaleMoods.calm;
  if (spendingAlerts > 0 && spendingAlerts >= occasionalAlerts) {
    return { mood, reason: { title: mood === whaleMoods.crying ? "\u65E5\u5747\u5F00\u9500\u4E25\u91CD\u8D85\u6807" : "\u65E5\u5747\u5F00\u9500\u504F\u9AD8", detail: `${money(dailyAverage)} / \u671F\u671B ${target}` } };
  }
  if (occasionalAlerts > 0) {
    return { mood, reason: { title: mood === whaleMoods.crying ? "\u5076\u53D1\u652F\u51FA\u4E25\u91CD\u8D85\u6807" : "\u5076\u53D1\u652F\u51FA\u504F\u9AD8", detail: `\u65E5\u5747\u5076\u652F ${money(occasionalAverage)}` } };
  }
  const limit = remainingAlert === 1 ? 50 : 80;
  return { mood, reason: { title: "\u65E5\u5747\u5269\u4F59\u504F\u4F4E", detail: `${money(dailyRemaining)} < \u671F\u671B ${target} \xD7 ${limit}%` } };
}
function getWhaleMood(metrics, expectedDaily, encouragement) {
  return getWhaleMoodReport(metrics, expectedDaily, encouragement).mood;
}
function getSpendingDayIndex(transactions, noSpendDays = []) {
  const spent = /* @__PURE__ */ new Map();
  const occasional = /* @__PURE__ */ new Map();
  const recorded = /* @__PURE__ */ new Set();
  for (const transaction of transactions) {
    if (transaction.deletedAt) continue;
    recorded.add(transaction.date);
    if (transaction.tags.includes("goose")) continue;
    if (transaction.tags.includes("unfixed")) {
      occasional.set(transaction.date, (occasional.get(transaction.date) ?? 0) + transaction.amount);
    }
    if (transaction.tags.includes("fixed")) continue;
    spent.set(transaction.date, (spent.get(transaction.date) ?? 0) + transaction.amount);
  }
  for (const date of noSpendDays) recorded.add(date);
  return { spent, occasional, recorded };
}
var WEEK_STARTS_ON = 1;
var WEEK_SETTLEMENT_DAY = 0;
function getWeeklyEncouragement(index, expectedDaily, day) {
  if (!(expectedDaily > 0)) return { streak: false, weekly: false };
  const underTarget = (date) => {
    const key = (0, import_date_fns3.format)(date, "yyyy-MM-dd");
    return index.recorded.has(key) && (index.spent.get(key) ?? 0) < expectedDaily;
  };
  const streak = underTarget(day) && underTarget((0, import_date_fns3.subDays)(day, 1)) && underTarget((0, import_date_fns3.subDays)(day, 2));
  const weekStart = (0, import_date_fns3.startOfWeek)(day, { weekStartsOn: WEEK_STARTS_ON });
  const elapsed = (0, import_date_fns3.differenceInCalendarDays)(day, weekStart) + 1;
  let spent = 0;
  let occasional = 0;
  let recorded = 0;
  for (let offset = 0; offset < elapsed; offset += 1) {
    const key = (0, import_date_fns3.format)((0, import_date_fns3.addDays)(weekStart, offset), "yyyy-MM-dd");
    spent += index.spent.get(key) ?? 0;
    occasional += index.occasional.get(key) ?? 0;
    if (index.recorded.has(key)) recorded += 1;
  }
  const settled = day.getDay() === WEEK_SETTLEMENT_DAY;
  const weekly = settled && recorded >= 3 && spent / elapsed < expectedDaily && occasional / elapsed <= 10;
  return { streak, weekly, weekAverage: elapsed > 0 ? spent / elapsed : 0 };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getExpectedDailyBudget,
  getMonthlySpendingMetrics,
  getSpendingDayIndex,
  getWeeklyEncouragement,
  getWhaleMood,
  whaleMoods
});
