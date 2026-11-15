"use strict";

const defaultHabits = {
  move: { name: "动一动", description: "晚饭后走 5 分钟", icon: "move" },
  study: { name: "专注学习", description: "专注学 15 分钟", icon: "focus" },
  reflect: { name: "睡前复盘", description: "写一句今天的观察", icon: "reflect" },
  save: { name: "好好存钱", description: "按计划实际存入一笔", icon: "save" },
};
const initialHabits = () => Object.entries(defaultHabits).map(([id, { name, description }]) => ({ id, name, description }));
const actionCategories = new Map([
  ["all", "全部"], ["study", "学习"], ["work", "工作"],
  ["exercise", "锻炼"], ["music", "音乐"], ["other", "其它"],
]);
const dailyActionGoal = 5;
const dailyActionBonus = "daily-action-bonus";
// The old IDs are needed to keep existing crops on the same tile where possible.
const legacyPlots = [[2, 2], [3, 1], [1, 3], [4, 2], [2, 4]];
for (const [rows, columns] of [[5, 5], [6, 7]]) {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (!legacyPlots.some(([savedRow, savedColumn]) => savedRow === row && savedColumn === column)) {
        legacyPlots.push([row, column]);
      }
    }
  }
}
// Seams of the painted tiles, plus one matching column along the right edge.
const field = [
  [[845, 373], [909, 406], [977, 439], [1045, 473], [1119, 508], [1200, 545], [1278, 584]],
  [[783, 405], [845, 438], [911, 473], [982, 507], [1056, 544], [1134, 582], [1212, 622]],
  [[716, 438], [778, 474], [844, 508], [916, 543], [990, 582], [1067, 622], [1145, 663]],
  [[645, 473], [706, 509], [773, 545], [844, 582], [918, 622], [996, 662], [1074, 705]],
  [[568, 511], [630, 547], [696, 585], [766, 623], [840, 665], [918, 705], [996, 750]],
  [[479, 552], [541, 589], [608, 629], [676, 670], [755, 711], [839, 758], [917, 805]],
];
// Artwork samples from the previous valley's raised grass tiles.
const turfSamples = [
  { left: 970, top: 450, width: 141, height: 75 },
  { left: 899, top: 487, width: 142, height: 78 },
  { left: 826, top: 525, width: 146, height: 81 },
  { left: 750, top: 564, width: 150, height: 83 },
  { left: 669, top: 606, width: 153, height: 87 },
];
const fieldRows = 5;
const fieldColumns = 6;
const starterPlots = 5;
const plots = Array.from({ length: fieldRows * fieldColumns }, (_, index) =>
  [Math.floor(index / fieldColumns), index % fieldColumns]
).sort(([aRow, aCol], [bRow, bCol]) => aRow + aCol - bRow - bCol || aCol - bCol);
const firstExpansionPlot = plots.findIndex(([row, column]) => row === 2 && column === 1);
const sceneWidth = 1672;
const sceneHeight = 941;
const maxSceneZoom = 1.65;
let sceneZoom = 1;
const orbCenter = [74.2, 50.2];
const orbOffsets = [[-1, -.5], [0, -.5], [1, -.5], [-.5, .5], [.5, .5]];
const plants = new Map([
  ["fir", { name: "小杉树", unlockLevel: 10, emoji: "🌲", sprite: "./assets/island-fir.webp", height: 170, price: 6, maturity: 90, xp: 138, gold: 14 }],
  ["sunflower", { name: "向日葵", unlockLevel: 15, sprite: "./assets/sunflower.webp", height: 122, price: 8, maturity: 105, xp: 192, gold: 18 }],
  ["banana", { name: "香蕉树", unlockLevel: 20, sprite: "./assets/banana-original-two-bunches.webp", height: 170, price: 10, maturity: 135, xp: 250, gold: 25 }],
  ["cherry", { name: "樱花树", unlockLevel: 25, sprite: "./assets/cherry.webp", height: 155, price: 12, maturity: 165, xp: 312, gold: 34 }],
  ["reeds", { name: "芦苇", unlockLevel: 5, sprite: "./assets/reeds.webp", height: 111, price: 4, maturity: 75, xp: 88, gold: 11 }],
  ["rice", { name: "水稻", unlockLevel: 1, sprite: "./assets/rice.webp", height: 86, price: 2, maturity: 60, xp: 42, gold: 8 }],
]);
const growthStages = [
  { label: "成熟期", ratio: 1, scale: 1 },
  { label: "半成熟期", ratio: 1 / 3, scale: 0.73, asset: "young" },
  { label: "幼苗期", ratio: 0, scale: 0.43, asset: "seedling" },
];
const naturalGrowthInterval = 600_000;
const ranks = [
  "林间学徒", "苗圃培育师", "果园管事", "林地守护者", "森林培育大师",
  "林海守望者", "古树培育宗师", "万木贤者", "林海领主", "森林传奇", "生命森林宗师",
];
const maxPlayerLevel = 100;
const waterBoost = 10;
const fieldTools = new Map([
  ["dig", { artwork: "dig", followsPointer: true, hint: "选择一株植物，再确认是否清除。" }],
  ["water", { hint: `点一株未成熟的植物。每株可浇水一次，增加 ${waterBoost} 点生长值。` }],
  ["harvest", { artwork: "harvest-hand", followsPointer: true, hint: "点一株成熟的植物，获得经验并将作物放入仓库。" }],
]);
const fertilizers = new Map([
  ["basic", { name: "初级化肥", price: 2, boost: 15 }],
  ["standard", { name: "中级化肥", price: 4, boost: 30 }],
  ["premium", { name: "高级化肥", price: 7, boost: 60 }],
]);
const minimumPrice = Math.min(...Array.from(plants.values(), plant => plant.price));
const storageKey = "life-forest-v2";
const demoStorageKey = "life-forest-demo-v1";
const defaultAvatar = "./assets/growth/fir-seedling.webp";
const shortDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });
const el = Object.fromEntries([...document.querySelectorAll("[id]")].map(node => [node.id, node]));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let selectedPlot;
let journalPlot;
let activeTool;
let pendingDig;
let previewPlot;

function restoreWaitingCrops(save) {
  const occupied = new Set(save.trees.map(tree => tree.plot));
  for (const index of plots.keys()) {
    if (!save.waitingCrops.length) break;
    if (!occupied.has(index)) save.trees.push({ ...save.waitingCrops.shift(), plot: index });
  }
}

function migrateField(save) {
  if (Array.isArray(save.reclaimedPlots)) {
    return { trees: save.trees, reclaimedPlots: save.reclaimedPlots, waitingCrops: save.waitingCrops ?? [] };
  }
  const fieldSave = { trees: [], reclaimedPlots: [], waitingCrops: [] };
  for (const tree of save.trees) {
    const previous = legacyPlots[tree.plot];
    const plot = previous ? plots.findIndex(([row, col]) => row === previous[0] && col === previous[1]) : -1;
    if (plot >= 0) fieldSave.trees.push({ ...tree, plot });
    else fieldSave.waitingCrops.push(tree);
  }
  restoreWaitingCrops(fieldSave);
  return fieldSave;
}

function todayKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatDate(date) {
  return shortDate.format(new Date(date + "T12:00:00"));
}

function speciesId(tree) {
  return plants.has(tree.species) ? tree.species : "fir";
}

function maturityTarget(tree) {
  return tree.growthTarget ?? 90;
}

function growthProgress(tree, now) {
  const target = maturityTarget(tree);
  // Older saves already displayed these plants at full size.
  if (!Number.isFinite(tree.plantedAt)) return { target, progress: target, remaining: 0 };
  const interval = tree.growthInterval ?? 1000;
  const boost = (tree.fertilizerBoost ?? 0) + (tree.waterBoost ?? 0);
  const elapsed = Math.max(0, now - tree.plantedAt);
  const progress = Math.min(target, elapsed / interval + boost);
  const remaining = progress >= target ? 0 : Math.max(0, tree.plantedAt + (target - boost) * interval - now);
  return { target, progress, remaining };
}

function growthPoints(tree, now) {
  return Math.floor(growthProgress(tree, now).progress);
}

function updateCropTooltip(now = Date.now()) {
  const tooltip = el["crop-tooltip"];
  const tree = previewPlot && state.trees.find(tree => tree.plot === Number(previewPlot.dataset.plot));
  tooltip.hidden = !tree;
  if (!tree) return;

  const { target, progress, remaining } = growthProgress(tree, now);
  const seconds = Math.ceil(remaining / 1000);
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(part => String(part).padStart(2, "0")).join(":");
  const time = el["crop-tooltip-time"];
  const status = remaining ? `距成熟 ${countdown}` : "已成熟，可收获";
  if (time.textContent !== status) time.textContent = status;
  const species = plants.get(speciesId(tree));
  el["crop-tooltip-name"].textContent = species.emoji ? `${species.emoji} ${species.name}` : species.name;
  const meter = el["crop-tooltip-progress"];
  meter.max = target;
  meter.value = progress;

  const crop = previewPlot.lastElementChild.getBoundingClientRect();
  const world = el.forest.getBoundingClientRect();
  if (crop.right <= world.left || crop.left >= world.right || crop.bottom <= world.top || crop.top >= world.bottom) {
    tooltip.hidden = true;
    return;
  }
  const x = (crop.left + crop.right - tooltip.offsetWidth) / 2 - world.left;
  const above = crop.top - world.top - tooltip.offsetHeight - 8;
  const y = above >= 8 ? above : crop.bottom - world.top + 8;
  tooltip.style.left = `${Math.max(8, Math.min(x, world.width - tooltip.offsetWidth - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(y, world.height - tooltip.offsetHeight - 8))}px`;
}

function previewCrop(button) {
  if (previewPlot === button) return;
  previewPlot?.removeAttribute("aria-describedby");
  previewPlot = button;
  previewPlot?.setAttribute("aria-describedby", "crop-tooltip");
  updateCropTooltip();
}

function plantAppearance(tree, now) {
  const id = speciesId(tree);
  const species = plants.get(id);
  const points = growthPoints(tree, now);
  const stage = growthStages.find(candidate => points >= Math.ceil(maturityTarget(tree) * candidate.ratio));
  return {
    name: species.name,
    label: stage.label,
    sprite: stage.asset ? `./assets/growth/${id}-${stage.asset}.webp` : species.sprite,
    height: species.height * stage.scale,
    width: 62 * stage.scale,
  };
}

function updatePlotGrowth(tree, button, now) {
  const appearance = plantAppearance(tree, now);
  if (button.dataset.stage === appearance.label) return;
  button.dataset.stage = appearance.label;
  button.style.setProperty("--plant-height", appearance.height + "%");
  button.style.setProperty("--plant-width", appearance.width + "%");
  button.lastElementChild.src = appearance.sprite;
  button.setAttribute("aria-label", `查看${appearance.name}，${appearance.label}`);
}

function updateJournalGrowth(tree, now) {
  const appearance = plantAppearance(tree, now);
  const image = el["journal-cover-art"];
  if (image.getAttribute("src") !== appearance.sprite) image.src = appearance.sprite;
  const subtitle = `种于 ${formatDate(tree.date)} · ${appearance.label}`;
  const kicker = el["journal-kicker"];
  if (kicker.textContent !== subtitle) kicker.textContent = subtitle;
  const points = growthPoints(tree, now);
  const maturity = maturityTarget(tree);
  const isMature = points >= maturity;
  const nextStage = growthStages.findLast(stage => Math.ceil(maturity * stage.ratio) > points);
  const target = nextStage ? Math.ceil(maturity * nextStage.ratio) : maturity;
  const label = `生长值 ${points} / ${target}${nextStage ? ` · 下一阶段 ${nextStage.label}` : ""}`;
  if (el["growth-progress-label"].textContent !== label) {
    el["growth-progress-label"].textContent = label;
    el["growth-progress"].max = target;
    el["growth-progress"].value = points;
  }
  el["fertilizer-options"].hidden = isMature;
  el["journal-harvest"].hidden = !isMature;
}

function refreshGrowth() {
  const now = Date.now();
  for (const tree of state.trees) {
    const plot = el.plots.children[tree.plot];
    if (plot) updatePlotGrowth(tree, plot, now);
    if (el.journal.open && journalPlot === tree.plot) updateJournalGrowth(tree, now);
  }
  if (previewPlot) updateCropTooltip(now);
}

function startingState() {
  return {
    habits: initialHabits(),
    entries: [],
    trees: [],
    reclaimedPlots: [],
    waitingCrops: [],
    seedlings: [],
    fertilizerPurchases: [],
    spentPlantEnergyIds: [],
    warehouse: {},
    player: { name: "森林旅人", xp: 0, gold: 0, xpScale: 10 },
  };
}

function readState() {
  try {
    // Discard playtest saves without affecting progress made after the reset.
    localStorage.removeItem(demoStorageKey);
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.entries) && Array.isArray(saved.trees)) {
      const player = { ...startingState().player, ...saved.player };
      // Scale legacy XP once so the new thresholds preserve existing progress.
      if (saved.player?.xpScale !== 10) {
        player.xp *= 10;
        player.xpScale = 10;
      }
      return {
        ...saved,
        ...migrateField(saved),
        habits: Array.isArray(saved.habits) ? saved.habits : initialHabits(),
        seedlings: Array.isArray(saved.seedlings) ? saved.seedlings : [],
        fertilizerPurchases: Array.isArray(saved.fertilizerPurchases) ? saved.fertilizerPurchases : [],
        spentPlantEnergyIds: Array.isArray(saved.spentPlantEnergyIds) ? saved.spentPlantEnergyIds : [],
        warehouse: saved.warehouse ?? {},
        player,
      };
    }
  } catch {
    el["storage-note"].textContent = "体验版 · 当前浏览器无法读取本地记录";
  }
  return startingState();
}

let state = readState();
let noticeTimer;
let displayedDay;

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    el["storage-note"].textContent = "体验版 · 当前浏览器无法保存，记录仅在本次打开时有效";
    return false;
  }
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
}

function cameraTo(x, smooth = true, y) {
  const camera = el.camera;
  const scene = el.scene.getBoundingClientRect();
  camera.scrollTo({
    left: scene.width * x / sceneWidth - camera.clientWidth / 2,
    top: y === undefined ? camera.scrollTop : scene.height * y / sceneHeight - camera.clientHeight / 2,
    behavior: smooth && !reduceMotion.matches ? "smooth" : "instant",
  });
}

el.camera.addEventListener("wheel", event => {
  if (event.ctrlKey || event.metaKey || !event.deltaY) return;
  event.preventDefault();
  const { deltaMode, deltaY } = event;
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? el.camera.clientHeight : 1;
  const zoom = Math.min(maxSceneZoom, Math.max(1, sceneZoom * Math.exp(-deltaY * unit * .0014)));
  if (zoom === sceneZoom) return;

  const camera = el.camera.getBoundingClientRect();
  const x = event.clientX - camera.left;
  const y = event.clientY - camera.top;
  const ratio = zoom / sceneZoom;
  const left = (el.camera.scrollLeft + x) * ratio - x;
  const top = (el.camera.scrollTop + y) * ratio - y;
  el.camera.style.setProperty("--scene-zoom", zoom);
  el.camera.scrollTo({ left, top, behavior: "instant" });
  sceneZoom = zoom;
}, { passive: false });
el.camera.addEventListener("scroll", () => {
  if (previewPlot) updateCropTooltip();
});
window.addEventListener("resize", () => {
  if (previewPlot) updateCropTooltip();
});

el.plots.addEventListener("pointermove", event => {
  if (event.pointerType !== "mouse") return;
  previewCrop(event.target.closest(".plot.planted"));
});
el.camera.addEventListener("pointermove", event => {
  if (event.pointerType === "mouse" && !el.plots.contains(event.target)) previewCrop(null);
});
el.camera.addEventListener("pointerleave", () => previewCrop(null));
el.plots.addEventListener("focusin", event => {
  if (event.target.matches(".plot.planted:focus-visible")) previewCrop(event.target);
});
el.plots.addEventListener("focusout", event => {
  if (previewPlot === event.target) previewCrop(null);
});

function showActions() {
  setActionEditMode(false);
  el["action-status"].textContent = "";
  el.actions.showModal();
}

function dailyActionStreak(day) {
  const totals = new Map();
  for (const { date, kind } of state.entries) {
    if (date && kind !== dailyActionBonus && kind !== "sample") totals.set(date, (totals.get(date) ?? 0) + 1);
  }
  const cursor = new Date(`${day}T00:00:00Z`);
  if ((totals.get(day) ?? 0) < dailyActionGoal) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while ((totals.get(cursor.toISOString().slice(0, 10)) ?? 0) >= dailyActionGoal) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function spentEnergyIds() {
  const purchases = [...state.trees, ...state.waitingCrops, ...state.seedlings, ...state.fertilizerPurchases];
  return new Set([...state.spentPlantEnergyIds, ...purchases.flatMap(purchase => purchase.energyIds)]);
}

function actionReward(item) {
  return item?.reward ?? 1;
}

// Keep the original ID for the first point so existing purchases still link to their action.
function energyEntryId(id) {
  return id.split("#", 1)[0];
}

function availableEnergy() {
  const spentByEntry = new Map();
  for (const id of spentEnergyIds()) {
    const entryId = energyEntryId(id);
    spentByEntry.set(entryId, (spentByEntry.get(entryId) ?? 0) + 1);
  }
  return state.entries.reduce((total, entry) => entry.collected
    ? total + (actionReward(entry) - (spentByEntry.get(entry.id) ?? 0))
    : total, 0);
}

function availableEnergyIds(amount) {
  const spent = spentEnergyIds();
  const ids = [];
  for (const entry of state.entries) {
    if (!entry.collected) continue;
    const reward = actionReward(entry);
    for (let point = 0; point < reward; point++) {
      const id = point === 0 ? entry.id : `${entry.id}#${point}`;
      if (spent.has(id)) continue;
      ids.push(id);
      if (ids.length === amount) return ids;
    }
  }
  return ids;
}

function notify(message) {
  clearTimeout(noticeTimer);
  el.notice.hidden = false;
  el.notice.textContent = message;
  noticeTimer = setTimeout(() => { el.notice.hidden = true; }, 3200);
}

const habitButtons = new Map();
const plantOptions = new Map();
const fertilizerOptions = new Map();
let editingHabit;
let actionFilter = "all";

function habitCategory(habit) {
  const category = habit?.category;
  return category !== "all" && actionCategories.has(category) ? category : "other";
}

for (const [category, label] of actionCategories) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.dataset.category = category;
  const artwork = document.createElement("i");
  artwork.className = "action-art action-category-icon";
  artwork.setAttribute("aria-hidden", "true");
  tab.append(artwork, label);
  tab.addEventListener("click", () => {
    actionFilter = category;
    filterHabits();
    el.habits.scrollTop = 0;
  });
  el["action-categories"].append(tab);
  if (category !== "all") el["action-category"].append(new Option(label, category));
}

function filterHabits() {
  for (const tab of el["action-categories"].children) {
    tab.setAttribute("aria-pressed", String(tab.dataset.category === actionFilter));
  }
  let visibleCount = 0;
  for (const { row } of habitButtons.values()) {
    row.hidden = actionFilter !== "all" && row.dataset.category !== actionFilter;
    if (!row.hidden) visibleCount++;
  }
  el.habits.classList.toggle("is-scrollable", visibleCount > 5);
  el["action-empty"].hidden = visibleCount > 0;
  el["action-empty"].textContent = state.habits.length ? "这个分类还没有行动。" : "还没有行动，点击新增行动开始记录。";
}

function renderHabits() {
  habitButtons.clear();
  el.habits.replaceChildren();
  for (const habit of state.habits) {
    const category = habitCategory(habit);
    const row = document.createElement("div");
    row.className = "action-row";
    row.dataset.category = category;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "habit";
    button.dataset.kind = habit.id;
    const artwork = document.createElement("span");
    artwork.className = "action-art habit-art";
    artwork.dataset.art = category === "other" ? ({ study: "study", move: "exercise" }[habit.id] ?? "other") : category;
    artwork.setAttribute("aria-hidden", "true");
    const chip = document.createElement("span");
    chip.className = "habit-category";
    chip.dataset.category = category;
    chip.textContent = actionCategories.get(category);
    const copy = document.createElement("span");
    copy.className = "habit-copy";
    const name = document.createElement("strong");
    name.textContent = habit.name;
    copy.append(name);
    if (habit.description) {
      const description = document.createElement("small");
      description.textContent = habit.description;
      description.title = habit.description;
      copy.append(description);
    }
    const side = document.createElement("span");
    side.className = "habit-side";
    const reward = document.createElement("span");
    reward.className = "habit-reward";
    const spark = document.createElement("i");
    spark.className = "action-art action-spark";
    spark.setAttribute("aria-hidden", "true");
    const rewardAmount = document.createElement("span");
    reward.append(spark, rewardAmount);
    const control = document.createElement("span");
    control.className = "action-art habit-control";
    control.setAttribute("aria-hidden", "true");
    side.append(reward, control);
    button.append(artwork, chip, copy, side);
    button.addEventListener("click", () => toggleActionCompletion(habit.id));

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "action-edit";
    edit.title = "编辑行动";
    edit.setAttribute("aria-label", `编辑${habit.name}`);
    edit.innerHTML = icon("edit-action");
    edit.addEventListener("click", () => openActionEditor(habit.id));
    row.append(button, edit);
    el.habits.append(row);
    habitButtons.set(habit.id, { row, button, edit, rewardAmount });
  }
  filterHabits();
}

function openActionEditor(id) {
  const habit = state.habits.find(item => item.id === id);
  editingHabit = habit?.id;
  el["action-editor-title"].textContent = habit ? "编辑行动" : "新增行动";
  el["action-name"].value = habit?.name ?? "";
  el["action-name"].setCustomValidity("");
  el["action-description"].value = habit?.description ?? "";
  el["action-category"].value = habit ? habitCategory(habit) : actionFilter === "all" ? "other" : actionFilter;
  el["action-reward"].value = actionReward(habit);
  el["action-editor-status"].textContent = "";
  el["delete-action"].hidden = !habit;
  el["create-action"].hidden = Boolean(habit);
  el["action-editor-form"].hidden = false;
  el["action-delete-confirm"].hidden = true;
  el["action-editor"].showModal();
  el["action-name"].focus();
}

function saveHabits(habits) {
  const previous = state.habits;
  state.habits = habits;
  if (!saveState()) {
    state.habits = previous;
    el["action-editor-status"].textContent = "浏览器无法保存此次修改。";
    return false;
  }
  renderHabits();
  updateControls();
  return true;
}

function setActionEditMode(editing) {
  el.habits.classList.toggle("is-editing", editing);
  el["toggle-action-edit"].setAttribute("aria-pressed", String(editing));
}

el["toggle-action-edit"].addEventListener("click", () => {
  setActionEditMode(!el.habits.classList.contains("is-editing"));
});
el["add-action"].addEventListener("click", () => openActionEditor());
el["open-action-log"].addEventListener("click", () => showJournal());
el["action-editor-form"].addEventListener("input", () => {
  const name = el["action-name"].value.trim();
  el["action-name"].setCustomValidity(name ? "" : "请输入行动名称。");
  if (!editingHabit) return;
  if (!name) {
    el["action-editor-status"].textContent = "请输入行动名称后自动保存。";
    return;
  }
  const reward = el["action-reward"].valueAsNumber;
  if (!el["action-reward"].validity.valid) {
    el["action-editor-status"].textContent = "请输入大于等于 1 的整数作为生命力奖励。";
    return;
  }
  if (!state.habits.some(habit => habit.id === editingHabit)) {
    el["action-editor-status"].textContent = "该行动已被删除。";
    return;
  }
  const description = el["action-description"].value.trim();
  const category = el["action-category"].value;
  const habits = state.habits.map(habit => habit.id === editingHabit ? { ...habit, name, description, category, reward } : habit);
  if (saveHabits(habits)) el["action-editor-status"].textContent = "已保存";
});
el["action-editor-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (editingHabit) return;
  const name = el["action-name"].value.trim();
  if (!name) {
    el["action-name"].setCustomValidity("请输入行动名称。");
    el["action-name"].reportValidity();
    return;
  }
  const description = el["action-description"].value.trim();
  const category = el["action-category"].value;
  const reward = el["action-reward"].valueAsNumber;
  const id = crypto.randomUUID?.() ?? `action-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  const habit = { id, name, description, category, reward };
  if (saveHabits([...state.habits, habit])) el["action-editor"].close();
});
el["delete-action"].addEventListener("click", () => {
  const habit = state.habits.find(item => item.id === editingHabit);
  if (!habit) return;
  el["action-delete-message"].textContent = `删除「${habit.name}」？已记录的行动和生命力会保留。`;
  el["action-editor-form"].hidden = true;
  el["action-delete-confirm"].hidden = false;
  el["action-editor-status"].textContent = "";
  el["cancel-action-delete"].focus();
});
el["cancel-action-delete"].addEventListener("click", () => {
  el["action-delete-confirm"].hidden = true;
  el["action-editor-form"].hidden = false;
  el["action-editor-status"].textContent = "";
  el["delete-action"].focus();
});
el["confirm-action-delete"].addEventListener("click", () => {
  if (saveHabits(state.habits.filter(habit => habit.id !== editingHabit))) el["action-editor"].close();
});
el["action-editor"].addEventListener("close", () => {
  if (!el.actions.open) return;
  const habit = habitButtons.get(editingHabit);
  const edit = el.habits.classList.contains("is-editing") && habit && !habit.row.hidden && habit.edit;
  (edit || el["add-action"]).focus();
});

function playerLevel() {
  let level = 1;
  let xp = state.player.xp;
  let needed = 200;
  while (level < maxPlayerLevel && xp >= needed) {
    xp -= needed;
    level++;
    needed += 80;
  }
  return { level, xp, needed };
}

function updatePlayer() {
  const { level, xp, needed } = playerLevel();
  const atMaxLevel = level === maxPlayerLevel;
  el["player-name"].textContent = state.player.name;
  el["player-level"].textContent = `${level} 级`;
  el["player-title"].textContent = ranks[Math.floor(level / 10)];
  el["player-xp"].max = needed;
  el["player-xp"].value = atMaxLevel ? needed : xp;
  el["player-xp"].setAttribute("aria-label", atMaxLevel ? "已满级" : "升级经验");
  el["player-xp-label"].textContent = atMaxLevel ? "已满级" : `${xp} / ${needed} 经验`;
  el["player-gold"].textContent = state.player.gold;
  const avatar = state.player.avatar || defaultAvatar;
  el["player-avatar-image"].src = avatar;
  el["profile-avatar-preview"].src = avatar;
  el["open-profile"].classList.toggle("custom-avatar", Boolean(state.player.avatar));
  el["profile-avatar-preview"].classList.toggle("custom-avatar", Boolean(state.player.avatar));
  el["reset-avatar"].hidden = !state.player.avatar;
}

function isOpenPlot(index) {
  return Number.isInteger(index) && index >= 0 && index < plots.length
    && (index < starterPlots || state.reclaimedPlots.includes(index));
}

function nextExpansion() {
  const canReclaim = index => !isOpenPlot(index) && !state.trees.some(tree => tree.plot === index);
  const index = canReclaim(firstExpansionPlot) ? firstExpansionPlot : plots.findIndex((_, index) => canReclaim(index));
  if (index < 0) return null;
  const step = state.reclaimedPlots.length;
  return { index, level: 5 * (step + 1), price: 30 + 10 * step };
}

function updateExpansionDialog() {
  const next = nextExpansion();
  const eligible = next && playerLevel().level >= next.level;
  const affordable = next && state.player.gold >= next.price;
  el["reclaim-confirm"].disabled = !eligible || !affordable;
  el["reclaim-detail"].textContent = next
    ? `开垦需达到 ${next.level} 级，花费 ${next.price} 金币。你有 ${state.player.gold} 金币。`
    : "目前没有可开垦的地块。";
  el["reclaim-status"].textContent = !next ? "" : !eligible ? `升到 ${next.level} 级后即可开垦。` : !affordable ? `还差 ${next.price - state.player.gold} 金币。` : "";
  return eligible && affordable ? next : null;
}

function updateControls() {
  const day = todayKey();
  displayedDay = day;
  updatePlayer();
  const completed = new Map(state.entries.filter(entry => entry.date === day).map(entry => [entry.kind, entry]));
  let completedCount = 0;
  let possibleReward = 0;
  for (const habit of state.habits) {
    const { button, rewardAmount } = habitButtons.get(habit.id);
    const entry = completed.get(habit.id);
    const done = Boolean(entry);
    const reward = actionReward(entry ?? habit);
    if (done) completedCount++;
    possibleReward += reward;
    button.setAttribute("aria-pressed", String(done));
    button.setAttribute("aria-label", habit.name);
    button.setAttribute("aria-description", [actionCategories.get(habitCategory(habit)), habit.description, `${reward} 点生命力`].filter(Boolean).join("，"));
    button.title = done ? "取消完成" : "标记完成";
    rewardAmount.textContent = `+${reward}`;
  }
  const count = document.createElement("span");
  count.textContent = completedCount;
  el["action-count"].replaceChildren(count, ` / ${state.habits.length}`);
  const progress = state.habits.length ? completedCount / state.habits.length : 0;
  el["action-progress"].style.setProperty("--progress", `${progress * 100}%`);
  for (const [index, leaf] of [...el["action-progress"].querySelectorAll("i")].entries()) {
    leaf.classList.toggle("is-complete", index < Math.floor(progress * 5));
  }
  el["action-total"].textContent = `+${possibleReward}`;
  el["action-streak"].textContent = dailyActionStreak(day);
  el["action-bonus-copy"].classList.toggle("is-earned", completed.has(dailyActionBonus));

  const balance = availableEnergy();
  const pending = state.entries.reduce((total, entry) => entry.collected ? total : total + actionReward(entry), 0);
  el.balance.textContent = balance;
  el["shop-balance"].textContent = balance;
  el["plant-balance"].textContent = balance;
  el["collect-life"].disabled = pending === 0;
  el["pending-life"].hidden = pending === 0;
  el["pending-life"].textContent = `+${pending}`;
  el["collect-life"].setAttribute("aria-label", pending ? `收取 ${pending} 点生命力，当前 ${balance}` : `生命力 ${balance}`);
  const hasSeedlings = state.seedlings.length > 0;
  const hasOpenSoil = [...el.plots.children].some(button => !button.disabled && !button.matches(".locked, .planted"));
  const canPlant = hasOpenSoil && (hasSeedlings || balance >= minimumPrice);
  const { level } = playerLevel();
  for (const [id, { card, buy, stock, choice, choicePrice }] of plantOptions) {
    const { name, price, unlockLevel } = plants.get(id);
    const owned = state.seedlings.filter(seedling => seedling.species === id).length;
    const locked = level < unlockLevel;
    card.classList.toggle("is-locked", locked);
    buy.disabled = locked || balance < price;
    buy.textContent = locked ? `${unlockLevel} 级解锁` : "购买";
    buy.setAttribute("aria-label", locked ? `${name}，${unlockLevel} 级解锁` : `购买${name}，${price} 点生命力`);
    stock.textContent = `库存 ${owned}`;
    choice.disabled = !owned && (locked || balance < price);
    choicePrice.textContent = owned ? `使用库存（${owned}）` : locked ? `${unlockLevel} 级解锁` : `${price} 点生命力`;
  }
  for (const [id, { buy, stock, use, useStock }] of fertilizerOptions) {
    const owned = state.fertilizerPurchases.filter(purchase => purchase.id === id && !purchase.used).length;
    buy.disabled = balance < fertilizers.get(id).price;
    stock.textContent = `库存 ${owned}`;
    use.disabled = owned === 0;
    useStock.textContent = `库存 ${owned}`;
  }
  for (const button of el.plots.children) {
    button.classList.toggle("ready", canPlant && !activeTool && !button.matches(".locked, .planted"));
  }
  if (el["reclaim-dialog"].open) updateExpansionDialog();
  if (el["farm-inventory"].open) renderInventory();
  if (el.warehouse.open) renderWarehouse();
}

function plotGeometry(row, column) {
  const points = [field[row][column], field[row][column + 1], field[row + 1][column + 1], field[row + 1][column]];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const corners = points.map(([x, y]) => [(x - left) / width * 100, (y - top) / height * 100]);
  return {
    left, top, width, height,
    rootX: xs.reduce((sum, x) => sum + x, 0) / 4,
    rootY: ys.reduce((sum, y) => sum + y, 0) / 4,
    corners,
  };
}

function roundedTile(corners) {
  const toward = (from, to) => from.map((value, axis) => value + (to[axis] - value) * .1);
  const position = ([x, y]) => `${x}% ${y}%`;
  const segments = corners.map((corner, index) => {
    const before = toward(corner, corners[(index + 3) % 4]);
    const after = toward(corner, corners[(index + 1) % 4]);
    return `line to ${position(before)}, curve to ${position(after)} with ${position(corner)}`;
  });
  return `shape(from ${position(toward(corners[3], corners[0]))}, ${segments.join(", ")}, close)`;
}

function renderPlots(growingIndex = -1) {
  const now = Date.now();
  const next = nextExpansion();
  previewCrop(null);
  el.plots.replaceChildren();
  for (const [index, [row, column]] of plots.entries()) {
    const tree = state.trees.find(entry => entry.plot === index);
    const locked = !tree && !isOpenPlot(index);
    const hasSign = next?.index === index;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.plot = index;
    button.className = tree ? "plot planted" : "plot";
    button.classList.toggle("locked", locked);
    const { left, top, width, height, rootX, rootY, corners } = plotGeometry(row, column);
    button.style.left = `${left / sceneWidth * 100}%`;
    button.style.top = `${top / sceneHeight * 100}%`;
    button.style.width = `${width / sceneWidth * 100}%`;
    button.style.height = `${height / sceneHeight * 100}%`;
    button.style.setProperty("--tile-outline", `polygon(${corners.map(([x, y]) => `${x}% ${y}%`).join(", ")})`);
    button.style.setProperty("--root-x", `${(rootX - left) / width * 100}%`);
    button.style.setProperty("--root-y", `${(rootY - top) / height * 100}%`);
    button.style.zIndex = hasSign ? sceneHeight : Math.round(rootY);
    const extraColumn = column === fieldColumns - 1;
    if (locked || extraColumn) {
      const source = locked ? turfSamples[row] : plotGeometry(row, column - 1);
      const art = document.createElement("span");
      art.className = extraColumn ? "tile-art tile-art-edge" : "tile-art";
      if (locked) art.classList.add("tile-turf");
      art.style.clipPath = roundedTile(corners);
      art.style.backgroundSize = `${sceneWidth / source.width * 100}% ${sceneHeight / source.height * 100}%`;
      art.style.backgroundPosition = `${source.left / (sceneWidth - source.width) * 100}% ${source.top / (sceneHeight - source.height) * 100}%`;
      button.append(art);
    }
    button.insertAdjacentHTML("beforeend", '<span class="tile-face"></span>');
    if (tree) {
      if (index === growingIndex) button.classList.add("growing");
      const sprite = document.createElement("img");
      sprite.alt = "";
      button.append(sprite);
      updatePlotGrowth(tree, button, now);
    } else if (hasSign) {
      button.setAttribute("aria-label", `${next.level} 级可扩建，查看开垦条件`);
      button.insertAdjacentHTML("beforeend", `<span class="expansion-sign" aria-hidden="true"><strong>${next.level}级</strong><small>可扩建</small></span>`);
      button.addEventListener("click", () => {
        updateExpansionDialog();
        el["reclaim-dialog"].showModal();
      });
    } else if (locked) {
      button.disabled = true;
      button.setAttribute("aria-label", "未开垦的田地");
    } else {
      button.setAttribute("aria-label", `在第 ${index + 1} 块空地种植`);
    }
    if (!locked) button.addEventListener("click", () => interactWithPlot(index));
    el.plots.append(button);
  }
}

function renderOrbs() {
  const pending = state.entries.filter(entry => !entry.collected).slice(0, orbOffsets.length);
  for (const button of el.orbs.querySelectorAll(".orb:not(.fly)")) {
    if (!pending.some(entry => entry.id === button.dataset.entry)) button.remove();
  }
  for (const [index, entry] of pending.entries()) {
    const [x, y] = orbOffsets[index];
    let button = [...el.orbs.children].find(orb => orb.dataset.entry === entry.id && !orb.classList.contains("fly"));
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "orb";
      button.dataset.entry = entry.id;
      button.addEventListener("click", () => collect(entry.id));
      el.orbs.append(button);
    }
    const reward = actionReward(entry);
    button.setAttribute("aria-label", `收取 ${reward} 点生命力 · ${actionRecordLabel(entry)}`);
    button.title = `${reward} 点生命力`;
    button.dataset.rewardTier = Math.min(reward, 3);
    button.style.setProperty("--x", `calc(${orbCenter[0]}% + ${x} * var(--orb-spacing))`);
    button.style.setProperty("--y", `calc(${orbCenter[1]}% + ${y} * var(--orb-spacing))`);
  }
}

function actionRecordLabel(entry) {
  return entry.actionLabel ?? defaultHabits[entry.kind]?.description ?? "示例生命力";
}

function toggleActionCompletion(kind) {
  const date = todayKey();
  const index = state.entries.findIndex(entry => entry.date === date && entry.kind === kind);
  if (index < 0) {
    record(kind);
    return;
  }

  const status = el["action-status"];
  const entry = state.entries[index];
  const spent = spentEnergyIds();
  if ([...spent].some(id => energyEntryId(id) === entry.id)) {
    status.textContent = "❌这项行动的生命力已花费，无法取消完成。";
    return;
  }

  const today = state.entries.filter(item => item.date === date && item.kind !== dailyActionBonus && item.kind !== "sample");
  const bonus = today.length <= dailyActionGoal && state.entries.find(item => item.date === date && item.kind === dailyActionBonus);
  if (bonus && spent.has(bonus.id)) {
    status.textContent = "今日达成奖励已花费，取消这项行动会低于 5 项，无法撤销。";
    return;
  }
  const previous = state.entries;
  state.entries = previous.filter(item => item !== entry && item !== bonus);
  if (!saveState()) {
    state.entries = previous;
    status.textContent = "浏览器无法保存，取消完成失败。";
    return;
  }
  renderOrbs();
  updateControls();
  const deducted = (entry.collected ? actionReward(entry) : 0) + (bonus?.collected ? 1 : 0);
  status.textContent = deducted ? `已取消完成，扣回 ${deducted} 点生命力。` : "已取消完成，待领取的生命力已撤回。";
}

function record(kind) {
  const date = todayKey();
  const id = date + ":" + kind;
  const habit = state.habits.find(habit => habit.id === kind);
  if (!habit || state.entries.some(entry => entry.id === id)) return;
  const actionLabel = habit.description ? `${habit.name} · ${habit.description}` : habit.name;
  const reward = actionReward(habit);
  const previousLength = state.entries.length;
  state.entries.push({ id, date, kind, actionLabel, reward, collected: false });
  const today = state.entries.filter(entry => entry.date === date);
  const earnedBonus = today.filter(entry => entry.kind !== dailyActionBonus && entry.kind !== "sample").length >= dailyActionGoal
    && !today.some(entry => entry.kind === dailyActionBonus);
  if (earnedBonus) {
    state.entries.push({ id: `${date}:${dailyActionBonus}`, date, kind: dailyActionBonus, actionLabel: "今日完成 5 项行动奖励", reward: 1, collected: false });
  }
  if (!saveState()) {
    state.entries.length = previousLength;
    el["action-status"].textContent = "浏览器无法保存，标记完成失败。";
    return;
  }
  renderOrbs();
  updateControls();
  el["action-status"].textContent = earnedBonus
    ? `已完成 ${dailyActionGoal} 项行动，额外获得 1 点待领取生命力。`
    : `已标记完成，${reward} 点生命力可在家门口领取。`;
}

function animateCollection(entries) {
  const ids = new Set(entries.map(entry => entry.id));
  const target = el.balance.getBoundingClientRect();
  for (const orb of el.orbs.children) {
    if (!ids.has(orb.dataset.entry)) continue;
    const source = orb.getBoundingClientRect();
    orb.style.setProperty("--dx", `${(target.left + (target.width - source.width) / 2 - source.left) / sceneZoom}px`);
    orb.style.setProperty("--dy", `${(target.top + (target.height - source.height) / 2 - source.top) / sceneZoom}px`);
    orb.disabled = true;
    orb.classList.add("fly");
    setTimeout(() => orb.remove(), 500);
  }
}

function collect(id) {
  const entries = state.entries.filter(entry => !entry.collected && (!id || entry.id === id));
  if (!entries.length) return;
  for (const entry of entries) entry.collected = true;
  if (!saveState()) {
    for (const entry of entries) entry.collected = false;
    notify("浏览器无法保存，收取生命力失败。");
    return;
  }
  animateCollection(entries);
  renderOrbs();
  updateControls();
  const reward = entries.reduce((total, entry) => total + actionReward(entry), 0);
  notify(`收到了 ${reward} 点生命力`);
  const focusTarget = el["collect-life"].disabled ? el["open-actions"] : el["collect-life"];
  focusTarget.focus({ preventScroll: true });
}

function showPlantPicker(index) {
  if (!isOpenPlot(index)) return;
  if (!state.seedlings.length && availableEnergy() < minimumPrice) {
    notify(`种植至少需要 ${minimumPrice} 点生命力`);
    return;
  }
  selectedPlot = index;
  el["plant-picker"].showModal();
}

function buySeedling(id) {
  const species = plants.get(id);
  if (playerLevel().level < species.unlockLevel) {
    el["shop-status"].textContent = `${species.name}将在 ${species.unlockLevel} 级解锁。`;
    return;
  }
  const energyIds = availableEnergyIds(species.price);
  if (energyIds.length < species.price) {
    el["shop-status"].textContent = "生命力不足。";
    return;
  }
  state.seedlings.push({ species: id, energyIds });
  saveState();
  updateControls();
  el["shop-status"].textContent = `已购入 1 株${species.name}种苗。点空地即可种植。`;
}

function buyFertilizer(id) {
  const fertilizer = fertilizers.get(id);
  const energyIds = availableEnergyIds(fertilizer.price);
  if (energyIds.length < fertilizer.price) {
    el["shop-status"].textContent = "生命力不足。";
    return;
  }
  state.fertilizerPurchases.push({ id, energyIds });
  saveState();
  updateControls();
  el["shop-status"].textContent = `已购入 1 袋${fertilizer.name}。点开未成熟的植物即可施用。`;
}

function useFertilizer(id) {
  if (!el.journal.open) return;
  const tree = state.trees.find(plant => plant.plot === journalPlot);
  if (!tree) return;
  const status = el["fertilizer-status"];
  const remaining = maturityTarget(tree) - growthPoints(tree, Date.now());
  if (remaining === 0) {
    refreshGrowth();
    status.textContent = "这株植物已经成熟。";
    return;
  }
  const purchase = state.fertilizerPurchases.find(item => item.id === id && !item.used);
  if (!purchase) {
    status.textContent = "这款化肥的库存不足。";
    return;
  }
  const boost = Math.min(fertilizers.get(id).boost, remaining);
  purchase.used = true;
  tree.fertilizerBoost = (tree.fertilizerBoost ?? 0) + boost;
  saveState();
  updateControls();
  refreshGrowth();
  if (el["fertilizer-options"].hidden || document.activeElement?.disabled) {
    el["growth-progress"].focus({ preventScroll: true });
  }
  status.textContent = `已施肥，生长值 +${boost}。`;
}

function plant(index, species) {
  if (!isOpenPlot(index)) {
    notify("这块地需要先开垦才能种植。");
    return;
  }
  if (state.trees.some(tree => tree.plot === index)) {
    notify("这块地已经种上植物，请选另一格");
    return;
  }
  const { name, price, maturity, unlockLevel } = plants.get(species);
  const stockIndex = state.seedlings.findIndex(seedling => seedling.species === species);
  let energyIds;
  if (stockIndex >= 0) {
    energyIds = state.seedlings.splice(stockIndex, 1)[0].energyIds;
  } else {
    if (playerLevel().level < unlockLevel) {
      notify(`${name}将在 ${unlockLevel} 级解锁。`);
      return;
    }
    energyIds = availableEnergyIds(price);
    if (energyIds.length < price) {
      notify(`种植${name}需要 ${price} 点生命力`);
      return;
    }
  }
  state.trees.push({
    plot: index, species, date: todayKey(), plantedAt: Date.now(),
    growthTarget: maturity, growthInterval: naturalGrowthInterval, energyIds,
  });
  saveState();
  renderPlots(index);
  updateControls();
  el.plots.querySelector(`[data-plot="${index}"]`).focus({ preventScroll: true });
  notify(`${name}种下了，点它可以回看行动`);
}

function showJournal(tree) {
  const content = el["journal-content"];
  journalPlot = tree?.plot;
  el.journal.dataset.view = tree ? "crop" : "history";
  el["journal-kicker"].hidden = !tree;
  el["journal-records-title"].textContent = tree ? "行动来源" : "行动记录";
  el["fertilizer-panel"].hidden = !tree;
  el["fertilizer-status"].textContent = "";
  content.replaceChildren();
  if (tree) {
    const now = Date.now();
    el["journal-title"].textContent = plantAppearance(tree, now).name;
    updateJournalGrowth(tree, now);
  } else {
    el["journal-title"].textContent = "森林手记";
    el["journal-cover-art"].src = "./assets/forest-journal.webp";
  }
  const sourceIds = tree && new Set(tree.energyIds.map(energyEntryId));
  const entries = tree
    ? state.entries.filter(entry => sourceIds.has(entry.id))
    : state.entries.filter(entry => entry.kind !== "sample").reverse();
  el["journal-count"].textContent = `${entries.length} 条记录`;
  el["journal-count"].hidden = entries.length === 0;
  renderJournalRecords(content, entries, Boolean(tree));
  el.journal.showModal();
  el.journal.scrollTop = 0;
  content.scrollTop = 0;
}

function renderJournalRecords(content, entries, isCrop) {
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "journal-empty";
    const sprout = document.createElement("img");
    sprout.src = "./assets/warehouse/sprout-tag.webp";
    sprout.alt = "";
    const message = document.createElement("p");
    message.textContent = isCrop ? "这株作物没有关联的行动记录。" : "完成一项今日行动，就会在这里留下记录。";
    empty.append(sprout, message);
    if (!isCrop) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journal-start";
      button.textContent = "去今日行动";
      button.addEventListener("click", () => {
        el.journal.close();
        if (!el.actions.open) showActions();
      });
      empty.append(button);
    }
    content.append(empty);
    return;
  }

  const entriesByDate = new Map();
  for (const entry of entries) {
    const date = entry.date ?? "";
    if (!entriesByDate.has(date)) entriesByDate.set(date, []);
    entriesByDate.get(date).push(entry);
  }
  const currentYear = todayKey().slice(0, 4);
  for (const [date, records] of [...entriesByDate].sort(([a], [b]) => b.localeCompare(a))) {
    const heading = document.createElement("h4");
    heading.className = "journal-date";
    if (date) {
      const time = document.createElement("time");
      time.dateTime = date;
      const year = date.slice(0, 4);
      time.textContent = year === currentYear ? formatDate(date) : `${year}年${formatDate(date)}`;
      heading.append(time);
    } else {
      heading.textContent = "体验版赠送";
    }
    const list = document.createElement("ul");
    list.className = "journal-list";
    for (const entry of records) {
      const item = document.createElement("li");
      item.textContent = actionRecordLabel(entry);
      list.append(item);
    }
    content.append(heading, list);
  }
}

function selectTool(id) {
  activeTool = activeTool === id ? undefined : id;
  for (const key of fieldTools.keys()) {
    el["tool-" + key].setAttribute("aria-pressed", String(activeTool === key));
  }
  hideToolCursor();
  const tool = fieldTools.get(activeTool);
  if (tool?.followsPointer) {
    el["tool-cursor"].src = `./assets/tools/${tool.artwork}.webp`;
    el["tool-cursor"].dataset.tool = activeTool;
  }
  updateControls();
  if (activeTool) cameraTo(875, true, 585);
  notify(activeTool ? fieldTools.get(activeTool).hint : "已退出工具模式。");
}

function hideToolCursor() {
  el["tool-cursor"].hidden = true;
  el.camera.classList.remove("tool-cursor-active");
}

el.camera.addEventListener("pointermove", event => {
  if (event.pointerType === "touch" || !fieldTools.get(activeTool)?.followsPointer) {
    hideToolCursor();
    return;
  }
  const cursor = el["tool-cursor"];
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
  cursor.hidden = false;
  el.camera.classList.add("tool-cursor-active");
});
el.camera.addEventListener("pointerleave", hideToolCursor);
window.addEventListener("blur", hideToolCursor);

function removePlant(tree) {
  state.spentPlantEnergyIds.push(...tree.energyIds);
  state.trees.splice(state.trees.indexOf(tree), 1);
  restoreWaitingCrops(state);
  saveState();
  renderPlots();
  updateControls();
  const tile = el.plots.children[tree.plot];
  (tile.disabled ? el.plots.querySelector(".plot:not(:disabled)") : tile)?.focus({ preventScroll: true });
}

function harvest(tree) {
  const id = speciesId(tree);
  const species = plants.get(id);
  if (growthPoints(tree, Date.now()) < maturityTarget(tree)) {
    notify(`${species.name}还未成熟。`);
    return;
  }
  if (el.journal.open) el.journal.close();
  state.warehouse[id] = (state.warehouse[id] ?? 0) + 1;
  state.player.xp += species.xp;
  removePlant(tree);
  notify(`收获了 ${species.name}，经验 +${species.xp}。作物已存入仓库。`);
}

function interactWithPlot(index) {
  const tree = state.trees.find(plant => plant.plot === index);
  if (!activeTool) {
    if (tree) showJournal(tree);
    else showPlantPicker(index);
    return;
  }
  if (!tree) {
    notify("这块地是空的。再次点击工具图标可退出工具模式。");
    return;
  }
  const species = plants.get(speciesId(tree));
  switch (activeTool) {
    case "dig":
      pendingDig = tree;
      el["dig-detail"].textContent = `将移除${species.name}并腾出地块，已花费的生命力不会返还。`;
      el["dig-dialog"].showModal();
      break;
    case "water": {
      const remaining = maturityTarget(tree) - growthPoints(tree, Date.now());
      if (remaining <= 0 || tree.waterBoost) {
        notify(remaining <= 0 ? "这株植物已经成熟。" : "这株植物已经浇过水。");
        return;
      }
      tree.waterBoost = Math.min(waterBoost, remaining);
      saveState();
      refreshGrowth();
      notify(`浇水完成，生长值 +${tree.waterBoost}。`);
      break;
    }
    case "harvest":
      harvest(tree);
      break;
  }
}

function sellCrop(id) {
  if (!(state.warehouse[id] > 0)) return;
  const species = plants.get(id);
  state.warehouse[id]--;
  state.player.gold += species.gold;
  saveState();
  updateControls();
  const grid = el["warehouse-grid"];
  const next = grid.querySelector(`[data-sell="${id}"]`) ?? grid.querySelector("button") ?? el["warehouse-search"];
  next.focus({ preventScroll: true });
  el["warehouse-status"].textContent = `售出 1 份${species.name}，金币 +${species.gold}。`;
}

function renderWarehouse() {
  const query = el["warehouse-search"].value.trim();
  const grid = el["warehouse-grid"];
  const cards = document.createDocumentFragment();
  let totalQuantity = 0;
  let totalValue = 0;
  for (const [id, species] of plants) {
    const quantity = state.warehouse[id] ?? 0;
    if (quantity <= 0) continue;
    totalQuantity += quantity;
    totalValue += quantity * species.gold;
    if (!species.name.includes(query)) continue;

    const card = document.createElement("li");
    card.className = "warehouse-card";
    card.innerHTML = `
      <div class="warehouse-slot"><img src="${species.sprite}" alt="" width="112" height="112"></div>
      <div class="warehouse-card-info">
        <h4>${species.name}</h4>
        <p class="warehouse-quantity">库存 × <strong>${quantity}</strong></p>
        <p class="warehouse-price"><i class="coin-mark" aria-hidden="true"></i><strong>${species.gold}</strong> 金币</p>
      </div>
      <button class="warehouse-sell" type="button" data-sell="${id}" aria-label="卖出 1 份${species.name}，获得 ${species.gold} 金币">
        卖 1 份
      </button>`;
    cards.append(card);
  }
  const hasMatches = cards.childElementCount > 0;
  grid.replaceChildren(cards);
  grid.hidden = !hasMatches;
  el["warehouse-empty"].hidden = hasMatches;
  el["warehouse-empty-text"].textContent = totalQuantity ? "没有找到匹配的作物。" : "仓库还是空的，收获成熟作物后就会存到这里。";
  el["warehouse-count"].textContent = `${totalQuantity.toLocaleString("zh-CN")} 份`;
  el["warehouse-value"].textContent = totalValue.toLocaleString("zh-CN");
  el["warehouse-sell-all"].disabled = totalQuantity === 0;
  el["warehouse-sale-confirm"].disabled = totalQuantity === 0;
  el["warehouse-sale-detail"].textContent = totalQuantity
    ? `将出售仓库中全部 ${totalQuantity.toLocaleString("zh-CN")} 份收获物，获得 ${totalValue.toLocaleString("zh-CN")} 金币。`
    : "仓库里没有可出售的收获物。";
}

function renderInventory() {
  const content = el["inventory-content"];
  const list = document.createElement("ul");
  list.className = "inventory-list";
  for (const [id, species] of plants) {
    const quantity = state.seedlings.filter(item => item.species === id).length;
    if (!quantity) continue;
    const row = document.createElement("li");
    row.textContent = `${species.name}种苗 × ${quantity}`;
    list.append(row);
  }
  for (const [id, fertilizer] of fertilizers) {
    const quantity = state.fertilizerPurchases.filter(item => item.id === id && !item.used).length;
    if (!quantity) continue;
    const row = document.createElement("li");
    row.textContent = `${fertilizer.name} × ${quantity}`;
    list.append(row);
  }
  if (list.children.length) {
    content.replaceChildren(list);
  } else {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "买下的种苗和化肥会存放在这里。";
    content.replaceChildren(empty);
  }
}

el["open-bag"].addEventListener("click", () => {
  renderInventory();
  el["farm-inventory"].showModal();
});
el["open-warehouse"].addEventListener("click", () => {
  el["warehouse-search"].value = "";
  el["warehouse-status"].textContent = "";
  el["warehouse-shelf"].classList.remove("scrollbar-hover");
  renderWarehouse();
  el.warehouse.showModal();
  el["warehouse-shelf"].scrollTop = 0;
});
el.warehouse.addEventListener("pointermove", event => {
  const shelf = el["warehouse-shelf"];
  const bounds = shelf.getBoundingClientRect();
  const nearScrollbar = event.pointerType === "mouse"
    && event.clientX >= bounds.right - 24
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  shelf.classList.toggle("scrollbar-hover", nearScrollbar && shelf.scrollHeight > shelf.clientHeight);
});
el.warehouse.addEventListener("pointerleave", () => el["warehouse-shelf"].classList.remove("scrollbar-hover"));
el["warehouse-search"].addEventListener("input", () => {
  renderWarehouse();
  el["warehouse-shelf"].scrollTop = 0;
});
el["warehouse-grid"].addEventListener("click", event => {
  const button = event.target.closest("button[data-sell]");
  if (button) sellCrop(button.dataset.sell);
});
el["warehouse-sell-all"].addEventListener("click", () => el["warehouse-sale"].showModal());
el["warehouse-sale-form"].addEventListener("submit", event => {
  if (event.submitter !== el["warehouse-sale-confirm"]) return;
  event.preventDefault();
  if (!el["warehouse-sale"].open) return;

  const previousStock = state.warehouse;
  const remainingStock = { ...previousStock };
  let quantity = 0;
  let gold = 0;
  for (const [id, species] of plants) {
    const stock = previousStock[id] ?? 0;
    if (stock <= 0) continue;
    quantity += stock;
    gold += stock * species.gold;
    delete remainingStock[id];
  }
  if (!quantity) return;

  const previousGold = state.player.gold;
  state.warehouse = remainingStock;
  state.player.gold += gold;
  if (!saveState()) {
    state.warehouse = previousStock;
    state.player.gold = previousGold;
    el["warehouse-sale-detail"].textContent = "浏览器无法保存，出售未完成。";
    return;
  }
  el["warehouse-sale"].close();
  el["warehouse-search"].value = "";
  updateControls();
  el.warehouse.querySelector(".dialog-close").focus();
  el["warehouse-status"].textContent = `已出售 ${quantity.toLocaleString("zh-CN")} 份收获物，金币 +${gold.toLocaleString("zh-CN")}。`;
});

function openProfile() {
  el["name-input"].value = state.player.name;
  el["avatar-status"].textContent = "";
  el.profile.showModal();
}

function setAvatar(avatar) {
  const previous = state.player.avatar;
  state.player.avatar = avatar;
  if (!saveState()) {
    state.player.avatar = previous;
    el["avatar-status"].textContent = "浏览器存储不可用，头像未更换。";
    return;
  }
  updatePlayer();
  el["avatar-status"].textContent = avatar ? "头像已保存。" : "已恢复默认头像。";
}

el["open-profile"].addEventListener("click", openProfile);
el["player-name"].addEventListener("click", openProfile);
el["choose-avatar"].addEventListener("click", () => el["avatar-file"].click());
el["reset-avatar"].addEventListener("click", () => {
  setAvatar(undefined);
  if (el["reset-avatar"].hidden) el["choose-avatar"].focus();
});
el["avatar-file"].addEventListener("change", async event => {
  const file = event.currentTarget.files[0];
  event.currentTarget.value = "";
  if (!file) return;

  const status = el["avatar-status"];
  if (file.size > 20 * 1024 * 1024) {
    status.textContent = "请选择 20 MB 以内的 PNG 图片。";
    return;
  }
  el["choose-avatar"].disabled = true;
  el["reset-avatar"].disabled = true;
  try {
    const header = new DataView(await file.slice(0, 8).arrayBuffer());
    if (header.byteLength < 8 || header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a) {
      status.textContent = "请选择有效的 PNG 图片。";
      return;
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    try {
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setAvatar(canvas.toDataURL("image/png"));
    } finally {
      bitmap.close();
    }
  } catch {
    status.textContent = "无法读取这张图片，请换一张 PNG。";
  } finally {
    el["choose-avatar"].disabled = false;
    el["reset-avatar"].disabled = false;
  }
});
el["profile-form"].addEventListener("submit", event => {
  event.preventDefault();
  const name = el["name-input"].value.trim();
  if (!name) return;
  state.player.name = name;
  saveState();
  updatePlayer();
  el.profile.close();
});
const realmNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"];
for (const [index, rank] of ranks.entries()) {
  const item = document.createElement("li");
  const first = index * 10;
  const range = first === maxPlayerLevel ? `${first} 级` : `${first}–${first + 9} 级`;
  item.textContent = `第${realmNumbers[index]}境 · ${range} · ${rank}`;
  el["rank-list"].append(item);
}
for (const id of fieldTools.keys()) {
  el["tool-" + id].addEventListener("click", () => selectTool(id));
}
el["open-toolbox"].addEventListener("click", () => el.toolbox.showModal());
el["open-life-transfer"].addEventListener("click", () => el["life-transfer"].showModal());
el["life-transfer-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (!event.submitter) return;
  const hasMessage = el["life-transfer-message"].value.trim().length > 0;
  el["life-transfer-status"].textContent = `预览 · 已试传 ${event.submitter.value} 点生命力${hasMessage ? "，附有留言" : ""}`;
});
const musicFile = el["music-file"];
const musicPlayer = el["music-player"];
const musicStatus = el["music-status"];
el["open-background-music"].addEventListener("click", () => {
  el["background-music"].showModal();
  musicPlayer.play().catch(error => {
    if (error.name === "AbortError" || musicPlayer.error) return;
    musicStatus.textContent = "未能开始播放，请点播放器的播放按钮重试。";
    musicStatus.hidden = false;
  });
});
musicPlayer.addEventListener("playing", () => { musicStatus.hidden = true; });
el["choose-music"].addEventListener("click", () => musicFile.click());
musicFile.addEventListener("change", () => {
  const file = musicFile.files[0];
  if (!file) return;
  musicFile.value = "";
  musicStatus.hidden = true;
  if (/\.ncm$/i.test(file.name)) {
    musicStatus.textContent = "网页无法播放 NCM 文件，请选择 MP3、WAV 等音频。";
    musicStatus.hidden = false;
    return;
  }
  if (musicPlayer.src.startsWith("blob:")) URL.revokeObjectURL(musicPlayer.src);
  musicPlayer.src = URL.createObjectURL(file);
  musicPlayer.hidden = false;
  el["music-track"].textContent = file.name;
});
musicPlayer.addEventListener("error", () => {
  musicPlayer.hidden = true;
  musicStatus.textContent = "无法播放这份音频，请换一个文件。";
  musicStatus.hidden = false;
});

el["collect-life"].addEventListener("click", () => collect());
el["journal-harvest"].addEventListener("click", () => {
  const tree = state.trees.find(plant => plant.plot === journalPlot);
  if (tree) harvest(tree);
});
el["dig-form"].addEventListener("submit", event => {
  if (event.submitter !== el["dig-confirm"]) return;
  event.preventDefault();
  if (!el["dig-dialog"].open) return;
  el["dig-dialog"].close();
  if (!state.trees.includes(pendingDig)) return;
  removePlant(pendingDig);
  notify("地块已清理。");
});
el["reclaim-form"].addEventListener("submit", event => {
  if (event.submitter !== el["reclaim-confirm"]) return;
  event.preventDefault();
  if (!el["reclaim-dialog"].open) return;
  const next = updateExpansionDialog();
  if (!next) return;

  state.player.gold -= next.price;
  state.reclaimedPlots.push(next.index);
  if (!saveState()) {
    state.reclaimedPlots.pop();
    state.player.gold += next.price;
    el["reclaim-status"].textContent = "浏览器无法保存，开垦未完成。";
    return;
  }
  el["reclaim-dialog"].close();
  renderPlots();
  updateControls();
  el.plots.children[next.index].focus({ preventScroll: true });
  notify(`开垦成功，花费 ${next.price} 金币。`);
});
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && activeTool && !document.querySelector("dialog[open]")) selectTool(activeTool);
});
el.cabin.addEventListener("click", showActions);
el["open-actions"].addEventListener("click", showActions);
el["open-journal"].addEventListener("click", () => showJournal());
el["open-shop"].addEventListener("click", () => {
  el["shop-status"].textContent = "";
  el.shop.showModal();
});
el["purchase-form"].addEventListener("submit", event => {
  if (event.submitter !== el["purchase-confirm"]) return;
  event.preventDefault();
  const dialog = el["purchase-dialog"];
  if (!dialog.open) return;
  const id = event.submitter.value;
  dialog.close();
  if (fertilizers.has(id)) buyFertilizer(id);
  else if (plants.has(id)) buySeedling(id);
});
const shopCategories = [...el["shop-categories"].querySelectorAll("button")];
for (const button of shopCategories) {
  button.addEventListener("click", () => {
    for (const category of shopCategories) {
      const active = category === button;
      category.setAttribute("aria-pressed", String(active));
      el[category.getAttribute("aria-controls")].hidden = !active;
    }
    el["shop-status"].textContent = "";
  });
}
function createShopCard(id, product, artwork) {
  const card = document.createElement("article");
  card.className = "shop-card";
  const preview = document.createElement("div");
  preview.className = "shop-preview";
  preview.append(artwork);
  const details = document.createElement("div");
  details.className = "shop-product";
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = product.name;
  details.append(name);
  if (product.boost) {
    const effect = document.createElement("small");
    effect.className = "shop-boost";
    effect.textContent = `生长值 +${product.boost}`;
    details.append(effect);
  }
  const price = document.createElement("small");
  price.className = "shop-price";
  price.textContent = `${product.price} 点生命力`;
  const stock = document.createElement("small");
  stock.className = "shop-stock";
  const buy = document.createElement("button");
  buy.type = "button";
  buy.textContent = "购买";
  buy.setAttribute("aria-label", `购买${product.name}，${product.price} 点生命力`);
  buy.addEventListener("click", () => {
    const item = product.boost ? `1 袋${product.name}` : `1 株${product.name}种苗`;
    el["purchase-detail"].textContent = `购买 ${item}，需要 ${product.price} 点生命力。`;
    el["purchase-confirm"].value = id;
    el["purchase-dialog"].showModal();
  });
  details.append(price, stock, buy);
  card.append(preview, details);
  return { card, buy, stock };
}

for (const [id, species] of [...plants].sort(([, a], [, b]) => a.unlockLevel - b.unlockLevel)) {
  const sprite = document.createElement("img");
  sprite.src = species.sprite;
  sprite.alt = "";
  const name = document.createElement("span");
  name.textContent = species.name;
  const choice = document.createElement("button");
  choice.type = "button";
  choice.className = "plant-option";
  const choicePrice = document.createElement("small");
  choice.append(sprite.cloneNode(), name, choicePrice);
  choice.addEventListener("click", () => {
    el["plant-picker"].close();
    plant(selectedPlot, id);
  });
  el["plant-options"].append(choice);

  const { card, buy, stock } = createShopCard(id, species, sprite);
  const lock = document.createElement("span");
  lock.className = "shop-lock";
  lock.innerHTML = icon("lock");
  card.append(lock);
  el["shop-plants"].append(card);
  plantOptions.set(id, { card, buy, stock, choice, choicePrice });
}
for (const [id, fertilizer] of fertilizers) {
  const artwork = document.createElement("div");
  artwork.className = "fertilizer-art";
  artwork.dataset.tier = id;
  artwork.innerHTML = icon("fertilizer-sack");
  const { card, buy, stock } = createShopCard(id, fertilizer, artwork);
  el["shop-fertilizer"].append(card);

  const use = document.createElement("button");
  use.type = "button";
  const useName = document.createElement("span");
  useName.textContent = `${fertilizer.name} · +${fertilizer.boost}`;
  const useStock = document.createElement("small");
  use.append(useName, useStock);
  use.addEventListener("click", () => useFertilizer(id));
  el["fertilizer-options"].append(use);
  fertilizerOptions.set(id, { buy, stock, use, useStock });
}
window.addEventListener("storage", event => {
  if (event.key !== storageKey) return;
  state = readState();
  renderHabits();
  renderPlots();
  renderOrbs();
  updateControls();
});
window.addEventListener("focus", () => {
  if (todayKey() !== displayedDay) updateControls();
  refreshGrowth();
});
setInterval(refreshGrowth, 1000);
setInterval(() => {
  if (todayKey() !== displayedDay) updateControls();
}, 30_000);

renderHabits();
renderPlots();
renderOrbs();
updateControls();
cameraTo(875, false);
