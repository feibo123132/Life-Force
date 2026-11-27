"use strict";

const previewAssetUrl = globalThis.forestPreviewAssetUrl;
const forestAssetUrl = path => previewAssetUrl?.(path) ?? path;

const defaultHabits = {
  move: { name: "动一动", description: "晚饭后走 5 分钟", icon: "move" },
  study: { name: "专注学习", description: "专注学 15 分钟", icon: "focus" },
  reflect: { name: "睡前复盘", description: "写一句今天的观察", icon: "reflect" },
  save: { name: "好好存钱", description: "按计划实际存入一笔", icon: "save" },
};
const initialHabits = () => Object.entries(defaultHabits).map(([id, { name, description }]) => ({ id, name, description }));
const defaultActionCategories = new Map([
  ["all", "全部"], ["study", "学习"], ["work", "工作"],
  ["exercise", "锻炼"], ["music", "音乐"], ["inspiration", "灵感"], ["friends", "友人"], ["food", "美食"], ["finance", "理财"], ["value", "价值"], ["other", "其它"],
]);
const legacyDailyActionGoal = 5;
const dailyActionBonus = "daily-action-bonus";
const whaleMoodBonus = "whale-mood-bonus";
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
const paintedField = [
  [[845, 373], [909, 406], [977, 439], [1045, 473], [1119, 508], [1200, 545], [1278, 584]],
  [[783, 405], [845, 438], [911, 473], [982, 507], [1056, 544], [1134, 582], [1212, 622]],
  [[716, 438], [778, 474], [844, 508], [916, 543], [990, 582], [1067, 622], [1145, 663]],
  [[645, 473], [706, 509], [773, 545], [844, 582], [918, 622], [996, 662], [1074, 705]],
  [[568, 511], [630, 547], [696, 585], [766, 623], [840, 665], [918, 705], [996, 750]],
  [[479, 552], [541, 589], [608, 629], [676, 670], [755, 711], [839, 758], [917, 805]],
];
// Artwork samples from the previous valley's raised grass tiles.
const turfSamples = [
  [[1036, 450], [1110, 488], [1040, 525], [970, 486]],
  [[970, 486], [1040, 525], [970, 565], [899, 525]],
  [[899, 525], [970, 565], [897, 606], [826, 564]],
  [[826, 564], [897, 606], [821, 648], [750, 607]],
  [[750, 607], [821, 648], [744, 692], [669, 649]],
];
const fieldSize = 4;
const fieldVersion = 2;
const starterPlots = 5;
function plotOrder(rows, columns) {
  return Array.from({ length: rows * columns }, (_, index) =>
    [Math.floor(index / columns), index % columns]
  ).sort(([aRow, aCol], [bRow, bCol]) => aRow + aCol - bRow - bCol || aCol - bCol);
}

const paintedRows = paintedField.length - 1;
const paintedColumns = paintedField[0].length - 1;
const plots = plotOrder(fieldSize, fieldSize);
const previousPlots = plotOrder(paintedRows, paintedColumns);
const firstExpansionPlot = plots.findIndex(([row, column]) => row === 2 && column === 1);
const interpolatePoint = (from, to, amount) => from.map((value, axis) => value + (to[axis] - value) * amount);

// Retain the existing field footprint while spacing the seams for larger plots.
const field = Array.from({ length: fieldSize + 1 }, (_, row) => {
  const oldRow = row * paintedRows / fieldSize;
  const above = Math.min(Math.floor(oldRow), paintedRows - 1);
  return Array.from({ length: fieldSize + 1 }, (_, column) => {
    const oldColumn = column * paintedColumns / fieldSize;
    const left = Math.min(Math.floor(oldColumn), paintedColumns - 1);
    const topPoint = interpolatePoint(paintedField[above][left], paintedField[above][left + 1], oldColumn - left);
    const bottomPoint = interpolatePoint(paintedField[above + 1][left], paintedField[above + 1][left + 1], oldColumn - left);
    return interpolatePoint(topPoint, bottomPoint, oldRow - above);
  });
});
const sceneWidth = 1672;
const sceneHeight = 941;
const paintedSoilEdge = [
  ...paintedField[0].slice(0, -1),
  ...paintedField.slice(1).map(row => row.at(-2)),
  ...paintedField.at(-1).slice(0, -2).reverse(),
  ...paintedField.slice(1, -1).reverse().map(row => row[0]),
];
const soilCenter = paintedField[2][2];
// Cover the narrow painted border beyond the tile seams.
const soilCover = `polygon(${paintedSoilEdge.map(point => {
  const [x, y] = interpolatePoint(soilCenter, point, 1.02);
  return `${x / sceneWidth * 100}% ${y / sceneHeight * 100}%`;
}).join(", ")})`;
const maxSceneZoom = 1.65;
let sceneZoom = 1;
const orbCenter = [74.2, 50.2];
const orbOffsets = [[-1, -.5], [0, -.5], [1, -.5], [-.5, .5], [.5, .5]];
const maxPlayerLevel = 100;
const levelXpCosts = [0, 200];
for (let level = 2; level <= maxPlayerLevel; level++) {
  levelXpCosts.push(levelXpCosts[level - 1] + 80 + 20 * Math.floor(level / 10));
}

const naturalGrowthInterval = 600_000;
const cropGrowthInterval = previewAssetUrl ? 1_000 : naturalGrowthInterval;
const plantTiers = new Map([
  [1, 10], [10, 12], [20, 14], [30, 16], [40, 18], [50, 20], [55, 22],
  [60, 24], [65, 28], [70, 32], [75, 36], [80, 40], [85, 44], [90, 48],
].map(([unlockLevel, maturityHours], index) => {
  const price = 2 * (index + 1);
  const xp = price * (20 + index);
  const maturity = maturityHours * 3_600_000 / naturalGrowthInterval;
  return [unlockLevel, { unlockLevel, price, xp, gold: xp, maturity }];
}));
const abstractPlantTier = { abstract: true, unlockLevel: maxPlayerLevel, price: 14, maturity: 195, xp: 378, gold: 45 };
const plantPlaceholder = { sprite: "./assets/warehouse/sprout-tag.webp", height: 105 };
const plants = new Map([
  ["reeds", { ...plantTiers.get(1), name: "芦苇", sprite: "./assets/reeds.webp", height: 111, matureScale: 1.25 }],
  ["rice", { ...plantTiers.get(1), name: "水稻", category: "grain", sprite: "./assets/rice.webp", height: 86, matureScale: 1.4 }],
  ["carrot", { ...plantTiers.get(1), name: "胡萝卜", category: "vegetable", sprite: "./assets/carrot.webp", height: 116 }],
  ["broccoli", { ...plantTiers.get(10), name: "西兰花", category: "vegetable", sprite: "./assets/broccoli.webp", height: 102 }],
  ["cabbage", { ...plantTiers.get(10), name: "包菜", category: "vegetable", sprite: "./assets/cabbage.webp", height: 90 }],
  ["lucky-clover", { ...plantTiers.get(10), name: "幸运草", sprite: "./assets/lucky-clover.webp", height: 72 }],
  ["watermelon", { ...plantTiers.get(20), name: "西瓜", category: "fruit", sprite: "./assets/watermelon.webp", height: 95 }],
  ["cantaloupe", { ...plantTiers.get(20), ...plantPlaceholder, name: "哈密瓜", category: "fruit" }],
  ["sunflower", { ...plantTiers.get(30), name: "向日葵", category: "flower", sprite: "./assets/sunflower.webp", height: 122 }],
  ["fir", { ...plantTiers.get(30), name: "杉树", sprite: "./assets/island-fir.webp", height: 170 }],
  ["corn", { ...plantTiers.get(40), name: "玉米", category: "grain", sprite: "./assets/corn.webp", height: 164 }],
  ["pink-rose", { ...plantTiers.get(40), ...plantPlaceholder, name: "粉玫瑰", category: "flower" }],
  ["banana", { ...plantTiers.get(50), name: "香蕉树", category: "fruit", sprite: "./assets/banana-with-basket.webp", height: 170 }],
  ["mock-orange", { ...plantTiers.get(50), name: "山梅花", category: "flower", sprite: "./assets/mock-orange.webp", height: 113 }],
  ["orange", { ...plantTiers.get(55), name: "橘子树", category: "fruit", sprite: "./assets/orange.webp", height: 155 }],
  ["sundae-tree", { ...plantTiers.get(55), name: "圣代树", sprite: "./assets/sundae-tree.webp", height: 153 }],
  ["white-birch", { ...plantTiers.get(60), name: "白桦", sprite: "./assets/white-birch.webp", height: 160 }],
  ["osmanthus", { ...plantTiers.get(65), name: "桂花", category: "flower", sprite: "./assets/osmanthus.webp", height: 150 }],
  ["willow", { ...plantTiers.get(65), name: "柳树", sprite: "./assets/willow.webp", height: 158 }],
  ["ginkgo", { ...plantTiers.get(70), name: "银杏", sprite: "./assets/ginkgo.webp", height: 158 }],
  ["cherry", { ...plantTiers.get(75), name: "樱花树", category: "flower", sprite: "./assets/cherry.webp", height: 155 }],
  ["plum-blossom", { ...plantTiers.get(80), name: "梅花", category: "flower", sprite: "./assets/plum-blossom.webp", height: 152 }],
  ["pear-treehouse", { ...plantTiers.get(85), ...plantPlaceholder, name: "梨子树屋", category: "fruit" }],
  ["rainbow-eucalyptus", { ...plantTiers.get(85), ...plantPlaceholder, name: "彩虹桉" }],
  ["wish-tree", { ...plantTiers.get(85), name: "祈愿树", sprite: "./assets/wish-tree.webp", height: 163 }],
  ["golden-trumpet-tree", { ...plantTiers.get(90), name: "黄花风铃木", category: "flower", sprite: "./assets/golden-trumpet-tree.webp", height: 160 }],
  ["moon-gourd", {
    ...abstractPlantTier,
    name: "奶娃金葫芦",
    sprite: "./assets/moon-gourd.webp",
    height: 144,
  }],
  ["ikun-tree", {
    ...abstractPlantTier,
    name: "树坤",
    sprite: "./assets/ikun-tree.webp",
    height: 170,
  }],
]);
const halfMaturityRatio = 1 / 3;
const growthStages = [
  { label: "成熟期", ratio: 1, scale: 1 },
  { label: "半成熟期", ratio: halfMaturityRatio, scale: 0.73, asset: "young" },
  { label: "幼苗期", ratio: 0, scale: 0.43, asset: "seedling" },
];
const plantPickerCategories = {
  all: ["全部", "🍃"], grain: ["粮食", "🌾"], vegetable: ["蔬菜", "🥕"],
  flower: ["花卉", "🌸"], fruit: ["水果", "🌳"], other: ["其它", "🌿"],
};
const ranks = [
  "林间学徒", "苗圃培育师", "果园管事", "林地守护者", "森林培育大师",
  "林海守望者", "古树培育宗师", "万木贤者", "林海领主", "森林传奇", "生命森林宗师",
];
const waterBoost = 10;
const fieldTools = new Map([
  ["dig", { artwork: "dig", followsPointer: true, hint: "选择一株植物，再确认是否清除。" }],
  ["water", { artwork: "water", followsPointer: true, hint: `点一株未成熟的植物。每株可浇水一次，增加 ${waterBoost} 点生长值。` }],
  ["harvest", { artwork: "harvest-hand", followsPointer: true, hint: "点一株成熟的植物，获得经验并将作物放入仓库。" }],
]);
const fertilizers = new Map([
  ["basic", { name: "初级化肥", price: 2, boost: 15 }],
  ["standard", { name: "中级化肥", price: 4, boost: 30 }],
  ["premium", { name: "高级化肥", price: 7, boost: 60 }],
]);
const minimumPrice = Math.min(...Array.from(plants.values(), plant => plant.price));
const storageKey = previewAssetUrl ? "life-forest-preview-v1" : "life-forest-v2";
const demoStorageKey = previewAssetUrl ? "life-forest-preview-demo-v1" : "life-forest-demo-v1";
const defaultAvatar = "./assets/growth/fir-seedling.webp";
const shortDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });
const calendarMonthFormat = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", timeZone: "UTC" });
const el = Object.fromEntries([...document.querySelectorAll("[id]")].map(node => [node.id, node]));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let selectedPlot;
let selectedPlant;
let journalPlot;
let activeTool;
let sowing;
let pendingDig;
let previewPlot;
let previewOrb;
let calendarDate;
let calendarMonth;
let calendarLastClick;
// 行动面板当前查看的日期：未设置即今天。双击日历时可切到历史某天。
let actionViewDay;
// 主面板最近一次渲染时的真实今天，用于跨天刷新。
let renderedToday;
let inExperiment = false;

function restoreWaitingCrops(save) {
  if (!save.waitingCrops.length) return;
  const occupied = new Set(save.trees.map(tree => tree.plot));
  const held = [];
  const waiting = [];
  for (const tree of save.waitingCrops) {
    if (!tree.waitForExpansion) {
      waiting.push(tree);
    } else if (!occupied.has(tree.plot) && isOpenPlot(tree.plot, save)) {
      const { waitForExpansion, ...restored } = tree;
      save.trees.push(restored);
      occupied.add(tree.plot);
    } else {
      held.push(tree);
    }
  }
  for (const index of plots.keys()) {
    if (!waiting.length) break;
    if (!occupied.has(index) && isOpenPlot(index, save)) {
      save.trees.push({ ...waiting.shift(), plot: index });
    }
  }
  save.waitingCrops = [...waiting, ...held];
}

function migrateField(save) {
  const priorReclaimed = Array.isArray(save.reclaimedPlots) ? save.reclaimedPlots : [];
  const priorWaiting = Array.isArray(save.waitingCrops) ? save.waitingCrops : [];
  if (save.fieldVersion === fieldVersion) {
    return { fieldVersion, trees: save.trees, reclaimedPlots: priorReclaimed, waitingCrops: priorWaiting };
  }

  const reclaimed = [...new Set(priorReclaimed)].filter(index =>
    Number.isInteger(index) && index >= starterPlots && index < previousPlots.length);
  const fieldSave = {
    fieldVersion,
    trees: [],
    reclaimedPlots: reclaimed.filter(index => index < plots.length),
    waitingCrops: [],
  };
  const reclaimedCount = Math.min(reclaimed.length, plots.length - starterPlots);
  for (const index of [firstExpansionPlot, ...plots.keys()]) {
    if (fieldSave.reclaimedPlots.length === reclaimedCount) break;
    if (!isOpenPlot(index, fieldSave)) fieldSave.reclaimedPlots.push(index);
  }

  for (const tree of save.trees) {
    const previous = legacyPlots[tree.plot];
    const plot = Array.isArray(save.reclaimedPlots) ? tree.plot
      : previousPlots.findIndex(([row, column]) => row === previous?.[0] && column === previous?.[1]);
    if (isOpenPlot(plot, fieldSave) && !fieldSave.trees.some(entry => entry.plot === plot)) {
      fieldSave.trees.push({ ...tree, plot });
    } else {
      fieldSave.waitingCrops.push(tree);
    }
  }
  fieldSave.waitingCrops.push(...priorWaiting);
  restoreWaitingCrops(fieldSave);
  return fieldSave;
}

// Preserve the earlier timing correction for crops planted before tiers were introduced.
const legacyCropGrowthTargets = new Map([
  ["carrot", [180, 60]], ["broccoli", [195, 75]], ["cabbage", [210, 60]],
  ["corn", [225, 105]], ["watermelon", [240, 90]], ["orange", [255, 135]],
]);

function migrateCropMaturity(tree) {
  const targets = legacyCropGrowthTargets.get(tree.species);
  if (targets && tree.growthTarget === targets[0]) return { ...tree, growthTarget: targets[1] };
  return tree;
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
  if (tree.forcedMature || !Number.isFinite(tree.plantedAt)) return { target, progress: target, remaining: 0 };
  const interval = tree.growthInterval ?? 1000;
  const boost = (tree.fertilizerBoost ?? 0) + (tree.waterBoost ?? 0) + (tree.ripeningBoost ?? 0);
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
  const name = el["crop-tooltip-name"];
  const artwork = el["crop-tooltip-art"];
  if (name.textContent !== species.name) name.textContent = species.name;
  const sprite = forestAssetUrl(species.sprite);
  if (artwork.getAttribute("src") !== sprite) artwork.src = sprite;
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

function updateOrbTooltip() {
  const tooltip = el["orb-tooltip"];
  const entry = previewOrb && state.entries.find(item => item.id === previewOrb.dataset.entry);
  if (!previewOrb?.isConnected || previewOrb.disabled || !entry || entry.collected) {
    previewOrb?.removeAttribute("aria-describedby");
    previewOrb = undefined;
    tooltip.hidden = true;
    return;
  }

  const orb = previewOrb.getBoundingClientRect();
  const world = el.forest.getBoundingClientRect();
  if (orb.right <= world.left || orb.left >= world.right || orb.bottom <= world.top || orb.top >= world.bottom) {
    tooltip.hidden = true;
    return;
  }

  const reward = actionReward(entry);
  const amount = `+${reward}`;
  const reason = entry.kind === whaleMoodBonus ? "今天鲸鱼娘很开心" : orbActionName(entry);
  tooltip.setAttribute("aria-label", `生命力 ${amount}。${reason}`);
  tooltip.toggleAttribute("data-custom-amount", reward !== 2);
  el["orb-tooltip-amount"].textContent = amount;
  el["orb-tooltip-amount"].style.setProperty("--amount-length", amount.length);
  el["orb-tooltip-reason"].textContent = reason;
  tooltip.hidden = false;
  const centerX = (orb.left + orb.right) / 2 - world.left;
  const centerY = (orb.top + orb.bottom) / 2 - world.top;
  const artWidth = parseFloat(getComputedStyle(previewOrb, "::before").width) * sceneZoom;
  // The sun spans 69% of its sprite; enlarge the reference card ratio by 25%.
  tooltip.style.width = `${artWidth * .69 * 2.35 * 1.25}px`;
  const gap = artWidth * .45;
  const edge = 8;
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const left = Math.max(edge, Math.min(centerX - width / 2, world.width - width - edge));
  const above = centerY - gap - height;
  const top = above < edge ? Math.min(centerY + gap, world.height - height - edge) : above;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(edge, top)}px`;
}

function showOrbTooltip(button) {
  previewOrb?.removeAttribute("aria-describedby");
  previewOrb = button;
  previewOrb?.setAttribute("aria-describedby", "orb-tooltip");
  updateOrbTooltip();
}

function growthStageSprite(id, stage) {
  const { sprite } = plants.get(id);
  const path = stage.asset && sprite !== plantPlaceholder.sprite ? `./assets/growth/${id}-${stage.asset}.webp` : sprite;
  return forestAssetUrl(path);
}

function plantAppearance(tree, now) {
  const id = speciesId(tree);
  const species = plants.get(id);
  const points = growthPoints(tree, now);
  const stage = growthStages.find(candidate => points >= Math.ceil(maturityTarget(tree) * candidate.ratio));
  const stageScale = stage.ratio === 1 ? (species.matureScale ?? stage.scale) : stage.scale;
  const scale = stageScale * 1.2;
  return {
    name: species.name,
    label: stage.label,
    sprite: growthStageSprite(id, stage),
    height: species.height * scale,
    width: 62 * scale,
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
  el["journal-ripening"].hidden = !inExperiment || isMature;
  el["journal-grow-half"].disabled = points >= Math.ceil(maturity * halfMaturityRatio);
}

function refreshGrowth() {
  const now = Date.now();
  for (const tree of state.trees) {
    const plot = el.plots.children[tree.plot];
    if (!plot?.classList.contains("planted")) continue;
    updatePlotGrowth(tree, plot, now);
    if (el.journal.open && journalPlot === tree.plot) updateJournalGrowth(tree, now);
  }
  if (previewPlot) updateCropTooltip(now);
}

function startingState() {
  return {
    habits: initialHabits(),
    customActionCategories: [],
    entries: [],
    trees: [],
    fieldVersion,
    reclaimedPlots: [],
    pendingExpansionPlots: [],
    experimentExpansions: [],
    waitingCrops: [],
    seedlings: [],
    fertilizerPurchases: [],
    spentPlantEnergyIds: [],
    warehouse: {},
    player: { name: "森林旅人", xp: 0, gold: 0, xpScale: 10, xpCurveVersion: 2 },
  };
}

function pruneActionEntries(entries, habits) {
  const activeIds = new Set(habits.map(habit => habit.id));
  const remaining = entries.filter(entry => activeIds.has(entry.kind) || [dailyActionBonus, whaleMoodBonus, "sample"].includes(entry.kind));
  const totals = dailyActionTotals(remaining);
  return remaining.filter(entry => entry.kind !== dailyActionBonus ||
    (totals.get(entry.date) ?? 0) >= (entry.goal ?? legacyDailyActionGoal));
}

// 「伊比理财」原来只能挂在「其它」下，新增「理财」分类后把它挪过去；已手动改过的不覆盖。
function migrateActionCategories(habits) {
  let changed = false;
  for (const habit of habits) {
    if (habit.name?.trim() !== "伊比理财") continue;
    if (habit.category && habit.category !== "other") continue;
    habit.category = "finance";
    changed = true;
  }
  return changed;
}

const forestStorage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, data) => localStorage.setItem(key, data),
};
const forestSave = createForestSaveSync({
  legacyKey: storageKey,
  storage: forestStorage,
  onChange: () => {
    if (inExperiment) readState();
    else refreshSavedForest();
  },
  onStatus: updateForestSyncStatus,
});
const experimentSave = createForestSaveSync({
  legacyKey: previewAssetUrl ? "life-forest-preview-experiment-v1" : "life-forest-experiment-v1",
  storage: forestStorage,
  onChange: () => { if (inExperiment) refreshSavedForest(); },
  onStatus: () => {},
});

function activeForestSave() {
  return inExperiment ? experimentSave : forestSave;
}

function readState(save = forestSave) {
  try {
    // Discard playtest saves without affecting progress made after the reset.
    if (save === forestSave) localStorage.removeItem(demoStorageKey);
    const saved = save.read();
    if (saved && Array.isArray(saved.entries) && Array.isArray(saved.trees)) {
      const habits = (Array.isArray(saved.habits) ? saved.habits : initialHabits()).map(normalizeHabit);
      const habitsMigrated = migrateActionCategories(habits);
      const reclaimed = reclaimWeeklyBugEnergy(pruneActionEntries(saved.entries, habits), habits, saved);
      const entries = reclaimed.entries;
      if (habitsMigrated || reclaimed.changed) {
        try { save.write({ ...saved, habits, entries }); } catch {}
      }
      const field = migrateField(saved);
      const player = { ...startingState().player, ...saved.player };
      // Scale legacy XP once so the new thresholds preserve existing progress.
      if (saved.player?.xpScale !== 10) {
        player.xp *= 10;
        player.xpScale = 10;
      }
      if (saved.player?.xpCurveVersion !== 2) {
        player.xp = migratePlayerXp(player.xp);
        player.xpCurveVersion = 2;
      }
      const pendingExpansionPlots = Array.isArray(saved.pendingExpansionPlots) ? [...saved.pendingExpansionPlots] : [];
      const { level } = playerLevel(player.xp);
      const earlyStep = field.reclaimedPlots.findIndex((_, step) => level < expansionLevel(step));
      if (earlyStep >= 0) {
        // Return fees from the old thresholds and leave those tiles pending a manual purchase.
        for (let step = earlyStep; step < field.reclaimedPlots.length; step++) {
          player.gold += expansionPrice(step);
        }
        pendingExpansionPlots.unshift(...field.reclaimedPlots.slice(earlyStep));
        field.reclaimedPlots = field.reclaimedPlots.slice(0, earlyStep);
      }
      return {
        ...saved,
        ...field,
        pendingExpansionPlots,
        experimentExpansions: save === experimentSave && Array.isArray(saved.experimentExpansions) ? saved.experimentExpansions : [],
        trees: field.trees.map(migrateCropMaturity),
        waitingCrops: Array.isArray(field.waitingCrops) ? field.waitingCrops.map(migrateCropMaturity) : [],
        habits,
        customActionCategories: Array.isArray(saved.customActionCategories)
          ? saved.customActionCategories.filter(category =>
            typeof category?.id === "string" && category.id.startsWith("custom-") &&
            typeof category.label === "string" && category.label.trim())
          : [],
        entries,
        weeklyEnergyReclaimed: reclaimed.amount,
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
  const initial = startingState();
  if (save === experimentSave) {
    initial.entries.push({ id: "experiment:starter", kind: "sample", reward: 100, collected: true });
  }
  return initial;
}

let state = readState();
let noticeTimer;
let displayedDay;

function saveState(snapshot = state, save = activeForestSave()) {
  try {
    save.write(snapshot);
    return true;
  } catch {
    el["storage-note"].textContent = "体验版 · 当前浏览器无法保存，记录仅在本次打开时有效";
    return false;
  }
}

function updateForestSyncStatus(status) {
  const messages = {
    guest: "",
    connecting: "正在读取云端存档…",
    pending: "已保存在此设备，正在上传…",
    synced: "游戏存档已同步。",
    offline: "当前离线，联网后会自动同步。",
    unavailable: "暂时无法同步，改动已保存在此设备。",
    "too-large": "存档超过云端同步大小限制，已保存在此设备。",
    storage: "浏览器存储不可用，暂时无法同步。",
    conflict: "此设备和云端都有不同的进度。选择保留哪份存档，另一份会备份到此浏览器。",
    "conflict-storage": "浏览器空间不足，未能备份存档。请腾出空间后再选择。",
  };
  const conflict = status === "conflict" || status === "conflict-storage";
  el["account-sync-status"].textContent = messages[status];
  el["account-sync-choices"].hidden = !conflict;
  el["account-sync-retry"].hidden = !["unavailable", "offline", "storage"].includes(status);
  el["player-login-status"].textContent = conflict ? "存档冲突" : "已登录";
  el["storage-note"].textContent = messages[status] || "行动、植物与库存保存在此浏览器";
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

let cameraPan;
let suppressPanClick = false;

window.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button === 0) suppressPanClick = false;
}, { capture: true });

el.camera.addEventListener("pointerdown", event => {
  if (event.pointerType !== "mouse" || event.button !== 0 || sceneZoom <= 1) return;
  cameraPan = {
    id: event.pointerId,
    x: event.clientX, y: event.clientY,
    left: el.camera.scrollLeft, top: el.camera.scrollTop,
    dragging: false,
  };
});

window.addEventListener("pointermove", event => {
  if (event.pointerId !== cameraPan?.id || !(event.buttons & 1)) return;
  const dx = event.clientX - cameraPan.x;
  const dy = event.clientY - cameraPan.y;
  if (!cameraPan.dragging) {
    if (Math.hypot(dx, dy) < 5) return;
    cameraPan.dragging = true;
    suppressPanClick = true;
    el.camera.setPointerCapture(event.pointerId);
    el.camera.classList.add("is-panning");
    previewCrop(null);
    showOrbTooltip(null);
    hideToolCursor();
  }
  event.preventDefault();
  event.stopPropagation();
  el.camera.scrollTo({ left: cameraPan.left - dx, top: cameraPan.top - dy, behavior: "instant" });
}, { capture: true, passive: false });

function endCameraPan(event) {
  if (!cameraPan || (event.type !== "blur" && event.pointerId !== cameraPan.id)) return;
  cameraPan = undefined;
  el.camera.classList.remove("is-panning");
}

window.addEventListener("pointerup", endCameraPan, { capture: true });
window.addEventListener("pointercancel", endCameraPan, { capture: true });
window.addEventListener("blur", endCameraPan);
el.camera.addEventListener("lostpointercapture", endCameraPan);
el.camera.addEventListener("dragstart", event => {
  if (cameraPan) event.preventDefault();
});
window.addEventListener("click", event => {
  if (!suppressPanClick || !event.detail) return;
  suppressPanClick = false;
  event.preventDefault();
  event.stopPropagation();
}, { capture: true });

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
  el.camera.classList.toggle("is-zoomed", zoom > 1);
  if (previewOrb) updateOrbTooltip();
}, { passive: false });
el.camera.addEventListener("scroll", () => {
  if (previewPlot) updateCropTooltip();
  if (previewOrb) updateOrbTooltip();
});
window.addEventListener("resize", () => {
  if (previewPlot) updateCropTooltip();
  if (previewOrb) updateOrbTooltip();
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
  if (todayKey() !== renderedToday) updateControls();
  setActionEditMode(false);
  el["action-status"].textContent = "";
  el.actions.showModal();
}

// 「仅今天」的灵感沿用已有的完成记录，旧存档无需补写状态。
function inspirationCompletedOn(habit, entries = state.entries) {
  if (habit.category !== "inspiration") return undefined;
  if (!habit.onlyOn) return habit.inspirationFinishedOn;
  let completedOn;
  for (const entry of entries) {
    if (entry.kind === habit.id && !entry.weekly && entry.date >= habit.onlyOn &&
      (!completedOn || entry.date < completedOn)) completedOn = entry.date;
  }
  return completedOn;
}

// 行动面板与日历共享同一套排期。灵感从开始日期保留到完成当天。
function actionScheduledOn(habit, date, entries = state.entries) {
  if (habit.category !== "inspiration") return !habit.onlyOn || habit.onlyOn === date;
  const completedOn = inspirationCompletedOn(habit, entries);
  return (!habit.onlyOn || habit.onlyOn <= date) && (!completedOn || date <= completedOn);
}

// 历史行动可以补记，已完成的一次性灵感只允许撤回已有记录。
function actionAvailableOn(habit, date, today) {
  if (date > today || !actionVisibleOn(habit, date)) return false;
  const completedOn = habit.onlyOn && inspirationCompletedOn(habit);
  return !completedOn || date === completedOn
    || state.entries.some(entry => entry.kind === habit.id && entry.date === date && !entry.weekly);
}

function actionVisibleOn(habit, date) {
  return actionScheduledOn(habit, date) || state.entries.some(entry => entry.kind === habit.id && entry.date === date && !entry.weekly);
}

// daily = 日常行动，weekly = 周常行动（一周内累计达标即算完成），once = 日抛行动（仅当天）。
function habitRepeat(habit) {
  if (habit?.onlyOn) return "once";
  return Number.isInteger(habit?.weeklyTarget) && habit.weeklyTarget > 0 ? "weekly" : "daily";
}

function repeatLabel(habit) {
  const repeat = habitRepeat(habit);
  if (repeat === "once") return habit.category === "inspiration" ? "完成前每天" : "今日限定";
  if (repeat === "weekly") return `每周 ${habit.weeklyTarget} 次`;
  return "每天";
}

function weekStart(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

function weekEnd(day) {
  const date = new Date(`${weekStart(day)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

function weeklyDone(habit, day, entries = state.entries) {
  const start = weekStart(day);
  const end = weekEnd(day);
  // 达标奖励也挂在同一个 kind 上，统计次数时必须排除，否则会自己把自己算成一次。
  return entries.filter(entry => entry.kind === habit.id && !entry.weekly && entry.date >= start && entry.date <= end).length;
}

function weeklyTargetMet(habit, day, entries = state.entries) {
  return habitRepeat(habit) === "weekly" && weeklyDone(habit, day, entries) >= habit.weeklyTarget;
}

// —— 周常结算 ——
// 周常打卡本身不给生命力；一周内凑满目标次数后，一次性发放这项行动的奖励。
function weeklyAwardId(habit, day) {
  return `${weekStart(day)}:${habit.id}:weekly`;
}

// 旧规则下周常「每打卡一次就发一次生命力」，和「每周达标只发一次」冲突。
// 这里把多发的那部分收回：还挂在门口没领的球整颗作废，已入账但没花掉的扣成「已扣留」，
// 已经花掉的（变成作物、肥料）不追；每周达标应得的那一份重新补上，避免误伤正常奖励。
function reclaimWeeklyBugEnergy(entries, habits, snapshot) {
  if (!Array.isArray(entries)) return { entries, amount: 0, changed: false };
  const weeklyHabits = habits.filter(habit => habitRepeat(habit) === "weekly" && habit.weeklyTarget > 0);
  if (!weeklyHabits.length) return { entries, amount: 0, changed: false };

  const next = [...entries];
  const spentByEntry = countSpentEnergyByEntry(spentEnergyIds({ ...snapshot, entries: next }));
  let amount = 0;
  let changed = false;

  for (const habit of weeklyHabits) {
    const groups = new Map();
    next.forEach((entry, index) => {
      if (entry.kind !== habit.id || !entry.date) return;
      if (entry.weekly || entry.weeklyMark) return;
      if (!(entry.reward > 0)) return;
      const start = weekStart(entry.date);
      if (!groups.has(start)) groups.set(start, []);
      groups.get(start).push(index);
    });

    for (const [start, indexes] of groups) {
      const end = weekEnd(start);
      const marks = next.filter(entry => entry.kind === habit.id && !entry.weekly
        && entry.date >= start && entry.date <= end).length;
      for (const index of indexes) {
        const entry = next[index];
        changed = true;
        if (!entry.collected) {
          amount += actionReward(entry);
          next[index] = { ...entry, reward: 0, collected: true, weeklyMark: true };
          continue;
        }
        const available = remainingEntryEnergy(entry, spentByEntry);
        amount += available;
        next[index] = {
          ...entry,
          weeklyMark: true,
          withheldEnergy: (entry.withheldEnergy ?? 0) + available,
        };
      }
      if (marks >= habit.weeklyTarget && !next.some(entry => entry.id === weeklyAwardId(habit, start))) {
        const last = next[indexes[indexes.length - 1]];
        next.push({
          id: weeklyAwardId(habit, start),
          date: last.date,
          kind: habit.id,
          actionLabel: `${habit.name} · 本周 ${habit.weeklyTarget} 次达标`,
          reward: actionReward(habit),
          collected: true,
          weekly: true,
        });
        changed = true;
      }
    }
  }
  return { entries: next, amount, changed };
}

function weeklyAwardEntry(habit, day, entries = state.entries) {
  const id = weeklyAwardId(habit, day);
  return entries.find(entry => entry.id === id);
}

// 本周这一项是否已经结算过：新格式的达标奖励，或旧存档里「每打卡一次就发一次」的记录。
function weeklyRewardSettled(habit, day, entries = state.entries) {
  if (weeklyAwardEntry(habit, day, entries)) return true;
  const start = weekStart(day);
  const end = weekEnd(day);
  return entries.some(entry => entry.kind === habit.id && !entry.weeklyMark
    && entry.reward > 0 && entry.date >= start && entry.date <= end);
}

function awardWeekly(habit, day, snapshot = state) {
  if (habitRepeat(habit) !== "weekly") return null;
  if (!weeklyTargetMet(habit, day, snapshot.entries)) return null;
  if (weeklyRewardSettled(habit, day, snapshot.entries)) return null;
  const award = {
    id: weeklyAwardId(habit, day),
    date: day,
    kind: habit.id,
    actionLabel: `${habit.name} · 本周 ${habit.weeklyTarget} 次达标`,
    reward: actionReward(habit),
    collected: false,
    weekly: true,
  };
  snapshot.entries.push(award);
  return award;
}

function dailyActionTotals(entries) {
  const totals = new Map();
  for (const { date, kind, weekly } of entries) {
    // 周常的达标奖励不算一次打卡，否则会把这天的「已完成项数」多算一项。
    if (date && !weekly && ![dailyActionBonus, whaleMoodBonus, "sample"].includes(kind)) totals.set(date, (totals.get(date) ?? 0) + 1);
  }
  return totals;
}

function normalizeHabit(habit) {
  if (!habit || typeof habit !== "object") return habit;
  const target = Number(habit.weeklyTarget);
  if (!habit.onlyOn && Number.isInteger(target) && target > 0) {
    return { ...habit, weeklyTarget: Math.min(7, target) };
  }
  const { weeklyTarget, ...rest } = habit;
  return rest;
}

function dayEnergyTotals(entries) {
  const totals = new Map();
  for (const entry of entries) {
    // 周常打卡本身不带生命力（0 分），不该把那天算成一个「有记录的日子」。
    if (!entry.date || entry.kind === "sample" || !actionReward(entry)) continue;
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + actionReward(entry));
  }
  return totals;
}

// 「历史最佳」= 单日获得生命力最多的一天；「累计」= 至今获得的全部生命力；「日均」按有记录的天数折算。
function actionHistory(entries, day = todayKey()) {
  const totals = dayEnergyTotals(entries.filter(entry => entry.date <= day));
  let best;
  let total = 0;
  for (const [date, points] of totals) {
    total += points;
    if (!best || points > best.points || (points === best.points && date > best.date)) best = { date, points };
  }
  const days = totals.size;
  return { best, total, days, average: days ? total / days : 0 };
}

function habitDetailText(habit, day, weekDone = 0) {
  const repeat = habitRepeat(habit);
  const viewingPast = day !== todayKey();
  const parts = [];
  if (repeat === "weekly") {
    parts.push(`${viewingPast ? "当周" : "本周"} ${weekDone}/${habit.weeklyTarget}${weekDone >= habit.weeklyTarget ? " · 已达标" : ""}`);
  } else if (repeat === "once" && habit.category !== "inspiration") {
    parts.push(viewingPast ? "当天限定" : "仅今天");
  }
  if (!habit.onlyOn && habit.category === "inspiration" && habit.inspirationFinishedOn === day) parts.push("灵感已完成");
  parts.push(actionPraiseLabel(habit.praiseScore), habit.description);
  const entry = state.entries.find(item => item.kind === habit.id && item.date === day && !item.weekly);
  parts.push(activityRecordSummary(entry));
  return parts.filter(Boolean).join(" · ");
}

function renderActionCalendar() {
  const today = todayKey();
  const focused = document.activeElement;
  let nextFocus;
  const totals = dailyActionTotals(state.entries);
  // 日历上的「完成」= 当天的日常行动都做完了（周常按周另算）。
  const dailyHabits = new Map(state.habits.filter(habit => habitRepeat(habit) === "daily").map(habit => [habit.id, habit]));
  const dailyDoneByDate = new Map();
  for (const entry of state.entries) {
    const habit = dailyHabits.get(entry.kind);
    if (!entry.date || !habit || !actionScheduledOn(habit, entry.date)) continue;
    dailyDoneByDate.set(entry.date, (dailyDoneByDate.get(entry.date) ?? 0) + 1);
  }
  const days = [];
  const date = new Date(calendarMonth);
  const month = date.getUTCMonth();
  const leadingDays = (date.getUTCDay() + 6) % 7;
  for (let i = 0; i < leadingDays; i++) days.push(document.createElement("span"));
  while (date.getUTCMonth() === month) {
    const key = date.toISOString().slice(0, 10);
    const completed = totals.get(key) ?? 0;
    const dailyGoal = [...dailyHabits.values()].filter(habit => actionScheduledOn(habit, key)).length;
    const complete = dailyGoal > 0 && (dailyDoneByDate.get(key) ?? 0) >= dailyGoal;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = date.getUTCDate();
    button.dataset.calendarDate = key;
    button.disabled = key > today;
    button.setAttribute("aria-label", `${key}，已完成 ${completed} 项行动`);
    button.setAttribute("aria-pressed", String(key === calendarDate));
    if (key === today) button.setAttribute("aria-current", "date");
    if (completed) button.dataset.progress = complete ? "complete" : "partial";
    if (focused?.dataset.calendarDate === key) nextFocus = button;
    button.addEventListener("click", () => {
      // 单击：右侧切到这一天的记录；双击（420ms 内连点同一格）：把行动面板也切到这一天。
      const now = performance.now();
      const doubleClick = calendarLastClick?.key === key && now - calendarLastClick.at < 420;
      calendarLastClick = { key, at: now };
      if (doubleClick) {
        calendarLastClick = undefined;
        openActionDay(key);
        return;
      }
      if (calendarDate === key) return;
      calendarDate = key;
      el["action-calendar-status"].textContent = "";
      renderActionCalendar();
    });
    days.push(button);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  el["action-calendar-days"].replaceChildren(...days);
  el["action-calendar-month"].textContent = calendarMonthFormat.format(calendarMonth);
  el["action-calendar-next"].disabled = calendarMonth.toISOString().slice(0, 7) >= today.slice(0, 7);
  el["action-calendar-date"].textContent = `${calendarDate.slice(0, 4)}年${formatDate(calendarDate)}`;
  const completed = new Map(state.entries.filter(entry => entry.date === calendarDate && !entry.weekly).map(entry => [entry.kind, entry]));
  const calendarHabits = state.habits.filter(habit =>
    actionScheduledOn(habit, calendarDate) || completed.has(habit.id));
  el["action-calendar-count"].textContent = `已完成 ${totals.get(calendarDate) ?? 0} / ${calendarHabits.length}`;
  const habits = calendarHabits.map(habit => {
    const entry = completed.get(habit.id);
    const repeat = habitRepeat(habit);
    const weekDone = repeat === "weekly" ? weeklyDone(habit, calendarDate) : 0;
    const weekMet = repeat === "weekly" && weekDone >= habit.weeklyTarget;
    const button = document.createElement("button");
    button.type = "button";
    const actionable = actionAvailableOn(habit, calendarDate, today);
    button.disabled = !actionable;
    button.dataset.calendarHabit = habit.id;
    button.setAttribute("aria-pressed", String(Boolean(entry)));
    const name = document.createElement("strong");
    name.textContent = habit.name;
    const label = document.createElement("span");
    // 周常打卡不给生命力，文案说清「已打卡 / 已达标」，别写成 +N。
    // 日抛行动在历史那天补记时点明「补记」，和当天的「标记完成」区分开。
    const status = !actionable ? "已在其它日期完成"
      : entry?.source === "finance-link" ? "自动完成"
      : repeat === "weekly"
        ? (weekMet ? "已达标" : entry ? "已打卡" : `达标可得 +${actionReward(habit)}`)
        : entry ? "已完成"
          : repeat === "once" && calendarDate !== today ? `+${actionReward(habit)} 补记完成`
            : `+${actionReward(habit)} 标记完成`;
    label.textContent = repeat === "weekly" ? `${status} · ${calendarDate === today ? "本周" : "当周"} ${weekDone}/${habit.weeklyTarget}` : status;
    button.append(name, label);
    const workout = activityRecordSummary(entry);
    if (workout) {
      const summary = document.createElement("span");
      summary.textContent = workout;
      button.append(summary);
    }
    button.addEventListener("click", () => toggleActionCompletion(habit.id, calendarDate, el["action-calendar-status"]));
    if (focused?.dataset.calendarHabit === habit.id) nextFocus = button;
    return button;
  });
  if (!habits.length) {
    const empty = document.createElement("p");
    empty.className = "guide";
    empty.textContent = "还没有可标记的行动。";
    habits.push(empty);
  }
  el["action-calendar-habits"].replaceChildren(...habits);
  nextFocus?.focus({ preventScroll: true });
}

// 生命力榜沿用两个口径，赞美榜按行动当前填写的指数排序。
// ① 单个行动累计生命力 —— 日常每天都在做、周常按周结算，跟日抛行动不可比，排除在外。
// ② 单日生命力 —— 排除周常达标奖励，因为「哪天凑满次数」带偶然性，会让那天凭空占优。
function leaderboardRows() {
  const actions = new Map();
  const days = new Map();
  for (const entry of state.entries) {
    if (!entry.date || entry.kind === "sample" || entry.weekly || entry.weeklyMark) continue;
    const points = actionReward(entry);
    if (!points) continue;
    const habit = state.habits.find(item => item.id === entry.kind);
    if (habit && habitRepeat(habit) === "once") {
      const row = actions.get(habit.id) ?? { id: habit.id, name: habit.name, points: 0, count: 0 };
      row.points += points;
      row.count += 1;
      actions.set(habit.id, row);
    }
    const day = days.get(entry.date) ?? { points: 0, count: 0 };
    day.points += points;
    day.count += 1;
    days.set(entry.date, day);
  }
  return {
    actions: [...actions.values()].sort((a, b) =>
      b.points - a.points || b.count - a.count || a.name.localeCompare(b.name, "zh")),
    days: [...days].map(([date, row]) => ({ date, ...row })).sort((a, b) =>
      b.points - a.points || (a.date < b.date ? 1 : -1)),
    praise: state.habits.filter(habit => actionPraiseLabel(habit.praiseScore))
      .map(habit => ({
        id: habit.id,
        name: habit.name,
        points: habit.praiseScore,
        description: (habit.description ?? "").trim(),
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "zh")),
  };
}

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
let leaderboardDimension = "actions";
// 展开状态按维度各记一个，换到另一个榜单再换回来时还能停在原来那一行。
const leaderboardExpanded = new Map();

function weekdayOf(date) {
  return weekdayNames[new Date(`${date}T12:00:00`).getDay()];
}

function leaderboardDetailNode(rows, footnotes = [], emptyText = "这一天没有获得生命力的行动。") {
  const list = document.createElement("ul");
  list.className = "leaderboard-detail-list";
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-detail-empty";
    empty.textContent = emptyText;
    list.append(empty);
  }
  for (const row of rows) {
    const item = document.createElement("li");
    item.className = "leaderboard-detail-row";
    if (row.category) item.dataset.category = row.category;
    const dot = document.createElement("i");
    dot.className = "leaderboard-detail-dot";
    dot.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "leaderboard-detail-name";
    name.textContent = row.name;
    if (row.title) name.title = row.title;
    item.append(dot, name);
    if (row.note) {
      const note = document.createElement("small");
      note.className = "leaderboard-detail-note";
      note.textContent = row.note;
      item.append(note);
    }
    const points = document.createElement("span");
    points.className = "leaderboard-detail-points";
    points.textContent = `+${row.points}`;
    item.append(points);
    list.append(item);
  }
  for (const text of footnotes) {
    const item = document.createElement("li");
    item.className = "leaderboard-detail-footnote";
    item.textContent = text;
    list.append(item);
  }
  return list;
}

// 单日明细：这一天具体做了哪几项、各拿多少生命力。
// 周常打卡不带生命力，单独数一笔放在脚注里，免得明细加不出行首的总分。
function dayLeaderboardDetail(date) {
  const rows = [];
  let weeklyMarks = 0;
  let weeklyBonus = 0;
  for (const entry of state.entries) {
    if (entry.date !== date || entry.kind === "sample") continue;
    if (entry.weekly) {
      weeklyBonus += actionReward(entry);
      continue;
    }
    if (entry.weeklyMark) {
      weeklyMarks += 1;
      continue;
    }
    const points = actionReward(entry);
    if (!points) continue;
    const habit = state.habits.find(item => item.id === entry.kind);
    rows.push({
      name: habit?.name ?? actionRecordLabel(entry).split(" · ")[0],
      category: habit ? habitCategory(habit) : "other",
      note: habit ? repeatLabel(habit) : "行动已删除",
      points,
    });
  }
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "zh"));
  const footnotes = [];
  if (weeklyMarks) footnotes.push(`另有 ${weeklyMarks} 次周常打卡，不计生命力`);
  if (weeklyBonus) footnotes.push(`周常达标奖励 +${weeklyBonus}，不计入本榜`);
  return leaderboardDetailNode(rows, footnotes);
}

// 行动明细：这项日抛行动每次完成是在哪天、各拿多少生命力。
function actionLeaderboardDetail(habitId) {
  const rows = state.entries
    .filter(entry => entry.kind === habitId && entry.date && !entry.weekly && !entry.weeklyMark)
    .filter(entry => actionReward(entry) > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map(entry => ({
      name: formatDate(entry.date),
      note: `${weekdayOf(entry.date)}${entry.source === "finance-link" ? " · 自动" : ""}`,
      points: actionReward(entry),
    }));
  return leaderboardDetailNode(rows, [], "这项行动还没有记录。");
}

// 赞美榜明细不是打卡记录，而是这项行动自己写的「具体做法」。
function praiseLeaderboardDetail(description) {
  const wrap = document.createElement("div");
  wrap.className = "leaderboard-praise";
  const label = document.createElement("span");
  label.className = "leaderboard-praise-label";
  label.textContent = "具体做法";
  const text = document.createElement("p");
  text.className = "leaderboard-praise-text";
  if (description) {
    text.textContent = description;
  } else {
    text.classList.add("is-empty");
    text.textContent = "还没填写具体做法，在行动编辑里补上就能在这里展开。";
  }
  wrap.append(label, text);
  return wrap;
}

function renderLeaderboard() {
  const { actions, days, praise } = leaderboardRows();
  for (const tab of el["leaderboard-dialog"].querySelectorAll("[data-leaderboard]")) {
    const active = tab.dataset.leaderboard === leaderboardDimension;
    tab.setAttribute("aria-pressed", String(active));
    el[tab.getAttribute("aria-controls")].hidden = !active;
  }
  const fill = (list, rows, emptyText, dimension) => {
    if (!rows.length) {
      const empty = document.createElement("li");
      empty.className = "leaderboard-empty";
      empty.textContent = emptyText;
      list.replaceChildren(empty);
      return;
    }
    const openKey = leaderboardExpanded.get(dimension);
    list.replaceChildren(...rows.map((row, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-row";
      item.dataset.rank = String(index + 1);
      // 有明细的行改成按钮，点一下在行下方铺开具体行动。
      const head = document.createElement(row.detail ? "button" : "div");
      head.className = "leaderboard-summary";
      if (row.detail) {
        head.type = "button";
        head.dataset.rowKey = row.key;
        head.classList.add("is-expandable");
      }
      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = String(index + 1);
      const copy = document.createElement("span");
      copy.className = "leaderboard-copy";
      const name = document.createElement("strong");
      name.textContent = row.title;
      const caption = document.createElement("small");
      caption.textContent = row.caption;
      copy.append(name, caption);
      const points = document.createElement("span");
      points.className = "leaderboard-points";
      points.textContent = row.score ? `${row.points} 分` : `+${row.points}`;
      head.append(rank, copy, points);
      if (!row.detail) {
        item.append(head);
        return item;
      }
      const caret = document.createElement("i");
      caret.className = "leaderboard-caret";
      caret.setAttribute("aria-hidden", "true");
      head.append(caret);
      const detail = document.createElement("div");
      detail.className = "leaderboard-detail";
      detail.id = `leaderboard-detail-${dimension}-${index}`;
      detail.hidden = openKey !== row.key;
      detail.append(row.detail());
      head.setAttribute("aria-controls", detail.id);
      head.setAttribute("aria-expanded", String(!detail.hidden));
      head.setAttribute("aria-label", `${row.title}，${row.caption}，${detail.hidden ? "展开" : "收起"}${row.detailLabel ?? "明细"}`);
      item.classList.toggle("is-open", !detail.hidden);
      head.addEventListener("click", () => {
        const open = leaderboardExpanded.get(dimension) === row.key;
        leaderboardExpanded.set(dimension, open ? null : row.key);
        renderLeaderboard();
        const target = [...list.querySelectorAll("[data-row-key]")].find(button => button.dataset.rowKey === row.key);
        if (!target) return;
        target.focus({ preventScroll: true });
        if (!open) target.closest(".leaderboard-row")?.scrollIntoView({ block: "nearest" });
      });
      item.append(head, detail);
      return item;
    }));
  };
  fill(el["leaderboard-actions"], actions.map(row => ({
    title: row.name, caption: `${row.count} 次`, points: row.points,
    key: row.id, detail: () => actionLeaderboardDetail(row.id),
  })), "还没有日抛行动的生命力记录。", "actions");
  fill(el["leaderboard-days"], days.slice(0, 10).map(row => ({
    title: `${row.date.slice(0, 4)}年${formatDate(row.date)}`,
    caption: `${weekdayOf(row.date)} · ${row.count} 项行动`,
    points: row.points,
    key: row.date, detail: () => dayLeaderboardDetail(row.date),
  })), "还没有可排行的日子。", "days");
  fill(el["leaderboard-praise"], praise.map(row => ({
    title: row.name, caption: actionPraiseLabel(row.points).split(" · ")[0], points: row.points, score: true,
    key: row.id, detailLabel: "具体做法", detail: () => praiseLeaderboardDetail(row.description),
  })), "在行动编辑中填写赞美指数，即可加入榜单。", "praise");
  el["leaderboard-status"].textContent = leaderboardDimension === "days" && days.length > 10
    ? `单日榜只显示前 10 天，共 ${days.length} 天有记录。`
    : "";
}

for (const tab of el["leaderboard-dialog"].querySelectorAll("[data-leaderboard]")) {
  tab.addEventListener("click", () => {
    leaderboardDimension = tab.dataset.leaderboard;
    renderLeaderboard();
  });
}

el["open-leaderboard"].addEventListener("click", () => {
  renderLeaderboard();
  el["leaderboard-dialog"].showModal();
});

// 行内编辑的「基准日」：正在看历史某天就以那天为准，否则是今天。
// 日常和日抛按当前查看的日期编辑，不会悄悄改到今天。
function actionEditorDay() {
  return actionViewDay ?? todayKey();
}

// 把行动面板切到指定日期（今天则回到实时状态），并关掉日历让面板露出来。
function openActionDay(day) {
  actionViewDay = day === todayKey() ? undefined : day;
  if (el["action-calendar-dialog"].open) el["action-calendar-dialog"].close();
  updateControls();
  if (!el.actions.open) el.actions.showModal();
}

el["action-day-label"].addEventListener("click", () => {
  if (!actionViewDay) return;
  actionViewDay = undefined;
  updateControls();
});
// 关掉行动面板就回到今天，避免下次打开还停在历史某天。
el.actions.addEventListener("close", () => {
  if (!actionViewDay && displayedDay === renderedToday) return;
  actionViewDay = undefined;
  updateControls();
});

el["open-action-calendar"].addEventListener("click", () => {
  const yesterday = new Date(`${todayKey()}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  calendarDate = yesterday.toISOString().slice(0, 10);
  yesterday.setUTCDate(1);
  calendarMonth = yesterday;
  el["action-calendar-status"].textContent = "";
  renderActionCalendar();
  el["action-calendar-dialog"].showModal();
  el["action-calendar-days"].querySelector('[aria-pressed="true"]')?.focus();
});
for (const [id, step] of [["action-calendar-prev", -1], ["action-calendar-next", 1]]) {
  el[id].addEventListener("click", () => {
    calendarMonth.setUTCMonth(calendarMonth.getUTCMonth() + step);
    renderActionCalendar();
  });
}

function spentEnergyIds(snapshot = state) {
  const purchases = [...snapshot.trees, ...snapshot.waitingCrops, ...snapshot.seedlings, ...snapshot.fertilizerPurchases];
  return new Set([...snapshot.spentPlantEnergyIds, ...purchases.flatMap(purchase => purchase.energyIds)]);
}

function actionReward(item) {
  return item?.reward ?? 1;
}

// Keep the original ID for the first point so existing purchases still link to their action.
function energyEntryId(id) {
  return id.split("#", 1)[0];
}

function countSpentEnergyByEntry(spent) {
  const spentByEntry = new Map();
  for (const id of spent) {
    const entryId = energyEntryId(id);
    spentByEntry.set(entryId, (spentByEntry.get(entryId) ?? 0) + 1);
  }
  return spentByEntry;
}

function remainingEntryEnergy(entry, spentByEntry) {
  if (!entry.collected) return 0;
  return Math.max(0, actionReward(entry) - (spentByEntry.get(entry.id) ?? 0) - (entry.withheldEnergy ?? 0));
}

function availableEnergy() {
  const spentByEntry = countSpentEnergyByEntry(spentEnergyIds());
  return state.entries.reduce((total, entry) => total + remainingEntryEnergy(entry, spentByEntry), 0);
}

function availableEnergyIds(amount) {
  const spent = spentEnergyIds();
  const spentByEntry = countSpentEnergyByEntry(spent);
  const ids = [];
  for (const entry of state.entries) {
    let remaining = remainingEntryEnergy(entry, spentByEntry);
    for (let point = 0; remaining > 0 && ids.length < amount; point++) {
      const id = point === 0 ? entry.id : `${entry.id}#${point}`;
      if (spent.has(id)) continue;
      ids.push(id);
      remaining--;
    }
    if (ids.length === amount) break;
  }
  return ids;
}

function setAvailableEnergy(target) {
  const previousEntries = state.entries;
  const spentByEntry = countSpentEnergyByEntry(spentEnergyIds());
  const balance = previousEntries.reduce((total, entry) => total + remainingEntryEnergy(entry, spentByEntry), 0);
  if (target === balance) return true;

  if (target > balance) {
    const id = crypto.randomUUID?.() ?? `energy-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
    state.entries = [...previousEntries, { id, kind: "sample", actionLabel: "神之一手", reward: target - balance, collected: true }];
  } else {
    let withdrawal = balance - target;
    const entries = [...previousEntries];
    // Only remove unspent points, leaving IDs already linked to crops and purchases intact.
    for (let index = entries.length - 1; withdrawal > 0 && index >= 0; index--) {
      const entry = entries[index];
      const amount = Math.min(withdrawal, remainingEntryEnergy(entry, spentByEntry));
      if (!amount) continue;
      entries[index] = { ...entry, withheldEnergy: (entry.withheldEnergy ?? 0) + amount };
      withdrawal -= amount;
    }
    state.entries = entries;
  }

  if (saveState()) return true;
  state.entries = previousEntries;
  return false;
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
let editingHabitContext;
let actionFilter = "all";
let actionCategoryPage = 0;
let actionCategories;

function habitCategory(habit) {
  const category = habit?.category;
  if (category !== "all" && actionCategories.has(category)) return category;
  if (state.customActionCategories.some(item => item.id === category && item.label.trim() === "价值")) return "value";
  return "other";
}

function actionCategoryArtwork(category) {
  const label = actionCategories.get(category)?.trim();
  const artwork = { 全部: "all", 学习: "study", 工作: "work", 锻炼: "exercise", 音乐: "music", 灵感: "inspiration", 友人: "friends", 美食: "food", 理财: "finance", 价值: "value", 摄影: "photography", 注意: "warning" }[label] ?? "other";
  const image = document.createElement("img");
  image.src = forestAssetUrl(`./assets/action-icons/${artwork}.webp`);
  image.alt = "";
  image.width = image.height = 64;
  return image;
}

function actionCategoryLabel(label) {
  return label.replace(/^⚠\uFE0F?\s*(?=注意$)/u, "");
}

// 「理财」沿用原来的排序位置，「价值」跟在它后面。
function actionCategoryOrder(categories) {
  const entries = [...categories];
  const finance = entries.findIndex(([id]) => id === "finance");
  if (finance < 0) return entries;
  const group = entries.splice(finance, entries[finance + 1]?.[0] === "value" ? 2 : 1);
  const note = entries.findIndex(([, label]) => label === "注意");
  if (note >= 0) {
    entries.splice(note, 0, ...group);
    return entries;
  }
  const shot = entries.findIndex(([, label]) => label.trim() === "摄影");
  entries.splice(shot >= 0 ? shot + 1 : finance, 0, ...group);
  return entries;
}

function actionCategoryPages() {
  const secondaryLabels = ["工作", "其它", "注意"];
  const categories = actionCategoryOrder(actionCategories).filter(([id]) => id !== "all");
  const primary = categories.filter(([, label]) => !secondaryLabels.includes(label));
  const secondary = categories.filter(([, label]) => secondaryLabels.includes(label))
    .sort((left, right) => secondaryLabels.indexOf(left[1]) - secondaryLabels.indexOf(right[1]));
  // “全部” stays on every page. Keep 理财 and 价值 together at page boundaries.
  const takePage = items => items.splice(0, items[10]?.[0] === "finance" && items[11]?.[0] === "value" ? 10 : 11);
  const pages = [takePage(primary)];
  const remaining = [...secondary, ...primary];
  while (remaining.length) pages.push(takePage(remaining));
  return pages;
}

function updateActionCategoryPage() {
  const pages = actionCategoryPages();
  actionCategoryPage = Math.min(actionCategoryPage, pages.length - 1);
  const visible = new Set(pages[actionCategoryPage].map(([id]) => id));
  const order = new Map(["all", ...pages.flat().map(([id]) => id)].map((id, index) => [id, index]));
  const tabs = [...el["action-categories"].children].sort((left, right) => order.get(left.dataset.category) - order.get(right.dataset.category));
  el["action-categories"].append(...tabs);
  for (const tab of el["action-categories"].children) tab.hidden = tab.dataset.category !== "all" && !visible.has(tab.dataset.category);
  const next = el["action-category-next"];
  next.hidden = pages.length < 2;
  next.textContent = actionCategoryPage < pages.length - 1 ? "下一页 ›" : pages.length === 2 ? "‹ 上一页" : "返回首页";
  next.setAttribute("aria-label", `行动分类，第 ${actionCategoryPage + 1} / ${pages.length} 页，${next.textContent}`);
}

el["action-category-next"].addEventListener("click", () => {
  actionCategoryPage = (actionCategoryPage + 1) % actionCategoryPages().length;
  updateActionCategoryPage();
});

function renderActionCategories() {
  actionCategories = new Map(defaultActionCategories);
  actionCategories.delete("other");
  for (const { id, label } of state.customActionCategories) {
    if (label.trim() !== "价值") actionCategories.set(id, actionCategoryLabel(label));
  }
  actionCategories.set("other", defaultActionCategories.get("other"));
  if (!actionCategories.has(actionFilter)) actionFilter = "all";
  const tabs = el["action-categories"];
  const select = el["action-category"];
  const selected = select.value;
  tabs.replaceChildren();
  select.replaceChildren();
  for (const [category, label] of actionCategoryOrder(actionCategories)) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.category = category;
    tab.title = label;
    const artwork = document.createElement("i");
    artwork.className = "action-category-icon";
    artwork.setAttribute("aria-hidden", "true");
    artwork.append(actionCategoryArtwork(category));
    const name = document.createElement("span");
    name.textContent = label;
    tab.append(artwork, name);
    tab.addEventListener("click", () => {
      actionFilter = category;
      filterHabits();
      el.habits.scrollTop = 0;
    });
    tabs.append(tab);
    if (category !== "all") select.append(new Option(label, category));
  }
  select.value = selected !== "all" && actionCategories.has(selected) ? selected : "other";
  if (actionFilter !== "all") actionCategoryPage = Math.max(0, actionCategoryPages().findIndex(page => page.some(([id]) => id === actionFilter)));
  updateActionCategoryPage();
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
  el.habits.classList.toggle("is-scrollable", visibleCount > 4);
  el["action-empty"].hidden = visibleCount > 0;
  el["action-empty"].textContent = habitButtons.size ? "这个分类还没有行动。" : "还没有行动，点击新增行动开始记录。";
}

const actionPraiseQualities = ["优秀", "精良", "稀有", "传奇"];

function actionPraiseTier(score) {
  return Number.isInteger(score) && score >= 80 && score <= 100
    ? Math.min(3, Math.floor((score - 80) / 5)) : -1;
}

function actionPraiseLabel(score) {
  const tier = actionPraiseTier(score);
  return tier < 0 ? "" : `${actionPraiseQualities[tier]} · ${score} 分`;
}

function updateActionPraiseQuality(score) {
  const quality = el["action-praise-quality"];
  quality.dataset.tier = actionPraiseTier(score);
  quality.value = actionPraiseLabel(score);
}

function actionPhoto(habit) {
  const photo = habit?.photo;
  return typeof photo === "string" && photo.startsWith("data:image/jpeg;base64,") ? photo : undefined;
}

let actionPhotoSaveKey;

function openActionPhoto(title, photo, description) {
  actionPhotoSaveKey = activeForestSave().key();
  el["action-photo-title"].textContent = title;
  el["action-photo-image"].src = photo;
  el["action-photo-image"].alt = description;
  el["action-photo-dialog"].showModal();
}

function renderHabits(day = todayKey()) {
  habitButtons.clear();
  el.habits.replaceChildren();
  const repeatOrder = { once: 0, daily: 1, weekly: 2 };
  const categoryOrder = new Map(actionCategoryOrder(actionCategories).map(([category], index) => [category, index]));
  const habits = [...state.habits].sort((left, right) =>
    repeatOrder[habitRepeat(left)] - repeatOrder[habitRepeat(right)] ||
    categoryOrder.get(habitCategory(left)) - categoryOrder.get(habitCategory(right)));
  for (const habit of habits) {
    if (!actionVisibleOn(habit, day)) continue;
    const category = habitCategory(habit);
    const row = document.createElement("div");
    row.className = "action-row";
    row.dataset.category = category;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "habit";
    button.dataset.kind = habit.id;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-label", `编辑「${habit.name}」`);
    button.addEventListener("click", () => openActionEditor(habit.id));
    const artwork = document.createElement("span");
    artwork.className = "habit-art";
    artwork.append(actionCategoryArtwork(category));
    artwork.setAttribute("aria-hidden", "true");
    const chip = document.createElement("span");
    chip.className = "habit-category";
    chip.dataset.category = category;
    chip.textContent = actionCategories.get(category);
    chip.title = chip.textContent;
    const copy = document.createElement("span");
    copy.className = "habit-copy";
    const title = document.createElement("span");
    title.className = "habit-title";
    const name = document.createElement("strong");
    name.textContent = habit.name;
    const repeat = habitRepeat(habit);
    const repeatChip = document.createElement("span");
    repeatChip.className = "habit-repeat";
    repeatChip.dataset.repeat = repeat;
    repeatChip.textContent = repeatLabel(habit);
    title.append(name, repeatChip);
    copy.append(title);
    const detail = habitDetailText(habit, day, repeat === "weekly" ? weeklyDone(habit, day) : 0);
    let description;
    if (detail || activityRecordConfig(habit)) {
      description = document.createElement("small");
      description.textContent = detail;
      description.title = detail;
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
    const control = document.createElement("button");
    control.type = "button";
    control.className = "action-art habit-control";
    control.setAttribute("aria-label", `完成「${habit.name}」`);
    control.addEventListener("click", () => toggleActionCompletion(habit.id, day));
    side.append(reward);
    button.append(artwork, chip, copy, side);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "action-edit";
    edit.title = "编辑行动";
    edit.setAttribute("aria-label", `编辑${habit.name}`);
    edit.innerHTML = icon("edit-action");
    edit.addEventListener("click", () => openActionEditor(habit.id));
    const photo = actionPhoto(habit);
    if (photo) {
      const thumbnail = document.createElement("img");
      thumbnail.className = "habit-photo";
      thumbnail.src = photo;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      side.prepend(thumbnail);
    }
    row.append(button, control, edit);
    el.habits.append(row);
    habitButtons.set(habit.id, { row, button, control, edit, rewardAmount, description });
  }
  filterHabits();
}

el["action-photo-dialog"].addEventListener("close", () => {
  if (!el["action-photo-dialog"].open) el["action-photo-image"].removeAttribute("src");
});

function openActionEditor(id) {
  const habit = state.habits.find(item => item.id === id);
  const day = actionEditorDay();
  if (habit && !actionVisibleOn(habit, day)) {
    updateControls();
    return;
  }
  editingHabit = habit?.id;
  editingHabitContext = { day, saveKey: activeForestSave().key() };
  const historical = Boolean(habit) && day !== todayKey();
  const lockedRepeat = historical && habitRepeat(habit) === "weekly";
  el["action-editor-title"].textContent = habit ? (historical ? `编辑行动 · ${formatDate(day)}` : "编辑行动") : "新增行动";
  el["action-name"].value = habit?.name ?? "";
  el["action-name"].setCustomValidity("");
  el["action-description"].value = habit?.description ?? "";
  el["action-category"].value = habit ? habitCategory(habit) : actionFilter === "all" ? "other" : actionFilter;
  el["action-photo-file"].value = "";
  el["action-photo-status"].textContent = "";
  el["action-repeat"].value = habit ? habitRepeat(habit) : "";
  el["action-repeat"].disabled = lockedRepeat;
  el["action-repeat"].title = lockedRepeat ? "历史周常行动保持原重复频率" : "";
  el["action-repeat"].querySelector('[value="weekly"]').disabled = historical && !lockedRepeat;
  el["action-only-date"].max = todayKey();
  el["action-only-date"].value = habit?.onlyOn ?? day;
  el["action-weekly-target"].value = habit?.weeklyTarget ?? 4;
  updateActionRepeatFields();
  el["action-inspiration-completed"].checked = false;
  renderActionInspirationField(habit);
  renderActionPhotoField();
  el["action-reward"].value = actionReward(habit);
  el["action-praise"].value = habit?.praiseScore ?? "";
  updateActionPraiseQuality(habit?.praiseScore);
  el["action-editor-status"].textContent = "";
  el["delete-action"].hidden = !habit;
  el["create-action"].hidden = Boolean(habit);
  el["action-editor-form"].hidden = false;
  el["action-delete-confirm"].hidden = true;
  el["action-editor"].showModal();
  el["action-name"].focus();
}

function updateActionRepeatFields() {
  const repeat = el["action-repeat"].value;
  const weekly = repeat === "weekly";
  const once = repeat === "once";
  el["action-weekly-row"].hidden = !weekly;
  el["action-weekly-target"].disabled = !weekly;
  el["action-once-row"].hidden = !once;
  el["action-only-date"].disabled = !once;
  updateActionCreateButton();
}

function renderActionInspirationField(habit) {
  const inspiration = el["action-category"].value === "inspiration";
  const checkbox = el["action-inspiration-completed"];
  el["action-inspiration-row"].hidden = checkbox.disabled = !inspiration;
  el["action-only-date-label"].textContent = inspiration ? "开始日期" : "限定日期";
  if (habit || !inspiration) checkbox.checked = inspiration && Boolean(habit && inspirationCompletedOn(habit));
}

el["action-repeat"].addEventListener("input", updateActionRepeatFields);

function updateActionCreateButton() {
  el["create-action"].disabled = !el["action-repeat"].value
    || (el["action-category"].value === "food" && Boolean(editingHabitContext?.loadingPhoto));
}

function saveHabits(habits, entries = state.entries) {
  const previousHabits = state.habits;
  const previousEntries = state.entries;
  state.habits = habits;
  state.entries = [...entries];
  if (!saveState()) {
    state.habits = previousHabits;
    state.entries = previousEntries;
    el["action-editor-status"].textContent = "浏览器无法保存此次修改。";
    return false;
  }
  // 跟着当前查看的那天重绘，否则在历史视图里保存会把列表悄悄换成今天的行动。
  renderHabits(actionEditorDay());
  if (state.entries !== previousEntries) renderOrbs();
  updateControls();
  return true;
}

function renderActionPhotoField() {
  const food = el["action-category"].value === "food";
  const saved = editingHabit && actionPhoto(state.habits.find(habit => habit.id === editingHabit));
  const photo = saved || editingHabitContext?.photo;
  const busy = Boolean(editingHabitContext?.loadingPhoto);
  el["action-photo-field"].hidden = !food && !saved;
  el["choose-action-photo"].hidden = !food;
  el["choose-action-photo"].textContent = photo ? "更换图片" : "上传图片";
  el["choose-action-photo"].disabled = busy;
  el["view-action-photo"].hidden = !photo;
  el["remove-action-photo"].hidden = !photo;
  el["remove-action-photo"].disabled = busy;
  updateActionCreateButton();
  const preview = el["action-photo-preview"];
  preview.hidden = !photo;
  if (photo) preview.src = photo;
  else preview.removeAttribute("src");
}

el["view-action-photo"].addEventListener("click", () => {
  const photo = el["action-photo-preview"].getAttribute("src");
  if (photo && editingHabitContext?.saveKey === activeForestSave().key()) {
    openActionPhoto(el["action-name"].value.trim() || "美食照片", photo, "美食照片");
  }
});

async function compressActionPhoto(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const painter = canvas.getContext("2d");
    for (const edge of [1024, 768, 576, 432, 320]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      painter.fillStyle = "#fff";
      painter.fillRect(0, 0, canvas.width, canvas.height);
      painter.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [.84, .68, .52]) {
        const photo = canvas.toDataURL("image/jpeg", quality);
        if (photo.length <= 72 * 1024) return photo;
      }
    }
    throw new Error("Photo could not fit in the save");
  } finally {
    bitmap.close();
  }
}

function photoFitsInSnapshot(snapshot, status) {
  // Keep photo additions within the same byte limit as forest-save-sync.
  if (new Blob([JSON.stringify(snapshot)]).size <= 2 * 1024 * 1024) return true;
  status.textContent = "存档空间不足，请先移除一些照片再添加。";
  return false;
}

function actionPhotoFits(habits) {
  return photoFitsInSnapshot({ ...state, habits }, el["action-photo-status"]);
}

function isSupportedActionPhoto(file) {
  const supported = file.type ? /^image\/(?:jpeg|png|webp)$/.test(file.type) : /\.(?:jpe?g|png|webp)$/i.test(file.name);
  return supported && file.size <= 20 * 1024 * 1024;
}

function setActionPhoto(photo, context) {
  const status = el["action-photo-status"];
  if (context.saveKey !== activeForestSave().key()) {
    status.textContent = "当前存档已切换，请关闭后重新打开。";
    return;
  }
  if (editingHabit) {
    const habit = state.habits.find(item => item.id === editingHabit);
    if (!habit || (photo && habitCategory(habit) !== "food")) {
      status.textContent = "行动已变更，请关闭后重新打开。";
      return;
    }
    const habits = state.habits.map(item => item === habit ? { ...item, photo } : item);
    if (photo && !actionPhotoFits(habits)) return;
    if (!saveHabits(habits)) {
      status.textContent = "图片修改未保存，请重试。";
      return;
    }
  } else {
    context.photo = photo;
  }
  renderActionPhotoField();
  status.textContent = photo ? (editingHabit ? "照片已保存。" : "已选好照片，添加行动时保存。") : "";
}

el["choose-action-photo"].addEventListener("click", () => el["action-photo-file"].click());
el["remove-action-photo"].addEventListener("click", () => {
  setActionPhoto(undefined, editingHabitContext);
  if (!el["choose-action-photo"].hidden && el["remove-action-photo"].hidden) el["choose-action-photo"].focus();
});
el["action-photo-file"].addEventListener("change", async event => {
  const file = event.currentTarget.files[0];
  event.currentTarget.value = "";
  const context = editingHabitContext;
  if (!file || !context || context.loadingPhoto || el["action-category"].value !== "food") return;
  const status = el["action-photo-status"];
  if (!isSupportedActionPhoto(file)) {
    status.textContent = "请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。";
    return;
  }
  context.loadingPhoto = true;
  renderActionPhotoField();
  status.textContent = "正在处理图片…";
  try {
    const photo = await compressActionPhoto(file);
    if (el["action-editor"].open && context === editingHabitContext && el["action-category"].value === "food") {
      setActionPhoto(photo, context);
    }
  } catch {
    if (el["action-editor"].open && context === editingHabitContext) status.textContent = "无法读取这张图片，请换一张。";
  } finally {
    context.loadingPhoto = false;
    if (el["action-editor"].open && context === editingHabitContext) {
      if (status.textContent === "正在处理图片…") status.textContent = "";
      renderActionPhotoField();
    }
  }
});

function setActionEditMode(editing) {
  el.habits.classList.toggle("is-editing", editing);
  el["toggle-action-edit"].setAttribute("aria-pressed", String(editing));
}

el["toggle-action-edit"].addEventListener("click", () => {
  setActionEditMode(!el.habits.classList.contains("is-editing"));
});
el["add-action"].addEventListener("click", () => openActionEditor());
el["open-action-log"].addEventListener("click", () => showJournal());
const actionPraiseInput = el["action-praise"];
const inspirationCompletionInput = el["action-inspiration-completed"];
inspirationCompletionInput.addEventListener("input", () => {
  if (!editingHabit) return;
  const habit = state.habits.find(item => item.id === editingHabit);
  const status = el["action-editor-status"];
  if (editingHabitContext?.saveKey !== activeForestSave().key()) {
    status.textContent = "当前存档已切换，请关闭后重新打开。";
  } else if (habit?.category === "inspiration") {
    const completedOn = inspirationCompletedOn(habit);
    const { checked } = inspirationCompletionInput;
    const { day } = editingHabitContext;
    if (checked !== Boolean(completedOn)) {
      if (habit.onlyOn) {
        const date = completedOn || (habit.onlyOn > day ? habit.onlyOn : day);
        toggleActionCompletion(habit.id, date, status, true);
      } else {
        const habits = state.habits.map(item => item === habit
          ? { ...item, inspirationFinishedOn: checked ? day : undefined } : item);
        if (saveHabits(habits)) status.textContent = checked ? "已完成" : "已恢复提醒";
      }
    }
  }
  renderActionInspirationField(state.habits.find(item => item.id === editingHabit));
});

el["action-editor-form"].addEventListener("input", event => {
  if (event.target === el["action-photo-file"] || event.target === inspirationCompletionInput) return;
  if (event.target === el["action-category"]) {
    renderActionPhotoField();
    renderActionInspirationField(state.habits.find(item => item.id === editingHabit));
  }
  updateActionPraiseQuality(actionPraiseInput.valueAsNumber);
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
  if (!actionPraiseInput.validity.valid) {
    el["action-editor-status"].textContent = "赞美指数请输入 80–100 的整数，或留空。";
    return;
  }
  const habit = state.habits.find(item => item.id === editingHabit);
  if (!habit) {
    el["action-editor-status"].textContent = "该行动已被删除。";
    return;
  }
  if (editingHabitContext?.saveKey !== activeForestSave().key()) {
    el["action-editor-status"].textContent = "当前存档已切换，请关闭后重新打开。";
    return;
  }
  const description = el["action-description"].value.trim();
  const category = el["action-category"].value;
  const repeat = el["action-repeat"].value;
  if (repeat === "weekly" && !el["action-weekly-target"].validity.valid) {
    el["action-editor-status"].textContent = "每周目标次数请输入 1–7 的整数。";
    return;
  }
  if (repeat === "once" && !el["action-only-date"].validity.valid) {
    el["action-editor-status"].textContent = "请选择今天或以前的限定日期。";
    return;
  }
  const onlyOn = repeat === "once" ? el["action-only-date"].value : undefined;
  const weeklyTarget = repeat === "weekly" ? el["action-weekly-target"].valueAsNumber : undefined;
  const praiseScore = actionPraiseInput.value ? actionPraiseInput.valueAsNumber : undefined;
  const inspirationFinishedOn = category === "inspiration" && !onlyOn ? habit.inspirationFinishedOn : undefined;
  const updated = { ...habit, name, description, category, reward, onlyOn, weeklyTarget, praiseScore, inspirationFinishedOn };
  const habits = state.habits.map(item => item === habit ? updated : item);
  if (saveHabits(habits)) {
    el["action-editor-status"].textContent = "已保存";
    renderActionInspirationField(updated);
  }
});
el["action-editor-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (editingHabit || !editingHabitContext) return;
  if (editingHabitContext.saveKey !== activeForestSave().key()) {
    el["action-editor-status"].textContent = "当前存档已切换，请关闭后重新打开。";
    return;
  }
  const repeat = el["action-repeat"].value;
  if (!repeat) {
    el["action-repeat"].reportValidity();
    return;
  }
  const name = el["action-name"].value.trim();
  if (!name) {
    el["action-name"].setCustomValidity("请输入行动名称。");
    el["action-name"].reportValidity();
    return;
  }
  const description = el["action-description"].value.trim();
  const category = el["action-category"].value;
  const reward = el["action-reward"].valueAsNumber;
  const praiseScore = actionPraiseInput.value ? actionPraiseInput.valueAsNumber : undefined;
  const id = crypto.randomUUID?.() ?? `action-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  if (repeat === "weekly" && !el["action-weekly-target"].validity.valid) {
    el["action-editor-status"].textContent = "每周目标次数请输入 1–7 的整数。";
    return;
  }
  if (repeat === "once" && !el["action-only-date"].validity.valid) {
    el["action-editor-status"].textContent = "请选择今天或以前的限定日期。";
    return;
  }
  const onlyOn = repeat === "once" ? el["action-only-date"].value : undefined;
  const weeklyTarget = repeat === "weekly" ? el["action-weekly-target"].valueAsNumber : undefined;
  if (category === "food" && editingHabitContext.loadingPhoto) return;
  const photo = category === "food" ? editingHabitContext.photo : undefined;
  const habit = { id, name, description, category, reward, onlyOn, weeklyTarget, praiseScore, photo };
  const entries = [...state.entries];
  if (category === "inspiration" && inspirationCompletionInput.checked) {
    const { day } = editingHabitContext;
    if (onlyOn) addActionEntry(habit, onlyOn > day ? onlyOn : day, undefined, { ...state, entries });
    else habit.inspirationFinishedOn = day;
  }
  const habits = [...state.habits, habit];
  if ((!photo || actionPhotoFits(habits)) && saveHabits(habits, entries)) el["action-editor"].close();
});
el["delete-action"].addEventListener("click", () => {
  const habit = state.habits.find(item => item.id === editingHabit);
  if (!habit) return;
  el["action-delete-message"].textContent = `删除「${habit.name}」？相关记录和未领取的生命力会一起移除。`;
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
  const habits = state.habits.filter(habit => habit.id !== editingHabit);
  if (!saveHabits(habits, pruneActionEntries(state.entries, habits))) return;
  el["action-status"].textContent = "已删除行动及相关记录。";
  el["action-editor"].close();
});
el["action-editor"].addEventListener("close", () => {
  if (el["action-editor"].open) return;
  editingHabitContext = undefined;
  el["action-photo-preview"].removeAttribute("src");
  if (!el.actions.open) return;
  const habit = habitButtons.get(editingHabit);
  if (habit && !habit.row.hidden) {
    if (!habit.row.contains(document.activeElement)) habit.button.focus();
  } else {
    el["add-action"].focus();
  }
});

function playerLevel(xp = state.player.xp) {
  let level = 1;
  while (level < maxPlayerLevel && xp >= levelXpCosts[level]) {
    xp -= levelXpCosts[level];
    level++;
  }
  return { level, xp, needed: levelXpCosts[level] };
}

function migratePlayerXp(xp) {
  let level = 1;
  let oldCost = 200;
  let newXp = 0;
  while (level < maxPlayerLevel && xp >= oldCost) {
    xp -= oldCost;
    newXp += levelXpCosts[level];
    level++;
    oldCost += 80;
  }
  const progress = level === maxPlayerLevel ? xp : Math.floor(xp * levelXpCosts[level] / oldCost);
  return newXp + progress;
}

function isPlantUnlocked(unlockLevel, level = playerLevel().level) {
  return level >= unlockLevel || (inExperiment && state.allPlantsUnlocked === true);
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
  const avatar = state.player.avatar || forestAssetUrl(defaultAvatar);
  el["player-avatar-image"].src = avatar;
  el["profile-avatar-preview"].src = avatar;
  el["open-profile"].classList.toggle("custom-avatar", Boolean(state.player.avatar));
  el["profile-avatar-preview"].classList.toggle("custom-avatar", Boolean(state.player.avatar));
  el["reset-avatar"].hidden = !state.player.avatar;
}

function expansionLevel(step) {
  const expansion = step + 1;
  return expansion <= 5 ? expansion * 10 : 50 + (expansion - 5) * 5;
}

function expansionPrice(step) {
  return 30 + 10 * step;
}

function isOpenPlot(index, save = state) {
  return Number.isInteger(index) && index >= 0 && index < plots.length
    && (index < starterPlots || save.reclaimedPlots.includes(index)
      || save.experimentExpansions?.some(batch => batch.includes(index)) === true);
}

function nextExpansion() {
  const canReclaim = index => !isOpenPlot(index) && !state.trees.some(tree => tree.plot === index);
  const index = state.pendingExpansionPlots.find(index => !isOpenPlot(index))
    ?? (canReclaim(firstExpansionPlot) ? firstExpansionPlot : plots.findIndex((_, index) => canReclaim(index)));
  if (index < 0) return null;
  const step = state.reclaimedPlots.length;
  return { index, level: expansionLevel(step), price: expansionPrice(step) };
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
  el["open-ai-adventure-history"].hidden = !state.habits.some(isAiAdventure) && !aiAdventureRecords().length;
  const today = todayKey();
  const day = actionViewDay ?? today;
  const viewingPast = day !== today;
  if (day !== displayedDay) renderHabits(day);
  displayedDay = day;
  renderedToday = today;
  updatePlayer();
  const completed = new Map(state.entries.filter(entry => entry.date === day && !entry.weekly).map(entry => [entry.kind, entry]));
  let completedCount = 0;
  let goal = 0;
  let earnableReward = 0;
  let weekDone = 0;
  let weekGoal = 0;
  let weeklyCount = 0;
  for (const habit of state.habits) {
    const controls = habitButtons.get(habit.id);
    if (!controls) continue;
    const { button, control, edit, rewardAmount, description, row } = controls;
    const entry = completed.get(habit.id);
    const done = Boolean(entry);
    const repeat = habitRepeat(habit);
    const actionable = habit.category !== "inspiration" || repeat !== "once" || actionAvailableOn(habit, day, today);
    // 周常的打卡记录不带生命力，行内始终展示这项行动的奖励额度。
    const reward = repeat === "weekly" ? actionReward(habit) : actionReward(entry ?? habit);
    const weekTarget = repeat === "weekly" ? habit.weeklyTarget : 0;
    const weekProgress = repeat === "weekly" ? weeklyDone(habit, day) : 0;
    const weekMet = repeat === "weekly" && weekProgress >= weekTarget;
    // 周常按「本周」结算，不占今日进度；今日进度只统计今天必须做的日常与日抛行动。
    if (repeat === "weekly") {
      weeklyCount++;
      weekGoal += weekTarget;
      weekDone += Math.min(weekProgress, weekTarget);
    } else if (actionable || done) {
      goal++;
      if (done) completedCount++;
      else earnableReward += reward;
    }
    if (description && (repeat === "weekly" || activityRecordConfig(habit))) {
      const text = habitDetailText(habit, day, weekProgress);
      description.textContent = text;
      description.title = text;
    }
    row.dataset.week = weekMet ? "done" : "";
    control.disabled = !actionable;
    control.setAttribute("aria-pressed", String(done));
    button.setAttribute("aria-description", [
      actionCategories.get(habitCategory(habit)),
      repeatLabel(habit),
      repeat === "weekly" ? `本周 ${weekProgress}/${weekTarget}` : "",
      weekMet ? "本周已达标" : repeat === "weekly" ? `达标后一次性获得 ${reward} 点生命力` : "",
      actionPraiseLabel(habit.praiseScore),
      habit.description,
      activityRecordSummary(entry),
      repeat === "weekly" ? "" : `${reward} 点生命力`,
    ].filter(Boolean).join("，"));
    const activityConfig = activityRecordConfig(habit);
    const opensRecord = activityConfig && (day === today || entry?.[activityConfig.key]);
    if (isAiAdventure(habit) || opensRecord) control.setAttribute("aria-haspopup", "dialog");
    else control.removeAttribute("aria-haspopup");
    control.title = control.disabled ? "已在其它日期完成"
      : entry?.source === "finance-link" ? "已由存钱罐自动完成"
      : isAiAdventure(habit) ? done ? "追加学习记录" : "填写学习记录并完成"
      : opensRecord ? done ? "查看或修改当天记录" : "填写记录并完成"
      : done ? "取消完成" : weekMet ? "继续记录，本周奖励已结算" : "标记完成";
    rewardAmount.textContent = `+${reward}`;
    const rewardBox = rewardAmount.parentElement;
    rewardBox.classList.toggle("is-locked", repeat === "weekly" && !weekMet);
    rewardBox.title = repeat !== "weekly" ? "" : weekMet
      ? `本周已达标，可获得 ${reward} 点生命力`
      : `本周 ${weekTarget} 次达标后一次性获得 ${reward} 点`;
    // 历史日期可编辑日常/日抛及其限定日期。
    edit.disabled = false;
    edit.title = viewingPast ? "编辑这一天的行动" : "编辑行动";
  }
  const count = document.createElement("span");
  count.textContent = completedCount;
  el["action-count"].replaceChildren(count, ` / ${goal}`);
  el["action-day-label"].textContent = viewingPast ? formatDate(day) : "今日";
  el["action-day-label"].classList.toggle("is-past", viewingPast);
  el["action-day-label"].title = viewingPast ? "回到今天" : "今天";
  const dayWord = viewingPast ? "当天" : "今日";
  el["action-total-label"].textContent = `${dayWord}还可获得`;
  const progress = goal ? completedCount / goal : 0;
  el["action-progress"].style.setProperty("--progress", `${progress * 100}%`);
  for (const [index, leaf] of [...el["action-progress"].querySelectorAll("i")].entries()) {
    leaf.classList.toggle("is-complete", index < Math.round(progress * 5) && progress > 0);
  }
  el["action-week-line"].hidden = weeklyCount === 0;
  el["action-week-line"].firstElementChild.textContent = viewingPast ? "当周" : "本周";
  el["action-week-count"].textContent = `${weekDone} / ${weekGoal}`;
  el["action-week-line"].title = `${viewingPast ? "当" : "本"}周周常行动已完成 ${weekDone} 次，目标 ${weekGoal} 次`;
  el["action-total"].textContent = `+${earnableReward}`;
  // 今日必做的日常/日抛都完成时，右侧改说「已全部完成」，不再显示 +0。
  const todayDone = goal === 0 || completedCount === goal;
  el["action-total-pill"].classList.toggle("is-empty", todayDone);
  el["action-total-copy"].hidden = todayDone;
  el["action-total-done"].hidden = !todayDone;
  if (todayDone) {
    const doneLabel = document.createElement("strong");
    doneLabel.textContent = goal === 0 ? `${dayWord}暂无行动` : "已全部完成";
    if (goal === 0) {
      el["action-total-done"].replaceChildren(doneLabel);
    } else {
      el["action-total-done"].replaceChildren(`${dayWord}行动`, document.createElement("br"), doneLabel);
    }
    el["action-total-pill"].setAttribute("aria-label", goal === 0
      ? `${dayWord}没有必做的行动`
      : `${dayWord}必做的 ${goal} 项行动已全部完成，还可获得 ${earnableReward} 点生命力`);
  } else {
    el["action-total-pill"].setAttribute("aria-label", `${dayWord}还可获得 ${earnableReward} 点生命力`);
  }
  const { best, total: historyTotal, average } = actionHistory(state.entries, today);
  el["action-best-day"].textContent = best ? formatDate(best.date) : "暂无记录";
  el["action-best-points"].textContent = best ? `+${best.points}` : "";
  el["action-best-points"].hidden = !best;
  el["action-best-line"].dataset.empty = best ? "" : "true";
  el["action-best-line"].classList.toggle("is-today", best?.date === today);
  el["action-history-total"].textContent = historyTotal;
  el["action-average"].textContent = Number.isInteger(average) ? average : average.toFixed(1);
  el["open-action-calendar"].setAttribute("aria-description", best
    ? `历史最佳 ${formatDate(best.date)}，${best.points} 点生命力；累计 ${historyTotal} 点，日均 ${el["action-average"].textContent} 点`
    : "暂无历史记录");
  if (el["action-calendar-dialog"].open) renderActionCalendar();
  if (el["leaderboard-dialog"].open) renderLeaderboard();
  if (el["activity-board"].open) renderActivityBoard();

  const balance = availableEnergy();
  const pending = state.entries.reduce((total, entry) => entry.collected ? total : total + actionReward(entry), 0);
  el.balance.textContent = balance;
  el["shop-balance"].textContent = balance;
  el["collect-life"].disabled = pending === 0;
  el["pending-life"].hidden = pending === 0;
  el["pending-life"].textContent = `+${pending}`;
  el["collect-life"].setAttribute("aria-label", pending ? `收取 ${pending} 点生命力，当前 ${balance}` : `生命力 ${balance}`);
  const hasSeedlings = state.seedlings.length > 0;
  const hasOpenSoil = [...el.plots.children].some(button => !button.disabled && !button.matches(".locked, .planted"));
  const canPlant = hasOpenSoil && (hasSeedlings || balance >= minimumPrice);
  const { level } = playerLevel();
  const unlockButton = el["forest-unlock-plants"];
  unlockButton.disabled = [...plants.values()].every(plant => isPlantUnlocked(plant.unlockLevel, level));
  el["forest-unlock-status"].textContent = unlockButton.disabled ? "全部可种植物已解锁。" : "";
  for (const [id, { card, buy, stock, choicePrice }] of plantOptions) {
    const { name, price, unlockLevel } = plants.get(id);
    const owned = state.seedlings.filter(seedling => seedling.species === id).length;
    const locked = !isPlantUnlocked(unlockLevel, level);
    card.classList.toggle("is-locked", locked);
    buy.disabled = locked || balance < price;
    buy.textContent = locked ? `${unlockLevel} 级解锁` : "购买";
    buy.setAttribute("aria-label", locked ? `${name}，${unlockLevel} 级解锁` : `购买${name}，${price} 点生命力`);
    stock.textContent = `库存 ${owned}`;
    choicePrice.hidden = Boolean(owned) || !locked;
    choicePrice.textContent = `${unlockLevel} 级解锁`;
  }
  if (el["plant-picker"].open) updatePlantPickerAvailability(balance);
  for (const [id, { buy, stock, use, useStock }] of fertilizerOptions) {
    const owned = state.fertilizerPurchases.filter(purchase => purchase.id === id && !purchase.used).length;
    buy.disabled = balance < fertilizers.get(id).price;
    stock.textContent = `库存 ${owned}`;
    use.disabled = owned === 0;
    useStock.textContent = `库存 ${owned}`;
  }
  const sowSpecies = plants.get(sowing?.species);
  const readyToPlant = activeTool === "sow" ? Boolean(sowSpecies && (state.seedlings.some(seedling => seedling.species === sowing.species)
    || (isPlantUnlocked(sowSpecies.unlockLevel) && balance >= sowSpecies.price))) : canPlant && !activeTool;
  for (const button of el.plots.children) {
    button.classList.toggle("ready", readyToPlant && !button.matches(".locked, .planted"));
  }
  if (el["reclaim-dialog"].open) updateExpansionDialog();
  if (el["farm-inventory"].open) renderInventory();
  if (el.warehouse.open) renderWarehouse();
}

function tilePoints(grid, row, column) {
  return [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1], grid[row + 1][column]];
}

function plotGeometry(row, column) {
  const points = tilePoints(field, row, column);
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
    corners, points,
  };
}

// Map the terrain sample's two averaged edge directions onto the new tile.
function tileArtTransform(source, target) {
  const axes = ([top, right, bottom, left]) => top.map((value, axis) => ({
    across: (right[axis] - value + bottom[axis] - left[axis]) / 2,
    down: (left[axis] - value + bottom[axis] - right[axis]) / 2,
    center: (value + right[axis] + bottom[axis] + left[axis]) / 4,
  }));
  const [sx, sy] = axes(source);
  const [tx, ty] = axes(target);
  const determinant = sx.across * sy.down - sy.across * sx.down;
  const mapping = ({ across, down, center }) => {
    const x = (across * sy.down - down * sy.across) / determinant;
    const y = (down * sx.across - across * sx.down) / determinant;
    return [x, y, center - x * sx.center - y * sy.center];
  };
  const [a, c, e] = mapping(tx);
  const [b, d, f] = mapping(ty);
  return `matrix(${[a, b, c, d, e, f].join(" ")})`;
}

function roundedTile(corners) {
  const toward = (from, to) => interpolatePoint(from, to, .1);
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
  el.plots.style.setProperty("--painted-soil-edge", soilCover);
  el.plots.replaceChildren();
  for (const [index, [row, column]] of plots.entries()) {
    const locked = !isOpenPlot(index);
    const tree = locked ? undefined : state.trees.find(entry => entry.plot === index);
    const hasSign = next?.index === index;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.plot = index;
    button.className = tree ? "plot planted" : "plot";
    button.classList.toggle("locked", locked);
    const { left, top, width, height, rootX, rootY, corners, points } = plotGeometry(row, column);
    button.style.left = `${left / sceneWidth * 100}%`;
    button.style.top = `${top / sceneHeight * 100}%`;
    button.style.width = `${width / sceneWidth * 100}%`;
    button.style.height = `${height / sceneHeight * 100}%`;
    button.style.setProperty("--tile-outline", `polygon(${corners.map(([x, y]) => `${x}% ${y}%`).join(", ")})`);
    button.style.setProperty("--root-x", `${(rootX - left) / width * 100}%`);
    button.style.setProperty("--root-y", `${(rootY - top) / height * 100}%`);
    button.style.setProperty("--plot-depth", hasSign ? sceneHeight : Math.round(rootY));
    const sampleRow = Math.round(row * (paintedRows - 1) / (fieldSize - 1));
    const sampleColumn = Math.round(column * (paintedColumns - 2) / (fieldSize - 1));
    const source = locked ? turfSamples[sampleRow] : tilePoints(paintedField, sampleRow, sampleColumn);
    const artwork = forestAssetUrl(locked ? "./assets/peach-valley-terrace.webp" : "./assets/peach-valley-farm.webp");
    button.insertAdjacentHTML("beforeend", `
      <svg class="tile-art" aria-hidden="true" viewBox="${left} ${top} ${width} ${height}"
        preserveAspectRatio="none" style="clip-path:${roundedTile(corners)}">
        <image href="${artwork}" width="${sceneWidth}" height="${sceneHeight}" transform="${tileArtTransform(source, points)}"/>
      </svg>
    `);
    button.insertAdjacentHTML("beforeend", '<span class="tile-face"></span>');
    if (tree) {
      button.dataset.species = speciesId(tree);
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
  const uncollected = state.entries.filter(entry => !entry.collected);
  const whaleBonusIndex = uncollected.findIndex(entry => entry.kind === whaleMoodBonus && entry.date === todayKey());
  if (whaleBonusIndex > 0) uncollected.unshift(...uncollected.splice(whaleBonusIndex, 1));
  const pending = uncollected.slice(0, orbOffsets.length);
  for (const button of [...el.orbs.children]) {
    const entries = button.classList.contains("fly") ? state.entries : pending;
    if (!entries.some(entry => entry.id === button.dataset.entry)) button.remove();
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
      button.addEventListener("pointerenter", event => {
        if (event.pointerType !== "touch") showOrbTooltip(button);
      });
      button.addEventListener("pointerleave", () => {
        if (previewOrb === button && !button.matches(":focus-visible")) showOrbTooltip();
      });
      button.addEventListener("focus", () => {
        if (button.matches(":focus-visible")) showOrbTooltip(button);
      });
      button.addEventListener("blur", () => {
        if (previewOrb === button && !button.matches(":hover")) showOrbTooltip();
      });
      el.orbs.append(button);
    }
    const reward = actionReward(entry);
    button.setAttribute("aria-label", `收取 ${reward} 点生命力 · ${orbActionName(entry)}`);
    button.dataset.rewardTier = Math.min(reward, 3);
    button.style.setProperty("--x", `calc(${orbCenter[0]}% + ${x} * var(--orb-spacing))`);
    button.style.setProperty("--y", `calc(${orbCenter[1]}% + ${y} * var(--orb-spacing))`);
  }
  if (previewOrb) updateOrbTooltip();
}

function orbActionName(entry) {
  const habit = state.habits.find(item => item.id === entry.kind);
  return habit?.name ?? actionRecordLabel(entry);
}

function actionRecordLabel(entry) {
  return entry.actionLabel ?? defaultHabits[entry.kind]?.description ?? "示例生命力";
}

const activityRecordTypes = {
  workout: { key: "workout", label: "训练", textField: ["healthManagement", "健康管理"], fields: [
    ["pushups", "俯卧撑", "次"], ["situps", "仰卧起坐", "次"], ["backExtensions", "仰背", "次"],
    ["dumbbell", "哑铃", "次"], ["pullups", "引体向上", "次"], ["cableAbs", "滑轮练腹", "次"],
    ["burpees", "波比跳", "组"],
  ] },
  guitar: { key: "guitar", label: "练习", fields: [
    ["recording", "录歌", "首"], ["chorus", "合唱", "首"], ["bench", "板凳", "首"],
    ["songTrimming", "歌曲裁剪", "首"], ["wuweiPractice", "无尾练习", "min"], ["fastStrum", "速扫", "min"],
  ] },
};
let workoutContext;

function activityRecordConfig(habit) {
  if (habit.name.includes("小健身")) return activityRecordTypes.workout;
  if (habit.name.includes("吉他多种玩法")) return activityRecordTypes.guitar;
}

function activityRecordSummary(entry) {
  return Object.values(activityRecordTypes).flatMap(({ key, fields, textField }) => {
    const values = entry?.[key];
    if (!values) return [];
    const parts = fields.filter(([id]) => values[id] > 0)
      .map(([id, label, unit]) => `${label} ${values[id]} ${unit}`);
    if (textField && values[textField[0]]) parts.push(`${textField[1]}：${values[textField[0]]}`);
    return parts;
  }).join(" · ");
}

const activityPeriods = {
  day: { total: "当天合计" },
  week: { total: "当周合计" },
  month: { total: "当月合计", months: 1 },
  quarter: { total: "当季合计", months: 3 },
  year: { total: "当年合计", months: 12 },
};
const activityNumber = new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 12 });
const activityBoard = { type: "guitar", period: "day", day: "", calendarMonth: "", metrics: {} };
const activityBoardTypes = el["activity-board"].querySelectorAll("[data-activity-type]");
const activityBoardPeriods = el["activity-board"].querySelectorAll("[data-activity-period]");
const activityBoardScrollAreas = el["activity-board"].querySelectorAll(".activity-board-layout, #activity-board-records, #activity-board-bars");

function shiftActivityDay(day, step) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + step);
  return date.toISOString().slice(0, 10);
}

function activityPeriodRange(day, period) {
  const year = day.slice(0, 4);
  const month = Number(day.slice(5, 7));
  const fullDate = key => key.slice(0, 4) + "年" + formatDate(key);
  if (period === "day") return { start: day, end: day, label: fullDate(day) };
  if (period === "week") {
    const start = weekStart(day);
    const end = weekEnd(day);
    const endLabel = start.slice(0, 4) === end.slice(0, 4) ? formatDate(end) : fullDate(end);
    return { start, end, label: `${fullDate(start)} – ${endLabel}` };
  }
  const months = activityPeriods[period].months;
  const firstMonth = Math.floor((month - 1) / months) * months + 1;
  const start = `${year}-${String(firstMonth).padStart(2, "0")}-01`;
  const last = new Date(start + "T00:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + months, 0);
  const label = period === "month" ? `${year}年${month}月`
    : period === "quarter" ? `${year}年第 ${Math.ceil(month / 3)} 季度` : `${year}年`;
  return { start, end: last.toISOString().slice(0, 10), label };
}

function activityRecordDays(entries, config, today) {
  const days = new Map();
  for (const entry of entries) {
    const values = entry[config.key];
    if (!values || entry.weekly || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || entry.date > today) continue;
    const record = config.fields.flatMap(([id, label, unit]) => {
      const value = values[id];
      return Number.isFinite(value) && value > 0 ? [{ id, label, unit, value }] : [];
    });
    if (config.textField) {
      const [id, label] = config.textField;
      if (values[id]) record.push({ id, label, value: values[id] });
    }
    if (!record.length) continue;
    if (!days.has(entry.date)) days.set(entry.date, { date: entry.date, records: [], totals: {} });
    const day = days.get(entry.date);
    day.records.push(record);
    for (const { id, unit, value } of record) {
      if (unit) day.totals[id] = (day.totals[id] ?? 0) + value;
    }
  }
  return days;
}

function activityBoardSum(days, metric) {
  return days.reduce((sum, day) => sum + (day.totals[metric] ?? 0), 0);
}

function activityTrendBuckets({ start, end }, period) {
  const buckets = [];
  for (let day = start; day <= end;) {
    let last = day;
    let label = formatDate(day);
    if (period === "month") {
      const weekEnd = shiftActivityDay(day, 6);
      last = weekEnd < end ? weekEnd : end;
      label = `${Number(day.slice(8))}–${Number(last.slice(8))}日`;
      if (day === last) label = `${Number(day.slice(8))}日`;
    } else if (period !== "week") {
      last = activityPeriodRange(day, "month").end;
      label = `${Number(day.slice(5, 7))}月`;
    }
    buckets.push({ start: day, end: last, label });
    day = shiftActivityDay(last, 1);
  }
  return buckets;
}

function renderActivityBoardCalendar(days, today) {
  const month = activityBoard.calendarMonth;
  const start = month + "-01";
  const { end } = activityPeriodRange(start, "month");
  const date = new Date(start + "T00:00:00Z");
  const focusedDay = document.activeElement?.dataset.activityDate;
  const cells = Array.from({ length: (date.getUTCDay() + 6) % 7 }, () => document.createElement("span"));
  for (let day = start; day <= end; day = shiftActivityDay(day, 1)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.activityDate = day;
    button.textContent = Number(day.slice(8));
    button.disabled = day > today;
    button.setAttribute("aria-label", day + (days.has(day) ? "，有记录" : ""));
    button.setAttribute("aria-pressed", String(day === activityBoard.day));
    if (days.has(day)) button.dataset.progress = "partial";
    if (day === today) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => selectActivityBoardDay(day));
    cells.push(button);
  }
  el["activity-board-calendar-month"].textContent = calendarMonthFormat.format(date);
  el["activity-board-month-next"].disabled = month >= today.slice(0, 7);
  el["activity-board-calendar-days"].replaceChildren(...cells);
  if (focusedDay) cells.find(cell => cell.dataset.activityDate === focusedDay)?.focus();
}

function renderActivityBoardTrend(range, days, field) {
  const [metric, label, unit] = field;
  el["activity-board-trend-title"].textContent = `${label}趋势`;
  el["activity-board-trend-unit"].textContent = `单位 ${unit}`;
  const buckets = activityTrendBuckets(range, activityBoard.period).map(bucket => ({
    ...bucket, value: activityBoardSum(days.filter(day => day.date >= bucket.start && day.date <= bucket.end), metric),
  }));
  const bars = el["activity-board-bars"];
  const max = Math.max(...buckets.map(bucket => bucket.value));
  if (!max) {
    const empty = document.createElement("p");
    empty.className = "activity-board-empty";
    empty.textContent = "该项目在这个周期暂无记录。";
    bars.replaceChildren(empty);
    return;
  }
  const chart = document.createElement("ul");
  chart.className = "activity-board-chart";
  chart.style.setProperty("--buckets", buckets.length);
  for (const { value, label } of buckets) {
    const column = document.createElement("li");
    const plot = document.createElement("span");
    plot.className = "activity-board-plot";
    const number = document.createElement("strong");
    number.textContent = value ? activityNumber.format(value) : "—";
    const bar = document.createElement("i");
    bar.style.height = value ? `max(2px, ${value / max * 100}%)` : "0";
    bar.setAttribute("aria-hidden", "true");
    const tick = document.createElement("span");
    tick.className = "activity-board-tick";
    tick.textContent = label;
    plot.append(number, bar);
    column.append(plot, tick);
    chart.append(column);
  }
  bars.replaceChildren(chart);
}

function renderActivityBoardRecords(days, daily, config) {
  const list = el["activity-board-records"];
  el["activity-board-records-title"].textContent = daily ? "当天记录" : "按日期查看记录";
  if (!days.length) {
    const empty = document.createElement("p");
    empty.className = "activity-board-empty";
    empty.textContent = daily ? `这一天暂无${config.label}记录。` : `这个周期暂无${config.label}记录。`;
    list.replaceChildren(empty);
    return;
  }
  if (daily) {
    list.replaceChildren(...days[0].records.map((record, index) => {
      const row = document.createElement("div");
      row.className = "activity-board-record";
      const title = document.createElement("strong");
      title.textContent = `第 ${index + 1} 笔`;
      const details = document.createElement("span");
      details.textContent = record.map(({ label, value, unit }) =>
        unit ? `${label} ${activityNumber.format(value)} ${unit}` : `${label}：${value}`).join(" · ");
      row.append(title, details);
      return row;
    }));
    return;
  }
  list.replaceChildren(...days.map(({ date, records }) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "activity-board-record";
    const label = document.createElement("strong");
    label.textContent = formatDate(date);
    const count = document.createElement("span");
    count.textContent = `${records.length} 笔 ›`;
    row.append(label, count);
    row.addEventListener("click", () => {
      activityBoard.period = "day";
      setActivityBoardCalendar(false);
      selectActivityBoardDay(date);
      el["activity-board-records-title"].focus();
    });
    return row;
  }));
}

function renderActivityBoard() {
  const today = todayKey();
  const { type, day, period, metrics } = activityBoard;
  const config = activityRecordTypes[type];
  const range = activityPeriodRange(day, period);
  const daily = period === "day";
  const allDays = activityRecordDays(state.entries, config, today);
  const days = [...allDays.values()].filter(day => day.date >= range.start && day.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date));
  const count = days.reduce((sum, day) => sum + day.records.length, 0);
  const totals = config.fields.map(([id]) => activityBoardSum(days, id));
  const selected = metrics[type] ?? config.fields[Math.max(0, totals.findIndex(value => value > 0))][0];
  for (const button of activityBoardTypes) button.setAttribute("aria-pressed", String(button.dataset.activityType === type));
  for (const button of activityBoardPeriods) button.setAttribute("aria-pressed", String(button.dataset.activityPeriod === period));
  el["activity-board-range"].textContent = range.label;
  el["activity-board-calendar-toggle"].setAttribute("aria-label", `选择日期，${range.label}`);
  el["activity-board-next"].disabled = range.end >= today;
  el["activity-board-total-title"].textContent = activityPeriods[period].total;
  el["activity-board-count"].textContent = daily ? `${count} 笔记录` : `${count} 笔记录 · ${days.length} 个${config.label}日`;
  const focusedMetric = document.activeElement?.dataset.activityMetric;
  const cards = config.fields.map(([id, label, unit], index) => {
    const card = document.createElement(daily ? "div" : "button");
    card.className = "activity-board-metric";
    if (!daily) {
      card.type = "button";
      card.dataset.activityMetric = id;
      card.setAttribute("aria-pressed", String(id === selected));
      card.addEventListener("click", () => {
        metrics[type] = id;
        renderActivityBoard();
      });
    }
    const name = document.createElement("span");
    name.textContent = label;
    const value = document.createElement("strong");
    value.textContent = totals[index] ? activityNumber.format(totals[index]) : "—";
    const suffix = document.createElement("small");
    suffix.textContent = totals[index] ? unit : "";
    card.append(name, value, suffix);
    return card;
  });
  el["activity-board-metrics"].replaceChildren(...cards);
  if (focusedMetric) cards.find(card => card.dataset.activityMetric === focusedMetric)?.focus();
  el["activity-board-trend"].hidden = daily || !days.length;
  if (!el["activity-board-trend"].hidden) {
    renderActivityBoardTrend(range, days, config.fields.find(([id]) => id === selected));
  }
  renderActivityBoardRecords(days, daily, config);
  if (!el["activity-board-calendar"].hidden) renderActivityBoardCalendar(allDays, today);
}

function selectActivityBoardDay(day) {
  activityBoard.day = day;
  activityBoard.calendarMonth = day.slice(0, 7);
  renderActivityBoard();
}

function setActivityBoardCalendar(open) {
  el["activity-board-calendar"].hidden = !open;
  el["activity-board-calendar-toggle"].setAttribute("aria-expanded", String(open));
}

function bindAutoHideScrollbars(dialog, areas) {
  dialog.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse") return;
    const { clientX: x, clientY: y } = event;
    for (const area of areas) {
      const { left, right, top, bottom } = area.getBoundingClientRect();
      const inside = x >= left && x <= right && y >= top && y <= bottom;
      const vertical = area.scrollHeight > area.clientHeight && right - x <= (area.offsetWidth - area.clientWidth || 8);
      const horizontal = area.scrollWidth > area.clientWidth && bottom - y <= (area.offsetHeight - area.clientHeight || 8);
      area.classList.toggle("scrollbar-hover", inside && (vertical || horizontal));
    }
  });
  dialog.addEventListener("pointerleave", () => {
    for (const area of areas) area.classList.remove("scrollbar-hover");
  });
  for (const area of areas) {
    let hideScrollbar;
    area.addEventListener("scroll", () => {
      if (!dialog.open) return;
      area.classList.add("is-scrolling");
      clearTimeout(hideScrollbar);
      hideScrollbar = setTimeout(() => area.classList.remove("is-scrolling"), 500);
    });
    dialog.addEventListener("close", () => {
      clearTimeout(hideScrollbar);
      area.classList.remove("scrollbar-hover", "is-scrolling");
    });
  }
}

bindAutoHideScrollbars(el["activity-board"], activityBoardScrollAreas);
bindAutoHideScrollbars(el.actions, [el.habits]);

el["open-activity-board"].addEventListener("click", () => {
  setActivityBoardCalendar(false);
  activityBoard.period = "day";
  selectActivityBoardDay(actionEditorDay());
  el["activity-board"].showModal();
  el["activity-board-title"].focus();
});
for (const button of activityBoardTypes) {
  button.addEventListener("click", () => {
    activityBoard.type = button.dataset.activityType;
    renderActivityBoard();
  });
}
for (const button of activityBoardPeriods) {
  button.addEventListener("click", () => {
    activityBoard.period = button.dataset.activityPeriod;
    setActivityBoardCalendar(false);
    renderActivityBoard();
  });
}
for (const [id, step] of [["activity-board-prev", -1], ["activity-board-next", 1]]) {
  el[id].addEventListener("click", () => {
    const { start, end } = activityPeriodRange(activityBoard.day, activityBoard.period);
    selectActivityBoardDay(shiftActivityDay(step < 0 ? start : end, step));
    if (el[id].disabled) el["activity-board-calendar-toggle"].focus();
  });
}
el["activity-board-calendar-toggle"].addEventListener("click", () => {
  const open = el["activity-board-calendar"].hidden;
  setActivityBoardCalendar(open);
  if (!open) return;
  activityBoard.calendarMonth = activityBoard.day.slice(0, 7);
  renderActivityBoard();
  el["activity-board-calendar-days"].querySelector('[aria-pressed="true"]')?.focus();
});
for (const [id, step] of [["activity-board-month-prev", -1], ["activity-board-month-next", 1]]) {
  el[id].addEventListener("click", () => {
    const month = new Date(activityBoard.calendarMonth + "-01T00:00:00Z");
    month.setUTCMonth(month.getUTCMonth() + step);
    activityBoard.calendarMonth = month.toISOString().slice(0, 7);
    const today = todayKey();
    renderActivityBoardCalendar(activityRecordDays(state.entries, activityRecordTypes[activityBoard.type], today), today);
    if (el[id].disabled) el["activity-board-month-prev"].focus();
  });
}
el["activity-board-today"].addEventListener("click", () => selectActivityBoardDay(todayKey()));

function renderWorkoutFields(config, entry) {
  el["workout-fields"].replaceChildren();
  for (const [id, name, unit] of config.fields) {
    const label = document.createElement("label");
    label.htmlFor = `workout-${id}`;
    label.append(document.createTextNode(name));
    const value = document.createElement("span");
    value.className = "workout-field-value";
    const input = document.createElement("input");
    input.id = `workout-${id}`;
    input.name = id;
    input.type = "number";
    input.min = "0";
    input.step = unit === "min" ? "any" : "1";
    input.inputMode = unit === "min" ? "decimal" : "numeric";
    input.value = entry?.[config.key]?.[id] ?? "";
    value.append(input, document.createTextNode(unit));
    label.append(value);
    el["workout-fields"].append(label);
  }
  if (config.textField) {
    const [id, name] = config.textField;
    const label = document.createElement("label");
    const input = document.createElement("textarea");
    input.id = `workout-${id}`;
    input.name = id;
    input.rows = 3;
    input.value = entry?.[config.key]?.[id] ?? "";
    label.className = "workout-text-field";
    label.htmlFor = input.id;
    label.append(name, input);
    el["workout-fields"].append(label);
  }
}

function openWorkout(habit, date, status, entry) {
  const config = activityRecordConfig(habit);
  workoutContext = { kind: habit.id, field: config.key, date, status, saveKey: activeForestSave().key(), entry: JSON.stringify(entry) };
  el["workout-title"].textContent = `${habit.name} · ${config.label}记录`;
  el["workout-guide"].textContent = config.textField ? "填写训练次数、组数或健康管理内容，其他项目可留空。"
    : `填写本次${config.label}的数值，没做的项目可留空。`;
  el["workout-date"].textContent = `${date} · ${repeatLabel(habit)}`;
  el["workout-status"].textContent = "";
  el["workout-save"].textContent = entry ? "保存修改" : "保存并完成";
  el["workout-undo"].hidden = !entry;
  renderWorkoutFields(config, entry);
  el["workout-dialog"].showModal();
}

el["workout-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (!el["workout-dialog"].open) return;
  const context = workoutContext;
  const habit = state.habits.find(item => item.id === context?.kind);
  const config = habit && activityRecordConfig(habit);
  const entry = state.entries.find(item => item.kind === context?.kind && item.date === context?.date && !item.weekly);
  if (!config || config.key !== context.field || context.saveKey !== activeForestSave().key() || JSON.stringify(entry) !== context.entry || !actionAvailableOn(habit, context.date, todayKey())) {
    el["workout-status"].textContent = "行动或记录已变化，请关闭窗口后重新打开。";
    return;
  }
  const workout = {};
  for (const [id, , unit] of config.fields) {
    const input = el["workout-form"].elements.namedItem(id);
    const value = input.value === "" ? 0 : input.valueAsNumber;
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (unit !== "min" && !Number.isSafeInteger(value))) {
      el["workout-status"].textContent = config.key === "workout" ? "次数和组数请填写大于等于 0 的整数。" : "首数请填写非负整数，分钟可填非负小数。";
      return;
    }
    if (value > 0) workout[id] = value;
  }
  if (config.textField) {
    const [id] = config.textField;
    const value = el["workout-form"].elements.namedItem(id).value.trim();
    if (value) workout[id] = value;
  }
  if (!Object.keys(workout).length) {
    el["workout-status"].textContent = config.textField ? "请至少填写一项训练数据或健康管理内容。"
      : `请至少填写一个项目的${config.label}数值。`;
    return;
  }
  if (entry) {
    const previous = entry[config.key];
    entry[config.key] = workout;
    if (!saveState()) {
      if (previous === undefined) delete entry[config.key];
      else entry[config.key] = previous;
      el["workout-status"].textContent = `浏览器无法保存${config.label}记录，请重试。`;
      return;
    }
    updateControls();
    context.status.textContent = `当天${config.label}记录已更新。`;
  } else if (!record(habit, context.date, el["workout-status"], { [config.key]: workout })) {
    return;
  } else {
    context.status.textContent = el["workout-status"].textContent;
  }
  el["workout-dialog"].close();
});

el["workout-undo"].addEventListener("click", () => {
  const context = workoutContext;
  if (!context || context.saveKey !== activeForestSave().key()) return;
  const entry = state.entries.find(item => item.kind === context.kind && item.date === context.date && !item.weekly);
  if (JSON.stringify(entry) !== context.entry) {
    el["workout-status"].textContent = "记录已变化，请关闭窗口后重新打开。";
    return;
  }
  toggleActionCompletion(context.kind, context.date, el["workout-status"], true);
  const remaining = state.entries.some(entry => entry.kind === context.kind && entry.date === context.date && !entry.weekly);
  if (!remaining) {
    context.status.textContent = el["workout-status"].textContent;
    el["workout-dialog"].close();
  }
});

function isAiAdventure(habit) {
  return habit?.name?.trim() === "AI大冒险";
}

function aiAdventureRecords() {
  return Array.isArray(state.aiAdventureRecords) ? state.aiAdventureRecords : [];
}

let aiAdventureContext;
let pendingAiAdventureDelete;
let aiAdventurePeriod = "day";
const aiAdventureEditor = el["ai-adventure-editor"];
const aiAdventureHistory = el["ai-adventure-history"];
const aiAdventureDeleteDialog = el["ai-adventure-delete-dialog"];
const aiAdventureForm = el["ai-adventure-form"];
const aiAdventureStatus = el["ai-adventure-status"];
const aiAdventurePeriods = aiAdventureHistory.querySelectorAll("[data-ai-period]");
const aiAdventureModes = aiAdventureHistory.querySelectorAll("[data-adventure-mode]");

function setAiAdventureMode(mode) {
  if (mode) aiAdventureHistory.dataset.recordMode = mode;
  else delete aiAdventureHistory.dataset.recordMode;
  for (const button of aiAdventureModes) {
    button.setAttribute("aria-pressed", String(button.dataset.adventureMode === mode));
  }
}

for (const button of aiAdventureModes) {
  button.addEventListener("click", () => {
    const mode = button.dataset.adventureMode;
    setAiAdventureMode(aiAdventureHistory.dataset.recordMode === mode ? "" : mode);
  });
}

function updateAiAdventureQuality() {
  const score = el["ai-adventure-score"].valueAsNumber;
  const badge = el["ai-adventure-quality"];
  const tier = actionPraiseTier(score);
  badge.dataset.tier = tier;
  badge.textContent = actionPraiseQualities[tier] ?? "";
}

function openAiAdventure({ kind, date, status, completed = false, note }) {
  aiAdventureContext = { kind, date, status, note, photo: actionPhoto(note), saveKey: activeForestSave().key() };
  aiAdventureForm.reset();
  if (note) {
    el["ai-adventure-title"].value = note.title;
    el["ai-adventure-body"].value = note.body;
    el["ai-adventure-minutes"].value = note.minutes;
    el["ai-adventure-score"].value = note.score ?? "";
  }
  updateAiAdventureQuality();
  const label = note ? "编辑学习记录" : completed ? "追加学习记录" : "记录这次学习";
  el["ai-adventure-editor-day"].textContent = `${date.slice(0, 4)}年${formatDate(date)} · ${label}`;
  el["ai-adventure-submit"].textContent = note ? "保存修改" : completed ? "保存记录" : "保存并完成";
  el["ai-adventure-skip"].hidden = Boolean(note) || completed;
  el["ai-adventure-undo"].hidden = Boolean(note) || !completed;
  aiAdventureStatus.textContent = "";
  el["ai-adventure-photo-status"].textContent = "";
  renderAiAdventurePhoto();
  aiAdventureEditor.showModal();
}

function renderAiAdventurePhoto() {
  const { photo, loadingPhoto } = aiAdventureContext;
  const preview = el["ai-adventure-photo-preview"];
  preview.hidden = !photo;
  if (photo) preview.src = photo;
  else preview.removeAttribute("src");
  el["ai-adventure-photo-choose"].textContent = photo ? "更换图片" : "上传图片";
  el["ai-adventure-photo-choose"].disabled = Boolean(loadingPhoto);
  el["ai-adventure-photo-remove"].hidden = !photo;
  el["ai-adventure-photo-remove"].disabled = Boolean(loadingPhoto);
  el["ai-adventure-submit"].disabled = Boolean(loadingPhoto);
}

el["ai-adventure-photo-choose"].addEventListener("click", () => el["ai-adventure-photo-file"].click());
el["ai-adventure-photo-remove"].addEventListener("click", () => {
  aiAdventureContext.photo = undefined;
  el["ai-adventure-photo-status"].textContent = "";
  renderAiAdventurePhoto();
  el["ai-adventure-photo-choose"].focus();
});
el["ai-adventure-photo-file"].addEventListener("change", async event => {
  const file = event.currentTarget.files[0];
  event.currentTarget.value = "";
  const context = aiAdventureContext;
  if (!file || !aiAdventureEditor.open || !context || context.loadingPhoto) return;
  const status = el["ai-adventure-photo-status"];
  if (!isSupportedActionPhoto(file)) {
    status.textContent = "请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。";
    return;
  }
  const currentEditor = () => aiAdventureEditor.open && aiAdventureContext === context
    && context.saveKey === activeForestSave().key();
  context.loadingPhoto = true;
  renderAiAdventurePhoto();
  status.textContent = "正在处理图片…";
  try {
    const photo = await compressActionPhoto(file);
    if (currentEditor()) {
      context.photo = photo;
      status.textContent = "";
    }
  } catch {
    if (currentEditor()) status.textContent = "无法读取这张图片，请换一张。";
  } finally {
    context.loadingPhoto = false;
    if (currentEditor()) renderAiAdventurePhoto();
  }
});

function currentAiAdventure() {
  const context = aiAdventureContext;
  const habit = state.habits.find(item => item.id === context?.kind);
  if (!isAiAdventure(habit) || context.saveKey !== activeForestSave().key() || !actionAvailableOn(habit, context.date, todayKey())) {
    aiAdventureStatus.textContent = "行动或存档已变化，请关闭后重新打开。";
    return;
  }
  const completed = state.entries.some(entry => entry.kind === habit.id && entry.date === context.date && !entry.weekly);
  return { ...context, habit, completed };
}

el["ai-adventure-score"].addEventListener("input", updateAiAdventureQuality);
aiAdventureForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!aiAdventureEditor.open || aiAdventureContext?.loadingPhoto) return;
  const editing = aiAdventureContext?.note;
  const context = editing ? aiAdventureContext : currentAiAdventure();
  if (!context) return;
  const title = el["ai-adventure-title"].value.trim();
  const body = el["ai-adventure-body"].value.trim();
  const minutes = el["ai-adventure-minutes"].valueAsNumber;
  const scoreField = el["ai-adventure-score"];
  const score = scoreField.valueAsNumber;
  if (!title || !body || !Number.isSafeInteger(minutes) || minutes < 1 ||
    (!scoreField.validity.valid || (scoreField.value && actionPraiseTier(score) < 0))) {
    aiAdventureStatus.textContent = "请填写标题、正文和用时。宝藏指数可留空，填写时须为 80–100 的整数。";
    return;
  }
  const records = aiAdventureRecords();
  const editIndex = editing ? records.findIndex(note => note?.id === editing.id) : -1;
  if (editing && (context.saveKey !== activeForestSave().key() ||
    JSON.stringify(records[editIndex]) !== JSON.stringify(editing))) {
    aiAdventureStatus.textContent = "这条记录已变化，请关闭后重新打开。";
    return;
  }
  const fields = { title, body, minutes, score: scoreField.value ? score : undefined, photo: context.photo };
  const updatedRecords = editing
    ? records.map((note, index) => index === editIndex ? { ...note, ...fields } : note)
    : [...records, { id: crypto.randomUUID(), date: context.date, createdAt: new Date().toISOString(), ...fields }];
  const snapshot = { ...state, aiAdventureRecords: updatedRecords };
  const validatePhoto = context.photo && context.photo !== actionPhoto(editing)
    ? draft => photoFitsInSnapshot(draft, aiAdventureStatus) : undefined;
  if (editing || context.completed) {
    if (validatePhoto && !validatePhoto(snapshot)) return;
    if (!saveState(snapshot)) {
      aiAdventureStatus.textContent = "浏览器无法保存，草稿仍在窗口中，请重试。";
      return;
    }
    state = snapshot;
    if (!editing) context.status.textContent = "已追加一条学习记录。";
  } else {
    snapshot.entries = [...state.entries];
    if (!record(context.habit, context.date, aiAdventureStatus, undefined, snapshot, validatePhoto)) return;
    context.status.textContent = aiAdventureStatus.textContent;
  }
  aiAdventureEditor.close();
  if (editing) {
    renderAiAdventureHistory();
    el["ai-adventure-history-title"].focus();
  }
});

el["ai-adventure-skip"].addEventListener("click", () => {
  const context = currentAiAdventure();
  if (!context || context.completed) return;
  if (record(context.habit, context.date, aiAdventureStatus)) {
    context.status.textContent = aiAdventureStatus.textContent;
    aiAdventureEditor.close();
  }
});

el["ai-adventure-undo"].addEventListener("click", () => {
  const context = currentAiAdventure();
  if (!context || !context.completed) return;
  toggleActionCompletion(context.kind, context.date, aiAdventureStatus, true);
  if (state.entries.some(entry => entry.kind === context.kind && entry.date === context.date && !entry.weekly)) return;
  context.status.textContent = aiAdventureStatus.textContent;
  aiAdventureEditor.close();
});

function renderAiAdventureHistory() {
  const day = el["ai-adventure-day"].value || todayKey();
  const { start, end, label } = activityPeriodRange(day, aiAdventurePeriod);
  const byScore = el["ai-adventure-sort"].value === "score";
  const records = aiAdventureRecords().filter(note =>
    note?.date >= start && note.date <= end && typeof note.createdAt === "string").reverse()
    .sort((left, right) =>
      (byScore ? (right.score ?? 0) - (left.score ?? 0) : 0) ||
      right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt));
  el["ai-adventure-range"].textContent = `${label} · ${records.length} 条记录`;
  const cards = records.map(note => {
    const card = document.createElement("article");
    card.className = "adventure-record";
    const heading = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = note.title;
    heading.append(title);
    const quality = actionPraiseLabel(note.score);
    if (quality) {
      const badge = document.createElement("span");
      badge.className = "adventure-quality";
      badge.dataset.tier = actionPraiseTier(note.score);
      badge.textContent = quality;
      heading.append(badge);
    }
    const metaRow = document.createElement("div");
    metaRow.className = "adventure-record-meta";
    const meta = document.createElement("small");
    meta.textContent = `${note.date.slice(0, 4)}年${formatDate(note.date)} · ${note.minutes} 分钟`;
    const actions = document.createElement("div");
    actions.className = "adventure-record-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.recordAction = "edit";
    edit.textContent = "编辑";
    edit.setAttribute("aria-label", `编辑学习记录：${note.title}`);
    edit.setAttribute("aria-haspopup", "dialog");
    edit.addEventListener("click", () => openAiAdventure({ date: note.date, note }));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.recordAction = "delete";
    remove.className = "adventure-record-delete";
    remove.textContent = "删除";
    remove.setAttribute("aria-label", `删除学习记录：${note.title}`);
    remove.setAttribute("aria-haspopup", "dialog");
    remove.addEventListener("click", () => {
      pendingAiAdventureDelete = { id: note.id, saveKey: activeForestSave().key() };
      el["ai-adventure-delete-copy"].textContent = `确定删除「${note.title}」这条学习记录吗？`;
      el["ai-adventure-delete-status"].textContent = "";
      aiAdventureDeleteDialog.showModal();
    });
    actions.append(edit, remove);
    metaRow.append(meta, actions);
    const body = document.createElement("p");
    body.textContent = note.body;
    card.append(heading, metaRow, body);
    const photo = actionPhoto(note);
    if (photo) {
      const view = document.createElement("button");
      view.type = "button";
      view.className = "adventure-record-photo";
      view.setAttribute("aria-label", `查看「${note.title}」的配图`);
      view.setAttribute("aria-haspopup", "dialog");
      const thumbnail = document.createElement("img");
      thumbnail.src = photo;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      view.append(thumbnail);
      view.addEventListener("click", () => openActionPhoto(note.title, photo, "学习记录配图"));
      card.append(view);
    }
    return card;
  });
  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "adventure-empty";
    empty.textContent = "这段时间还没有学习记录。";
    cards.push(empty);
  }
  el["ai-adventure-records"].replaceChildren(...cards);
}

el["ai-adventure-delete-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (event.submitter?.value !== "delete") {
    aiAdventureDeleteDialog.close();
    return;
  }
  const pending = pendingAiAdventureDelete;
  if (!aiAdventureDeleteDialog.open || !pending || pending.saveKey !== activeForestSave().key()) return;
  const records = aiAdventureRecords();
  const index = records.findIndex(note => note?.id === pending.id);
  if (index < 0) {
    el["ai-adventure-delete-status"].textContent = "这条记录已不存在。";
    return;
  }
  const snapshot = { ...state, aiAdventureRecords: records.filter((_, position) => position !== index) };
  if (!saveState(snapshot)) {
    el["ai-adventure-delete-status"].textContent = "浏览器无法保存此次删除，请重试。";
    return;
  }
  state = snapshot;
  aiAdventureDeleteDialog.close();
  renderAiAdventureHistory();
  updateControls();
  el["ai-adventure-history-title"].focus();
});

el["open-ai-adventure-history"].addEventListener("click", () => {
  setAiAdventureMode("");
  el["ai-adventure-day"].max = todayKey();
  el["ai-adventure-day"].value = actionEditorDay();
  renderAiAdventureHistory();
  aiAdventureHistory.showModal();
});
for (const button of aiAdventurePeriods) {
  button.addEventListener("click", () => {
    aiAdventurePeriod = button.dataset.aiPeriod;
    for (const tab of aiAdventurePeriods) tab.setAttribute("aria-pressed", String(tab === button));
    renderAiAdventureHistory();
  });
}
el["ai-adventure-day"].addEventListener("change", renderAiAdventureHistory);
el["ai-adventure-sort"].addEventListener("change", renderAiAdventureHistory);

function toggleActionCompletion(kind, date = todayKey(), status = el["action-status"], skipRecordDialog = false) {
  const day = todayKey();
  if (day !== renderedToday) updateControls();
  const habit = state.habits.find(item => item.id === kind);
  if (!habit || date > day || !actionAvailableOn(habit, date, day)) return;
  const index = state.entries.findIndex(entry => entry.date === date && entry.kind === kind && !entry.weekly);
  if (!skipRecordDialog && isAiAdventure(habit)) {
    openAiAdventure({ kind, date, status, completed: index >= 0 });
    return;
  }
  const config = activityRecordConfig(habit);
  if (!skipRecordDialog && config && (date === day || state.entries[index]?.[config.key])) {
    openWorkout(habit, date, status, state.entries[index]);
    return;
  }
  if (index < 0) {
    record(habit, date, status);
    return;
  }

  const entry = state.entries[index];
  if (entry.source === "finance-link") {
    status.textContent = "这项行动由存钱罐的记账记录自动完成。";
    return;
  }
  const spent = spentEnergyIds();
  // Only revoke the weekly reward when removing this mark drops progress below the target.
  const losesWeeklyTarget = habitRepeat(habit) === "weekly" && weeklyDone(habit, date) - 1 < habit.weeklyTarget;
  const award = losesWeeklyTarget ? weeklyAwardEntry(habit, date) : undefined;
  const awardSpent = award && [...spent].some(id => energyEntryId(id) === award.id);
  if (awardSpent) {
    status.textContent = "本周达标奖励的生命力已花费，撤回这次打卡会不满足达标条件。";
    return;
  }
  if ([...spent].some(id => energyEntryId(id) === entry.id)) {
    status.textContent = "❌这项行动的生命力已花费，无法取消完成。";
    return;
  }

  const previous = state.entries;
  state.entries = previous.filter(item => item !== entry && item !== award);
  if (!saveState()) {
    state.entries = previous;
    status.textContent = "浏览器无法保存，取消完成失败。";
    return;
  }
  refreshActionCompletion(habit, date);
  const spentByEntry = countSpentEnergyByEntry(spent);
  const deducted = remainingEntryEnergy(entry, spentByEntry) + (award ? remainingEntryEnergy(award, spentByEntry) : 0);
  status.textContent = deducted ? `已取消完成，扣回 ${deducted} 点生命力。` : "已取消完成，待领取的生命力已撤回。";
}

function refreshActionCompletion(habit, date) {
  const visibleDay = actionEditorDay();
  if (habit.category === "inspiration" && habit.onlyOn && date !== visibleDay) renderHabits(visibleDay);
  renderOrbs();
  updateControls();
}

function addActionEntry(habit, date, source, snapshot = state) {
  const { id: kind } = habit;
  const actionLabel = habit.description ? `${habit.name} · ${habit.description}` : habit.name;
  const weekly = habitRepeat(habit) === "weekly";
  // 周常这时只是打卡，不给生命力；本周次数达标后由 awardWeekly 一次性结算。
  const entry = {
    id: `${date}:${kind}`,
    date,
    kind,
    actionLabel,
    reward: weekly ? 0 : actionReward(habit),
    // 周常打卡不进待领取（collected = true 只是「不需要领取」，生命力量本身为 0）。
    collected: weekly,
    source,
  };
  if (weekly) entry.weeklyMark = true;
  snapshot.entries.push(entry);
  const award = awardWeekly(habit, date, snapshot);
  return { reward: actionReward(habit), award, weekly, entry };
}

function record(habit, date, status, details, snapshot = state, validateSnapshot) {
  const previousLength = snapshot.entries.length;
  const { reward, award, weekly, entry } = addActionEntry(habit, date, undefined, snapshot);
  if (details) Object.assign(entry, details);
  if (validateSnapshot && !validateSnapshot(snapshot)) {
    snapshot.entries.length = previousLength;
    return false;
  }
  if (!saveState(snapshot)) {
    snapshot.entries.length = previousLength;
    status.textContent = "浏览器无法保存，标记完成失败。";
    return false;
  }
  state = snapshot;
  refreshActionCompletion(habit, date);
  if (weekly) {
    const done = weeklyDone(habit, date);
    status.textContent = award
      ? `本周 ${habit.weeklyTarget} 次达标，${reward} 点生命力可在家门口领取。`
      : done >= habit.weeklyTarget ? `已记录本周第 ${done} 次，本周目标已完成。`
        : `已记录本周第 ${done} 次，还差 ${habit.weeklyTarget - done} 次达标。`;
    return true;
  }
  status.textContent = `已标记完成，${reward} 点生命力可在家门口领取。`;
  return true;
}

function applyFinanceLink({ date, recorded, happy }) {
  if (date !== todayKey()) return false;
  if (recorded !== true) return true;
  const snapshot = inExperiment ? readState() : state;
  const previousLength = snapshot.entries.length;
  const habit = snapshot.habits.find(item => item.name.trim() === "伊比理财" && actionScheduledOn(item, date, snapshot.entries));
  const completed = habit && !snapshot.entries.some(entry => entry.date === date && entry.kind === habit.id);
  if (completed) addActionEntry(habit, date, "finance-link", snapshot);

  const id = `${date}:${whaleMoodBonus}`;
  if (happy === true && !snapshot.entries.some(entry => entry.id === id)) {
    snapshot.entries.push({ id, date, kind: whaleMoodBonus, actionLabel: "鲸鱼娘开心奖励", reward: 2, collected: false });
  }
  if (snapshot.entries.length === previousLength) return true;
  if (!saveState(snapshot, forestSave)) {
    snapshot.entries.length = previousLength;
    return false;
  }
  if (inExperiment) return true;
  renderOrbs();
  updateControls();
  if (el.journal.open) {
    const tree = state.trees.find(item => item.plot === journalPlot);
    if (tree || journalPlot === undefined) updateJournalRecords(tree);
  }
  if (completed && el.actions.open) el["action-status"].textContent = "伊比理财已根据今天的记账自动完成。";
  return true;
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
  playEffect(sunCollectSound);
  animateCollection(entries);
  renderOrbs();
  updateControls();
  const reward = entries.reduce((total, entry) => total + actionReward(entry), 0);
  notify(`收到了 ${reward} 点生命力`);
  const focusTarget = el["collect-life"].disabled ? el["open-actions"] : el["collect-life"];
  focusTarget.focus({ preventScroll: true });
}

function formatPlantGrowthTime(points) {
  const totalSeconds = points * cropGrowthInterval / 1_000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${hours ? `${hours}小时` : ""}${minutes ? `${minutes}分钟` : ""}${seconds ? `${seconds}秒` : ""}` || "0";
}

function updatePlantPickerAvailability(balance = availableEnergy()) {
  const species = plants.get(selectedPlant);
  const owned = state.seedlings.filter(seedling => seedling.species === selectedPlant).length;
  const locked = !isPlantUnlocked(species.unlockLevel);
  const openPlot = isOpenPlot(selectedPlot) && !state.trees.some(tree => tree.plot === selectedPlot);
  el["plant-picker-cost"].textContent = `${owned ? 0 : species.price} 点`;
  el["plant-picker-stock"].textContent = `${owned} 株`;
  el["plant-picker-confirm"].disabled = !openPlot || (!owned && (locked || balance < species.price));
  el["plant-picker-sow"].disabled = el["plant-picker-confirm"].disabled;
  let message = "";
  if (!openPlot) message = "请重新选择空地。";
  else if (!owned && locked) message = `${species.unlockLevel} 级解锁`;
  else if (!owned && balance < species.price) message = `还差 ${species.price - balance} 点生命力`;
  el["plant-picker-status"].textContent = message;
}

function selectPlantPickerChoice(id) {
  selectedPlant = id;
  const species = plants.get(id);
  for (const [choiceId, { choice }] of plantOptions) {
    choice.setAttribute("aria-pressed", String(choiceId === id));
  }
  el["plant-picker-art"].src = forestAssetUrl(species.sprite);
  el["plant-picker-name"].textContent = species.name;
  el["plant-picker-category"].textContent = plantPickerCategories[species.category ?? "other"][0];
  el["plant-picker-xp"].textContent = `+${species.xp}`;
  el["plant-picker-gold"].textContent = `${species.gold} 金币`;

  const stages = [...growthStages].reverse();
  el["plant-picker-stages"].replaceChildren(...stages.map((stage, index) => {
    const item = document.createElement("li");
    const art = document.createElement("figure");
    const image = document.createElement("img");
    image.src = growthStageSprite(id, stage);
    image.alt = "";
    art.append(image);
    const name = document.createElement("span");
    name.textContent = stage.label;
    const start = formatPlantGrowthTime(Math.ceil(stage.ratio * species.maturity));
    const next = stages[index + 1];
    const duration = document.createElement("small");
    duration.textContent = next ? `${start}–${formatPlantGrowthTime(Math.ceil(next.ratio * species.maturity))}` : `${start}可收获`;
    item.append(art, name, duration);
    return item;
  }));
  updatePlantPickerAvailability();
}

function updatePlantPickerArrows() {
  const strip = el["plant-options"];
  el["plant-picker-prev"].disabled = strip.scrollLeft <= 1;
  el["plant-picker-next"].disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
}

function filterPlantPicker(category, preferred) {
  for (const button of el["plant-picker-filters"].children) {
    button.setAttribute("aria-pressed", String(button.dataset.plantCategory === category));
  }
  let first;
  for (const [id, { choice }] of plantOptions) {
    choice.hidden = category !== "all" && (plants.get(id).category ?? "other") !== category;
    if (!choice.hidden) first ??= id;
  }
  el["plant-options"].scrollLeft = 0;
  selectPlantPickerChoice(preferred ?? first);
  if (el["plant-picker"].open) updatePlantPickerArrows();
}

function showPlantPicker(index) {
  if (!isOpenPlot(index)) return;
  const balance = availableEnergy();
  if (!state.seedlings.length && balance < minimumPrice) {
    notify(`种植至少需要 ${minimumPrice} 点生命力`);
    return;
  }
  selectedPlot = index;
  const initial = [...plantOptions.keys()].find(id => isPlantUnlocked(plants.get(id).unlockLevel));
  filterPlantPicker("all", initial);
  el["plant-picker"].showModal();
  el["plant-options"].scrollLeft = 0;
  updatePlantPickerArrows();
}

el["plant-options"].addEventListener("scroll", updatePlantPickerArrows, { passive: true });
window.addEventListener("resize", () => {
  if (el["plant-picker"].open) updatePlantPickerArrows();
});
for (const [id, direction] of [["plant-picker-prev", -1], ["plant-picker-next", 1]]) {
  el[id].addEventListener("click", () => {
    const strip = el["plant-options"];
    strip.scrollBy({ left: direction * strip.clientWidth, behavior: reduceMotion.matches ? "instant" : "smooth" });
  });
}
el["plant-picker-confirm"].addEventListener("click", () => plant(selectedPlot, selectedPlant));
el["plant-picker-sow"].addEventListener("click", () => {
  updatePlantPickerAvailability();
  if (el["plant-picker-sow"].disabled) return;
  sowing = { species: selectedPlant, saveKey: activeForestSave().key() };
  el["plant-picker"].close();
  selectTool("sow");
});

function buySeedling(id) {
  const species = plants.get(id);
  if (!isPlantUnlocked(species.unlockLevel)) {
    el["shop-status"].textContent = `${species.name}将在 ${species.unlockLevel} 级解锁。`;
    return;
  }
  const energyIds = availableEnergyIds(species.price);
  if (energyIds.length < species.price) {
    el["shop-status"].textContent = "生命力不足。";
    return;
  }
  state.seedlings.push({ species: id, energyIds });
  if (!saveState()) {
    state.seedlings.pop();
    el["shop-status"].textContent = "存档未能保存，请重试。";
    return;
  }
  updateControls();
  el["shop-status"].textContent = `已购入 1 株${species.name}种苗。点空地即可种植。`;
  if (species.abstract) playAbstractPurchaseSound(id);
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
  if (!el.journal.open || !isOpenPlot(journalPlot)) return;
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
  const status = el["plant-picker-status"];
  const fail = message => {
    status.textContent = message;
    if (activeTool === "sow") notify(message);
    return false;
  };
  if (!isOpenPlot(index)) {
    return fail("这块地需要先开垦才能种植。");
  }
  if (state.trees.some(tree => tree.plot === index)) {
    return fail("这块地已经种上植物，请选另一格。");
  }
  const { name, price, maturity, unlockLevel } = plants.get(species);
  const stockIndex = state.seedlings.findIndex(seedling => seedling.species === species);
  const seedling = state.seedlings[stockIndex];
  let energyIds;
  if (seedling) {
    energyIds = seedling.energyIds;
    state.seedlings.splice(stockIndex, 1);
  } else {
    if (!isPlantUnlocked(unlockLevel)) {
      return fail(`${name}将在 ${unlockLevel} 级解锁。`);
    }
    energyIds = availableEnergyIds(price);
    if (energyIds.length < price) {
      return fail(`种植${name}需要 ${price} 点生命力。`);
    }
  }
  state.trees.push({
    plot: index, species, date: todayKey(), plantedAt: Date.now(),
    growthTarget: maturity, growthInterval: cropGrowthInterval, energyIds,
  });
  if (!saveState()) {
    state.trees.pop();
    if (seedling) state.seedlings.splice(stockIndex, 0, seedling);
    return fail("存档未能保存，请重试。");
  }
  el["plant-picker"].close();
  renderPlots(index);
  updateControls();
  el.plots.querySelector(`[data-plot="${index}"]`).focus({ preventScroll: true });
  notify(activeTool === "sow" ? `${name}种下了。继续点击空地撒种，右键或 Esc 退出。` : `${name}种下了，点它可以回看行动`);
  return true;
}

function showJournal(tree) {
  const content = el["journal-content"];
  journalPlot = tree?.plot;
  el.journal.dataset.view = tree ? "crop" : "history";
  el["journal-kicker"].hidden = !tree;
  el["journal-records-title"].textContent = tree ? "行动来源" : "生命力觉察";
  el["open-today-notes"].hidden = Boolean(tree);
  el["fertilizer-panel"].hidden = !tree;
  el["fertilizer-status"].textContent = "";
  if (tree) {
    const now = Date.now();
    el["journal-title"].textContent = plantAppearance(tree, now).name;
    updateJournalGrowth(tree, now);
  } else {
    el["journal-title"].textContent = "庄园手记";
    el["journal-cover-art"].src = forestAssetUrl("./assets/forest-journal.webp");
  }
  updateJournalRecords(tree);
  el.journal.showModal();
  if (!tree) playEffect(journalOpenSound);
  el.journal.scrollTop = 0;
  content.scrollTop = 0;
}

function updateJournalRecords(tree) {
  const content = el["journal-content"];
  const sourceIds = tree && new Set(tree.energyIds.map(energyEntryId));
  const entries = tree
    ? state.entries.filter(entry => sourceIds.has(entry.id))
    : state.entries.filter(entry => entry.kind !== "sample").reverse();
  el["journal-count"].textContent = `${entries.length} 条记录`;
  el["journal-count"].hidden = entries.length === 0;
  content.replaceChildren();
  renderJournalRecords(content, entries, Boolean(tree));
}

function renderJournalRecords(content, entries, isCrop) {
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "journal-empty";
    const sprout = document.createElement("img");
    sprout.src = forestAssetUrl("./assets/warehouse/sprout-tag.webp");
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

function activeFieldTool() {
  return activeTool === "sow" && sowing ? {
    followsPointer: true,
    cursorSrc: plants.get(sowing.species).sprite,
    hint: `正在撒种：${plants.get(sowing.species).name}。点击空地连续种植，右键或 Esc 退出。`,
  } : fieldTools.get(activeTool);
}

function selectTool(id) {
  activeTool = activeTool === id ? undefined : id;
  for (const key of fieldTools.keys()) {
    el["tool-" + key].setAttribute("aria-pressed", String(activeTool === key));
  }
  hideToolCursor();
  const tool = activeFieldTool();
  if (tool?.followsPointer) {
    el["tool-cursor"].src = forestAssetUrl(tool.cursorSrc ?? `./assets/tools/${tool.artwork}.webp`);
    el["tool-cursor"].dataset.tool = activeTool;
  }
  updateControls();
  if (activeTool) cameraTo(875, true, 585);
  notify(activeTool ? tool.hint : "已退出工具模式。");
}

function hideToolCursor() {
  el["tool-cursor"].hidden = true;
  el.camera.classList.remove("tool-cursor-active");
}

function syncWorldScene() {
  const inRanch = location.hash === "#ranch";
  const nextExperiment = location.hash === "#experiment";
  const ranch = el["ranch-view"];
  const experimentChanged = nextExperiment !== inExperiment;
  if (!experimentChanged && ranch.hidden === !inRanch) return;

  const previousLink = el[inRanch ? "open-ranch" : "return-farm"];
  const moveFocus = document.activeElement === previousLink;
  if (inRanch || experimentChanged) {
    previewCrop(null);
    showOrbTooltip(null);
    hideToolCursor();
  }
  if (experimentChanged) {
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    if (activeTool) selectTool(activeTool);
    el.notice.hidden = true;
    clearTimeout(xpGainTimer);
    visibleXpGain = 0;
    el["player-xp-gain"].hidden = true;
    for (const effect of el.forest.querySelectorAll(".harvest-xp-badge, .tool-effect")) effect.remove();
    selectedPlot = journalPlot = pendingDig = undefined;
    inExperiment = nextExperiment;
    el.forest.classList.toggle("is-experiment", inExperiment);
    el["scene-image"].src = forestAssetUrl(inExperiment
      ? "./assets/peach-valley-experiment.webp"
      : "./assets/peach-valley-farm.webp");
    el["experiment-dog"].hidden = !inExperiment;
    el["experiment-navigation"].hidden = !inExperiment;
    el["open-ranch"].hidden = inExperiment;
    refreshSavedForest();
    syncExperimentMusic();
  }
  el.camera.inert = inRanch;
  el["farm-tools"].hidden = inRanch;
  el["pan-hint"].hidden = inRanch;
  ranch.hidden = !inRanch;
  el["ranch-navigation"].hidden = !inRanch;
  if (experimentChanged && !inRanch) {
    cameraTo(875, false);
    el[inExperiment ? "experiment-tools" : "open-toolbox"].focus({ preventScroll: true });
  } else if (moveFocus) {
    el[inRanch ? "return-farm" : "open-ranch"].focus({ preventScroll: true });
  }
}

window.addEventListener("hashchange", syncWorldScene);

el.camera.addEventListener("pointermove", event => {
  if (event.pointerType === "touch" || !activeFieldTool()?.followsPointer) {
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

function playToolEffect(tool, tree) {
  if (reduceMotion.matches) return;

  const [row, column] = plots[tree.plot];
  const { rootX, rootY } = plotGeometry(row, column);
  const effect = document.createElement("div");
  effect.className = "tool-effect";
  effect.dataset.tool = tool;
  effect.setAttribute("aria-hidden", "true");
  effect.style.left = `${rootX / sceneWidth * 100}%`;
  effect.style.top = `${rootY / sceneHeight * 100}%`;

  const toolArt = document.createElement("span");
  toolArt.className = "tool-effect-icon";
  const image = document.createElement("img");
  image.alt = "";
  image.src = forestAssetUrl(`./assets/tools/${fieldTools.get(tool).artwork}.webp`);
  toolArt.append(image);

  if (tool === "harvest") {
    const plant = el.plots.children[tree.plot].lastElementChild;
    const liftedPlant = plant.cloneNode();
    liftedPlant.className = "tool-effect-crop";
    liftedPlant.style.width = `${plant.offsetWidth}px`;
    liftedPlant.style.height = `${plant.offsetHeight}px`;
    effect.style.setProperty("--grab-height", `${plant.offsetHeight * .53}px`);
    effect.append(liftedPlant);

    const fingers = image.cloneNode();
    image.className = "tool-effect-palm";
    fingers.className = "tool-effect-fingers";
    toolArt.append(fingers);
  } else {
    for (let index = 0; index < 5; index++) {
      const particle = document.createElement("i");
      particle.className = "tool-effect-particle";
      effect.append(particle);
    }
  }

  effect.append(toolArt);
  effect.addEventListener("animationend", event => {
    if (event.target === effect) effect.remove();
  });
  hideToolCursor();
  el.scene.append(effect);
}

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

let visibleXpGain = 0;
let xpGainTimer;

function showHarvestXp(amount) {
  const label = el["player-xp-gain"];
  visibleXpGain += amount;
  label.textContent = `+${visibleXpGain} EXP`;
  label.hidden = false;
  clearTimeout(xpGainTimer);
  xpGainTimer = setTimeout(() => {
    label.hidden = true;
    visibleXpGain = 0;
  }, 1500);
}

function flyHarvestXp(source, amount) {
  if (!source || reduceMotion.matches) {
    showHarvestXp(amount);
    return;
  }

  const target = el["player-xp"].getBoundingClientRect();
  const x = Math.max(28, Math.min(innerWidth - 28, source.left + source.width / 2));
  const y = Math.max(28, Math.min(innerHeight - 28, source.top + source.height / 2));
  const dx = target.left + target.width / 2 - x;
  const dy = target.top + target.height / 2 - y;
  const badge = document.createElement("span");
  badge.className = "harvest-xp-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = "EXP";
  badge.style.left = `${x}px`;
  badge.style.top = `${y}px`;
  el.forest.append(badge);

  const flight = badge.animate([
    { transform: "translate(-50%, -50%) scale(.8)", opacity: 0 },
    { transform: "translate(-50%, calc(-50% - 22px)) scale(1)", opacity: 1, offset: .16 },
    { transform: `translate(calc(-50% + ${dx * .72}px), calc(-50% + ${dy * .72 - 24}px)) scale(1)`, opacity: 1, offset: .76 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.22)`, opacity: 0 },
  ], { duration: 1350, fill: "both" });
  const arrive = () => {
    if (!badge.isConnected) return;
    badge.remove();
    showHarvestXp(amount);
  };
  void flight.finished.then(arrive, arrive);
}

function harvest(tree) {
  if (!isOpenPlot(tree.plot)) return;
  const id = speciesId(tree);
  const species = plants.get(id);
  if (growthPoints(tree, Date.now()) < maturityTarget(tree)) {
    playEffect(buttonClickSound);
    notify(`${species.name}还未成熟。`);
    return;
  }
  if (el.journal.open) el.journal.close();
  const source = el.plots.children[tree.plot]?.querySelector("img")?.getBoundingClientRect();
  state.warehouse[id] = (state.warehouse[id] ?? 0) + 1;
  state.player.xp += species.xp;
  playToolEffect("harvest", tree);
  removePlant(tree);
  flyHarvestXp(source, species.xp);
  playCropHarvestSound(id);
  notify(`收获了 ${species.name}，经验 +${species.xp}。作物已存入仓库。`);
}

function interactWithPlot(index) {
  if (!isOpenPlot(index)) return;
  if (activeTool === "sow") {
    if (sowing?.saveKey !== activeForestSave().key()) {
      selectTool("sow");
      notify("存档已切换，请重新选择要撒种的种苗。");
      return;
    }
    plant(index, sowing.species);
    return;
  }
  const tree = state.trees.find(plant => plant.plot === index);
  if (!activeTool) {
    if (tree) showJournal(tree);
    else showPlantPicker(index);
    return;
  }
  if (!tree) {
    notify("这块地是空的。右键或再次点击工具图标可退出工具模式。");
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
        playEffect(buttonClickSound);
        notify(remaining <= 0 ? "这株植物已经成熟。" : "这株植物已经浇过水。");
        return;
      }
      tree.waterBoost = Math.min(waterBoost, remaining);
      saveState();
      refreshGrowth();
      playEffect(cropWaterSound);
      playToolEffect("water", tree);
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
  if (!saveState()) {
    state.warehouse[id]++;
    state.player.gold -= species.gold;
    el["warehouse-status"].textContent = "浏览器无法保存，出售未完成。";
    return;
  }
  playEffect(cropSellSound);
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
      <div class="warehouse-slot"><img src="${forestAssetUrl(species.sprite)}" alt="" width="112" height="112"></div>
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
  playEffect(cropSellSound);
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
    const saveKey = activeForestSave().key();
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
      if (activeForestSave().key() === saveKey) setAvatar(canvas.toDataURL("image/png"));
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

function updateRipeningChoices() {
  const select = el["forest-grow-plot"];
  const current = select.value;
  const now = Date.now();
  const options = state.trees
    .filter(tree => isOpenPlot(tree.plot) && growthProgress(tree, now).remaining > 0)
    .sort((left, right) => left.plot - right.plot)
    .map(tree => new Option(`第 ${tree.plot + 1} 块地 · ${plants.get(speciesId(tree)).name}`, String(tree.plot)));
  if (options.length > 1) options.push(new Option("全部未成熟作物", "all"));
  select.disabled = el["forest-grow-confirm"].disabled = el["forest-grow-half"].disabled = options.length === 0;
  select.replaceChildren(...(options.length ? options : [new Option("暂无未成熟作物", "")]));
  if (options.some(option => option.value === current)) select.value = current;
}

function showExperimentTools() {
  if (!inExperiment) return;
  el["forest-energy"].value = availableEnergy();
  el["forest-energy-status"].textContent = "";
  el["forest-grow-status"].textContent = "";
  el["experiment-land-status"].textContent = "";
  updateRipeningChoices();
  updateExperimentLandControls();
  el["forest-controls"].showModal();
}

el["open-forest-controls"].addEventListener("click", () => {
  el.toolbox.close();
  if (inExperiment) showExperimentTools();
  else location.hash = "experiment";
});
el["experiment-tools"].addEventListener("click", showExperimentTools);

function updateExperimentLandControls() {
  const openCount = [...plots.keys()].filter(index => isOpenPlot(index)).length;
  el["experiment-land-count"].textContent = `已开放 ${openCount} / ${plots.length} 块土地`;
  el["experiment-land-next"].disabled = !nextExpansion();
  el["experiment-land-all"].disabled = openCount === plots.length;
  el["experiment-land-undo"].disabled = state.experimentExpansions.length === 0;
}

el["experiment-land-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (!inExperiment || !event.submitter) return;

  const mode = event.submitter.value;
  const previous = state;
  const history = previous.experimentExpansions;
  const undo = mode === "undo";
  const next = mode === "next" ? nextExpansion() : null;
  const batch = undo ? history.at(-1)
    : mode === "all" ? [...plots.keys()].filter(index => !isOpenPlot(index))
    : next ? [next.index] : [];
  if (!batch?.length) return;

  state = {
    ...previous,
    experimentExpansions: undo ? history.slice(0, -1) : [...history, batch],
    trees: [...previous.trees],
    waitingCrops: [...previous.waitingCrops],
  };
  const heldCrops = undo ? previous.trees.filter(tree => batch.includes(tree.plot) && !isOpenPlot(tree.plot)) : [];
  if (heldCrops.length) {
    state.trees = previous.trees.filter(tree => !heldCrops.includes(tree));
    state.waitingCrops.push(...heldCrops.map(tree => ({ ...tree, waitForExpansion: true })));
  }
  restoreWaitingCrops(state);
  const status = el["experiment-land-status"];
  if (!saveState()) {
    state = previous;
    status.textContent = "存档未能保存，请重试。";
    return;
  }
  renderPlots();
  updateControls();
  updateRipeningChoices();
  updateExperimentLandControls();
  status.textContent = undo
    ? `已撤销 ${batch.length} 块土地的扩建。${heldCrops.length ? ` ${heldCrops.length} 株作物已暂存。` : ""}`
    : `已开放 ${batch.length} 块土地。`;
});

el["forest-unlock-plants"].addEventListener("click", () => {
  if (!inExperiment) return;
  const previous = state.allPlantsUnlocked;
  state.allPlantsUnlocked = true;
  if (!saveState()) {
    state.allPlantsUnlocked = previous;
    el["forest-unlock-status"].textContent = "浏览器无法保存此次修改。";
    return;
  }
  updateControls();
});
el["forest-energy-form"].addEventListener("submit", event => {
  event.preventDefault();
  if (!inExperiment) return;
  const target = el["forest-energy"].valueAsNumber;
  const status = el["forest-energy-status"];
  if (!Number.isSafeInteger(target) || target < 0) {
    status.textContent = "请输入有效的非负整数。";
    return;
  }
  if (!setAvailableEnergy(target)) {
    status.textContent = "浏览器无法保存此次修改。";
    return;
  }
  updateControls();
  status.textContent = `可用生命力已设为 ${target} 点。`;
});
function ripenExperimentCrops(selected, half, status) {
  if (!inExperiment) return false;
  const now = Date.now();
  const advances = new Map();
  for (const tree of state.trees) {
    if (!isOpenPlot(tree.plot) || (selected !== "all" && String(tree.plot) !== selected)) continue;
    const target = Math.ceil(maturityTarget(tree) * (half ? halfMaturityRatio : 1));
    const advance = target - growthPoints(tree, now);
    if (advance > 0) advances.set(tree, advance);
  }
  if (!advances.size) {
    updateRipeningChoices();
    status.textContent = half ? "所选地块没有幼苗期作物。" : "所选地块没有等待催熟的作物。";
    return false;
  }
  const previousTrees = state.trees;
  state.trees = previousTrees.map(tree => {
    const advance = advances.get(tree);
    if (!advance) return tree;
    return half ? { ...tree, ripeningBoost: (tree.ripeningBoost ?? 0) + advance } : { ...tree, forcedMature: true };
  });
  if (!saveState()) {
    state.trees = previousTrees;
    status.textContent = "浏览器无法保存此次修改。";
    return false;
  }
  refreshGrowth();
  updateRipeningChoices();
  status.textContent = half ? `已将 ${advances.size} 株作物催到半熟。` : `已催熟 ${advances.size} 株作物，可以收获了。`;
  return true;
}

el["forest-grow-form"].addEventListener("submit", event => {
  event.preventDefault();
  ripenExperimentCrops(el["forest-grow-plot"].value, event.submitter === el["forest-grow-half"], el["forest-grow-status"]);
});

// 各组台词的序号对应 assets/sfx 里的伊比配音文件。
const yibiLines = {
  f: [
    "谢谢姐姐，伊比现在元气满满呢！",
    "姐姐的生命力伊比收到了，谢谢姐姐。",
    "姐姐真漂亮，看到姐姐，伊比会莫名地觉得开心。",
    "希望姐姐每天都元气满满，幸福满满哦。",
    "有了生命力，伊比就可以去种菜了，谢谢姐姐。",
    "今天能遇到姐姐，伊比好高兴呀！",
    "最近天气冷了，姐姐要注意保暖哦。",
  ],
  m: [
    "谢谢哥哥，伊比现在元气满满呢！",
    "哥哥的生命力伊比收到了，谢谢哥哥。",
    "希望哥哥每天都元气满满，幸福满满哦。",
    "有了生命力，伊比就可以去种菜了，谢谢哥哥。",
    "今天能遇到哥哥，伊比好高兴呀！",
    "最近天气冷了，哥哥要注意保暖哦。",
  ],
};
const yibiVoiceButtons = el["yibi-voice-options"].querySelectorAll("button");
const yibiDialog = el["life-transfer"];
const yibiSpeech = el["yibi-speech"];
const yibiStatus = el["life-transfer-status"];
const yibiTransferButton = el["yibi-transfer-button"];
const yibiTransferLabel = el["yibi-transfer-label"];
const yibiIdleLabel = yibiTransferLabel.textContent;
const yibiRemainingLines = { f: [], m: [] };
const yibiChargeDuration = 2000;
const yibiEffectVolume = 3.375;
yibiTransferButton.style.setProperty("--yibi-charge-duration", `${yibiChargeDuration}ms`);
let yibiAudience = "f";
let yibiVoice;
let yibiCharge;
let yibiAudioContext;

function unlockYibiAudio() {
  const AudioEngine = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioEngine) return;
  try {
    yibiAudioContext ??= new AudioEngine();
    if (yibiAudioContext.state !== "running") yibiAudioContext.resume().catch(() => {});
    return yibiAudioContext;
  } catch { /* The transfer still works without generated effects. */ }
}

function yibiTone(context, start, duration, frequency, endFrequency, volume, {
  type = "sine", attack = 0.018, sweep = duration, decay,
} = {}) {
  const tone = context.createOscillator();
  const gain = context.createGain();
  const peak = volume * yibiEffectVolume;
  tone.type = type;
  tone.frequency.setValueAtTime(frequency, start);
  tone.frequency.exponentialRampToValueAtTime(endFrequency, start + sweep);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  if (decay) gain.gain.exponentialRampToValueAtTime(peak * decay.level, start + decay.time);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  tone.connect(gain);
  gain.connect(context.destination);
  tone.addEventListener("ended", () => gain.disconnect(), { once: true });
  tone.start(start);
  tone.stop(start + duration);
  return tone;
}

function playYibiChargeSound(context) {
  if (!context) return;
  const start = context.currentTime;
  const duration = yibiChargeDuration / 1000;
  const tones = [
    yibiTone(context, start, duration, 196, 587, 0.045, { type: "triangle", attack: duration - 0.05 }),
    yibiTone(context, start + 0.28, duration - 0.28, 392, 1174, 0.022, { attack: duration - 0.33 }),
  ];
  const notes = [[0.38, 523], [0.85, 659], [1.33, 784], [1.72, 988]];
  for (const [offset, frequency] of notes) {
    tones.push(yibiTone(context, start + offset, 0.22, frequency, frequency, 0.028));
  }
  return () => {
    for (const tone of tones) tone.stop();
  };
}

function playYibiBurstSound(context) {
  if (!context) return;
  const start = context.currentTime;
  // The short upper hit stays audible on small speakers while the sine tail supplies the weight.
  yibiTone(context, start, 0.38, 138, 47, 0.117, { attack: 0.006, sweep: 0.074, decay: { time: 0.19, level: 0.28 } });
  yibiTone(context, start + 0.003, 0.18, 238, 100, 0.066, { type: "triangle", attack: 0.004, sweep: 0.046, decay: { time: 0.065, level: 0.4 } });
  const chimes = [[0.028, 1047, 0.48, 0.064], [0.079, 1319, 0.55, 0.052], [0.132, 1568, 0.68, 0.048]];
  for (const [offset, frequency, duration, volume] of chimes) {
    const time = start + offset;
    yibiTone(context, time, duration, frequency, frequency, volume, {
      attack: 0.007, decay: { time: duration * 0.52, level: 0.24 },
    });
    const overtone = frequency * 2.4;
    yibiTone(context, time, 0.16, overtone, overtone, volume * 0.3, { attack: 0.004 });
  }
}

function prepareYibiVoice(context, src) {
  if (!context || (location.protocol === "file:" && !previewAssetUrl)) return;
  return fetch(src).then(response => {
    if (!response.ok) throw new Error("Voice audio unavailable");
    return response.arrayBuffer();
  }).then(buffer => context.decodeAudioData(buffer)).catch(() => undefined);
}

function stopYibiVoice() {
  const voice = yibiVoice;
  yibiVoice = undefined;
  voice?.stop?.();
  yibiSpeech.textContent = "";
}

function playYibiReply(charge) {
  const voice = {};
  yibiVoice = voice;
  yibiSpeech.textContent = charge.line;
  const finish = () => {
    if (yibiVoice === voice) {
      voice.stop = undefined;
      stopYibiVoice();
    }
  };
  const play = buffer => {
    if (yibiVoice !== voice || !yibiDialog.open) return;
    if (buffer && charge.context.state === "running") {
      const source = charge.context.createBufferSource();
      source.buffer = buffer;
      source.connect(charge.context.destination);
      source.onended = finish;
      voice.stop = () => { source.onended = null; source.stop(); };
      source.start();
      return;
    }
    const sound = new Audio(charge.src);
    voice.stop = () => sound.pause();
    sound.addEventListener("ended", finish, { once: true });
    playEffect(sound, error => {
      if (yibiVoice === voice && error.name !== "AbortError") yibiStatus.textContent += " · 语音暂时无法播放";
    });
  };
  if (charge.voiceBuffer) void charge.voiceBuffer.then(play);
  else play();
}

function resetYibiCharge() {
  if (yibiCharge) {
    clearTimeout(yibiCharge.timer);
    yibiCharge.stopSound?.();
    yibiCharge = undefined;
  }
  delete yibiTransferButton.dataset.phase;
  yibiTransferButton.removeAttribute("aria-busy");
  yibiTransferLabel.textContent = yibiIdleLabel;
  for (const option of yibiVoiceButtons) option.disabled = false;
}

function openYibiDialog() {
  resetYibiCharge();
  stopYibiVoice();
  yibiStatus.textContent = inExperiment
    ? `实验田 · 可用生命力 ${availableEnergy()} 点`
    : "界面预览 · 长按 2 秒试传";
  yibiDialog.showModal();
}

el["open-life-transfer"].addEventListener("click", openYibiDialog);
el["open-experiment-life-transfer"].addEventListener("click", openYibiDialog);
for (const button of yibiVoiceButtons) {
  button.addEventListener("click", () => {
    if (button.value === yibiAudience) return;
    yibiAudience = button.value;
    for (const option of yibiVoiceButtons) option.setAttribute("aria-pressed", String(option === button));
    stopYibiVoice();
  });
}
yibiDialog.addEventListener("close", () => {
  if (yibiDialog.open) return;
  resetYibiCharge();
  stopYibiVoice();
});

function releaseYibiCharge(charge) {
  if (yibiCharge !== charge) return;
  resetYibiCharge();
  if (!yibiDialog.open) return;
  if (charge.saveKey !== activeForestSave().key() || charge.scene !== location.hash) {
    yibiStatus.textContent = "已取消蓄力，当前场景或存档已切换";
    return;
  }
  if (inExperiment) {
    const balance = availableEnergy();
    if (balance < 1) {
      yibiStatus.textContent = "实验田生命力不足";
      return;
    }
    if (!setAvailableEnergy(balance - 1)) {
      yibiStatus.textContent = "实验田存档保存失败，未扣除生命力";
      return;
    }
    if (el["forest-controls"].open) el["forest-energy"].value = balance - 1;
    updateControls();
    yibiStatus.textContent = `实验田 · 已传递 1 点，剩余 ${balance - 1} 点`;
  } else {
    const hasMessage = el["life-transfer-message"].value.trim().length > 0;
    yibiStatus.textContent = `预览 · 已试传 1 点生命力${hasMessage ? "，附有留言" : ""}`;
  }

  charge.remaining.splice(charge.position, 1);
  yibiTransferButton.dataset.phase = "burst";
  playYibiBurstSound(charge.context);
  if (!reduceMotion.matches) navigator.vibrate?.([68, 24, 37]);
  playYibiReply(charge);
}

function startYibiCharge(input, pressedAt) {
  if (!yibiDialog.open || yibiCharge) return false;
  const started = performance.now();
  stopYibiVoice();
  resetYibiCharge();
  if (inExperiment && availableEnergy() < 1) {
    yibiStatus.textContent = "实验田生命力不足";
    return false;
  }

  const lines = yibiLines[yibiAudience];
  const remaining = yibiRemainingLines[yibiAudience];
  if (!remaining.length) remaining.push(...lines.keys());
  const position = Math.floor(Math.random() * remaining.length);
  const index = remaining[position];
  const number = String(index + 1).padStart(2, "0");
  const src = forestAssetUrl(`./assets/sfx/yibi-${yibiAudience}-${number}.mp3`);
  const context = unlockYibiAudio();
  const charge = {
    input, pressedAt,
    saveKey: activeForestSave().key(), scene: location.hash, remaining, position, src, context,
    line: lines[index], voiceBuffer: prepareYibiVoice(context, src), stopSound: playYibiChargeSound(context),
  };
  yibiCharge = charge;
  yibiTransferButton.dataset.phase = "charge";
  yibiTransferButton.setAttribute("aria-busy", "true");
  yibiTransferLabel.textContent = "蓄力中…";
  for (const option of yibiVoiceButtons) option.disabled = true;
  yibiStatus.textContent = "正在蓄力…";
  charge.timer = setTimeout(() => releaseYibiCharge(charge), yibiChargeDuration - (performance.now() - started));
  return true;
}

function cancelYibiHold() {
  if (!yibiCharge) return;
  resetYibiCharge();
  if (yibiDialog.open) yibiStatus.textContent = "蓄力已取消 · 长按 2 秒后传递";
}

function endYibiHold(input, releasedAt) {
  const charge = yibiCharge;
  if (!charge || charge.input !== input) return;
  if (releasedAt - charge.pressedAt >= yibiChargeDuration) releaseYibiCharge(charge);
  else cancelYibiHold();
}

el["life-transfer-form"].addEventListener("submit", event => event.preventDefault());
yibiDialog.addEventListener("selectstart", event => {
  if (event.target !== el["life-transfer-message"]) event.preventDefault();
});
// WebKit's long-press loupe can still appear when text selection is disabled.
yibiTransferButton.addEventListener("touchstart", event => {
  if (event.cancelable) event.preventDefault();
}, { passive: false });
yibiTransferButton.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  yibiTransferButton.focus({ preventScroll: true });
  if (startYibiCharge(event.pointerId, event.timeStamp)) yibiTransferButton.setPointerCapture(event.pointerId);
});
yibiTransferButton.addEventListener("pointermove", event => {
  if (yibiCharge?.input !== event.pointerId) return;
  const { left, right, top, bottom } = yibiTransferButton.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) cancelYibiHold();
});
yibiTransferButton.addEventListener("pointerup", event => endYibiHold(event.pointerId, event.timeStamp));
for (const type of ["pointercancel", "lostpointercapture"]) {
  yibiTransferButton.addEventListener(type, event => {
    if (yibiCharge?.input === event.pointerId) cancelYibiHold();
  });
}
yibiTransferButton.addEventListener("keydown", event => {
  if (![" ", "Enter"].includes(event.key) || event.isComposing) return;
  event.preventDefault();
  if (!event.repeat) startYibiCharge(event.key, event.timeStamp);
});
yibiTransferButton.addEventListener("keyup", event => {
  if (![" ", "Enter"].includes(event.key)) return;
  event.preventDefault();
  endYibiHold(event.key, event.timeStamp);
});
yibiTransferButton.addEventListener("contextmenu", event => event.preventDefault());
yibiTransferButton.addEventListener("blur", cancelYibiHold);
window.addEventListener("blur", cancelYibiHold);

const buttonClickSound = new Audio(forestAssetUrl("./assets/sfx/button-click.mp3"));
buttonClickSound.volume = 0.72;
const journalOpenSound = new Audio(forestAssetUrl("./assets/sfx/journal-open.mp3"));
const shopOpenSound = new Audio(forestAssetUrl("./assets/sfx/shop-open.mp3"));
const cropWaterSound = new Audio(forestAssetUrl("./assets/sfx/crop-water.mp3"));
const sunCollectSound = new Audio(forestAssetUrl("./assets/sfx/sun-collect.mp3"));
const cropHarvestSound = new Audio(forestAssetUrl("./assets/sfx/crop-harvest.mp3"));
const abstractHarvestSounds = new Map();
const cropSellSound = new Audio(forestAssetUrl("./assets/sfx/crop-sell.mp3"));

function playEffect(sound, onPlaybackError = () => {}) {
  sound.currentTime = 0;
  sound.play().catch(onPlaybackError);
}

function createAbstractCropSound(id) {
  return new Audio(forestAssetUrl(`./assets/sfx/crop-harvest-${id}.mp3`));
}

function playCropHarvestSound(id) {
  if (!plants.get(id).abstract) {
    playEffect(cropHarvestSound);
    return;
  }
  if (!abstractHarvestSounds.has(id)) {
    abstractHarvestSounds.set(id, createAbstractCropSound(id));
  }
  playEffect(abstractHarvestSounds.get(id), error => {
    if (error.name === "AbortError") return;
    abstractHarvestSounds.set(id, cropHarvestSound);
    playEffect(cropHarvestSound);
  });
}

document.addEventListener("click", event => {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const button = event.target.closest("button:not(:disabled)");
  if (!button || button.matches("#open-shop, #open-actions, #open-journal, #open-action-log, #collect-life, .orb, #journal-harvest, [data-sell], #warehouse-sale-confirm, #life-transfer-form button")) return;
  if (button.matches(".plot.planted") && (activeTool === "water" || activeTool === "harvest")) return;

  playEffect(buttonClickSound);
}, { capture: true });

const musicFile = el["music-file"];
const musicPlayer = el["music-player"];
const musicStatus = el["music-status"];
const musicToggle = el["toggle-music"];
const toolboxMusicSwitch = el["toolbox-music-switch"];
const backgroundTracks = [
  { src: "./assets/music/sunny-mornings.mp3", title: "Sunny Mornings · Peder B. Helland" },
  { src: "./assets/music/林中晨歌.mp3", title: "林中晨歌" },
];
const experimentTrack = { src: "./assets/music/experiment-field.mp3", title: "实验田专属曲" };
let currentTrack = backgroundTracks[0];
let experimentVisit;
let experimentTrackAvailable = false;
let experimentProbe;
const playingPurchaseSounds = new Set();
const purchaseMusicRatio = 0.35;
const musicVolumeRestoreDuration = 1000;
let originalMusicVolume;
let musicVolumeRestoreTimer;

function lowerMusicForPurchase() {
  if (musicPlayer.paused || musicPlayer.ended || musicPlayer.error) return;
  clearInterval(musicVolumeRestoreTimer);
  originalMusicVolume ??= musicPlayer.volume;
  musicPlayer.volume = originalMusicVolume * purchaseMusicRatio;
}

function playAbstractPurchaseSound(id) {
  const sound = createAbstractCropSound(id);
  sound.addEventListener("playing", () => {
    playingPurchaseSounds.add(sound);
    lowerMusicForPurchase();
  }, { once: true });

  const finish = () => {
    if (!playingPurchaseSounds.delete(sound) || playingPurchaseSounds.size || originalMusicVolume === undefined) return;
    const from = musicPlayer.volume;
    const target = originalMusicVolume;
    const start = performance.now();
    musicVolumeRestoreTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / musicVolumeRestoreDuration);
      musicPlayer.volume = progress === 1 ? target : from + (target - from) * progress;
      if (progress === 1) {
        clearInterval(musicVolumeRestoreTimer);
        originalMusicVolume = undefined;
      }
    }, 25);
  };
  for (const event of ["ended", "pause", "error"]) sound.addEventListener(event, finish, { once: true });
  playEffect(sound, finish);
}

function isMusicPlaying() {
  return !musicPlayer.paused && !musicPlayer.ended && !musicPlayer.error;
}

function updateMusicToggle() {
  const playing = isMusicPlaying();
  const label = playing ? "暂停背景音乐" : "播放背景音乐";
  musicToggle.classList.toggle("is-playing", playing);
  musicToggle.setAttribute("aria-label", label);
  musicToggle.title = label;
  toolboxMusicSwitch.setAttribute("aria-checked", String(playing));
}

function reportMusicError(message) {
  musicStatus.textContent = message;
  musicStatus.hidden = false;
  if (!el["background-music"].open) notify(message);
}

function setMusicTrack(track, position = 0) {
  const previous = currentTrack;
  currentTrack = track;
  if (previous !== track || musicPlayer.error) {
    musicPlayer.src = forestAssetUrl(track.src);
    if (position) musicPlayer.currentTime = position;
  }
  if (previous !== track && previous !== experimentVisit?.track && previous.src.startsWith("blob:")) {
    URL.revokeObjectURL(previous.src);
  }
  musicPlayer.hidden = false;
  el["music-track"].textContent = track.title;
  updateMusicTrackChoices();
}

function playSelectedTrack() {
  musicPlayer.play().catch(error => {
    if (error.name === "AbortError" || musicPlayer.error) return;
    reportMusicError("未能开始播放，请再点一次播放按钮。");
  });
}

const musicTrackChoices = new Map();
for (const track of [...backgroundTracks, experimentTrack]) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "music-track-choice";
  button.textContent = track.title;
  button.addEventListener("click", () => {
    if (experimentVisit) experimentVisit.useSceneTrack = track === experimentTrack;
    setMusicTrack(track);
    playSelectedTrack();
  });
  musicTrackChoices.set(track, button);
  el["music-track-list"].append(button);
}

function updateMusicTrackChoices() {
  for (const [track, button] of musicTrackChoices) {
    button.hidden = track === experimentTrack && (!inExperiment || !experimentTrackAvailable);
    button.setAttribute("aria-pressed", String(track === currentTrack));
  }
}
updateMusicTrackChoices();

function selectExperimentTrack() {
  if (!experimentVisit?.useSceneTrack || currentTrack === experimentTrack) return;
  const playing = isMusicPlaying();
  setMusicTrack(experimentTrack);
  if (playing) playSelectedTrack();
}

function checkExperimentTrack() {
  if (!inExperiment || experimentTrackAvailable || experimentProbe) return;
  const probe = new Audio();
  experimentProbe = probe;
  probe.preload = "metadata";
  probe.addEventListener("error", () => { experimentProbe = undefined; }, { once: true });
  probe.addEventListener("loadedmetadata", () => {
    experimentTrackAvailable = true;
    experimentProbe = undefined;
    updateMusicTrackChoices();
    selectExperimentTrack();
  }, { once: true });
  probe.src = forestAssetUrl(experimentTrack.src);
}

function syncExperimentMusic() {
  if (inExperiment) {
    experimentVisit = { track: currentTrack, position: musicPlayer.currentTime, useSceneTrack: true };
    if (experimentTrackAvailable) selectExperimentTrack();
    else checkExperimentTrack();
  } else if (experimentVisit) {
    const { track, position } = experimentVisit;
    experimentVisit = undefined;
    if (currentTrack === experimentTrack) {
      const playing = isMusicPlaying();
      setMusicTrack(track, position);
      if (playing) playSelectedTrack();
    } else if (track !== currentTrack && track.src.startsWith("blob:")) {
      URL.revokeObjectURL(track.src);
    }
  }
  updateMusicTrackChoices();
}

function toggleMusic(randomize) {
  if (isMusicPlaying()) {
    musicPlayer.pause();
    return;
  }
  if (randomize) {
    if (experimentVisit) experimentVisit.useSceneTrack = true;
    const track = inExperiment && experimentTrackAvailable
      ? experimentTrack
      : backgroundTracks[Math.floor(Math.random() * backgroundTracks.length)];
    setMusicTrack(track);
    checkExperimentTrack();
  }
  playSelectedTrack();
}
musicToggle.addEventListener("click", () => toggleMusic(false));
toolboxMusicSwitch.addEventListener("click", () => toggleMusic(true));
for (const eventName of ["play", "pause", "ended", "emptied", "error"]) {
  musicPlayer.addEventListener(eventName, updateMusicToggle);
}
el["open-background-music"].addEventListener("click", () => {
  el["background-music"].showModal();
});
musicPlayer.addEventListener("playing", () => {
  musicStatus.hidden = true;
  if (playingPurchaseSounds.size) lowerMusicForPurchase();
});
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
  if (experimentVisit) experimentVisit.useSceneTrack = false;
  setMusicTrack({ src: URL.createObjectURL(file), title: file.name });
});
musicPlayer.addEventListener("error", () => {
  if (currentTrack === experimentTrack) {
    experimentTrackAvailable = false;
    updateMusicTrackChoices();
  }
  musicPlayer.hidden = true;
  reportMusicError("无法播放这份音频，请在工具箱的背景音乐里换一个文件。");
});

el["collect-life"].addEventListener("click", () => collect());
for (const [id, half] of [["journal-grow-full", false], ["journal-grow-half", true]]) {
  el[id].addEventListener("click", () => {
    if (!el.journal.open) return;
    if (ripenExperimentCrops(String(journalPlot), half, el["fertilizer-status"])) {
      el[half ? "journal-grow-full" : "journal-harvest"].focus({ preventScroll: true });
    }
  });
}
el["journal-harvest"].addEventListener("click", () => {
  const tree = state.trees.find(plant => plant.plot === journalPlot);
  if (tree) harvest(tree);
});
el["dig-form"].addEventListener("submit", event => {
  if (event.submitter !== el["dig-confirm"]) return;
  event.preventDefault();
  if (!el["dig-dialog"].open) return;
  el["dig-dialog"].close();
  if (!state.trees.includes(pendingDig) || !isOpenPlot(pendingDig.plot)) return;
  playToolEffect("dig", pendingDig);
  removePlant(pendingDig);
  notify("地块已清理。");
});
el["reclaim-form"].addEventListener("submit", event => {
  if (event.submitter !== el["reclaim-confirm"]) return;
  event.preventDefault();
  if (!el["reclaim-dialog"].open) return;
  const next = updateExpansionDialog();
  if (!next) return;

  const previous = state;
  state = {
    ...state,
    player: { ...state.player, gold: state.player.gold - next.price },
    reclaimedPlots: [...state.reclaimedPlots, next.index],
    pendingExpansionPlots: state.pendingExpansionPlots.filter(index => index !== next.index),
    trees: [...state.trees],
    waitingCrops: [...state.waitingCrops],
  };
  restoreWaitingCrops(state);
  if (!saveState()) {
    state = previous;
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
  if (event.key === "Escape" && activeTool && !el.camera.inert && !document.querySelector("dialog[open]")) selectTool(activeTool);
});
el.forest.addEventListener("contextmenu", event => {
  if (event.button !== 2 || !activeTool || el.camera.inert || document.querySelector("dialog[open]")) return;
  event.preventDefault();
  selectTool(activeTool);
});
el["open-actions"].addEventListener("click", () => {
  showActions();
  playEffect(journalOpenSound);
});
el["open-journal"].addEventListener("click", () => showJournal());
el["open-shop"].addEventListener("click", () => {
  el["shop-status"].textContent = "";
  el.shop.showModal();
  playEffect(shopOpenSound);
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

for (const [id, [label, emoji]] of Object.entries(plantPickerCategories)) {
  const button = document.createElement("button");
  const icon = document.createElement("span");
  icon.textContent = emoji;
  icon.setAttribute("aria-hidden", "true");
  button.type = "button";
  button.dataset.plantCategory = id;
  button.append(icon, label);
  button.addEventListener("click", () => filterPlantPicker(id));
  el["plant-picker-filters"].append(button);
}

for (const [id, species] of [...plants].sort(([, a], [, b]) => a.unlockLevel - b.unlockLevel)) {
  const sprite = document.createElement("img");
  sprite.src = forestAssetUrl(species.sprite);
  sprite.alt = "";
  const name = document.createElement("span");
  name.textContent = species.name;
  const choice = document.createElement("button");
  choice.type = "button";
  choice.className = "plant-option";
  const choicePrice = document.createElement("small");
  choice.append(sprite.cloneNode(), name, choicePrice);
  choice.addEventListener("click", () => selectPlantPickerChoice(id));
  el["plant-options"].append(choice);

  const { card, buy, stock } = createShopCard(id, species, sprite);
  const lock = document.createElement("span");
  lock.className = "shop-lock";
  lock.innerHTML = icon("lock");
  card.append(lock);
  el[species.abstract ? "shop-abstract-plants" : "shop-plants"].append(card);
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
function refreshSavedForest() {
  state = readState(activeForestSave());
  if (el["action-photo-dialog"].open && actionPhotoSaveKey !== activeForestSave().key()) el["action-photo-dialog"].close();
  if (aiAdventureEditor.open && aiAdventureContext?.saveKey !== activeForestSave().key()) aiAdventureEditor.close();
  if (aiAdventureDeleteDialog.open && pendingAiAdventureDelete?.saveKey !== activeForestSave().key()) aiAdventureDeleteDialog.close();
  if (aiAdventureHistory.open) renderAiAdventureHistory();
  if (typeof refreshTodayNotes === "function") refreshTodayNotes();
  renderActionCategories();
  renderHabits(actionEditorDay());
  renderPlots();
  renderOrbs();
  updateControls();
  if (el["forest-controls"].open) {
    updateRipeningChoices();
    updateExperimentLandControls();
  }
  if (el.journal.open) {
    if (journalPlot !== undefined && !isOpenPlot(journalPlot)) {
      el.journal.close();
    } else {
      const tree = state.trees.find(item => item.plot === journalPlot);
      if (tree || journalPlot === undefined) updateJournalRecords(tree);
    }
  }
}
window.addEventListener("storage", event => {
  forestSave.storageChanged(event.key);
  if (inExperiment) experimentSave.storageChanged(event.key);
});
window.addEventListener("focus", () => void forestSave.sync());
window.addEventListener("online", () => void forestSave.sync());
window.addEventListener("offline", () => void forestSave.sync());
document.addEventListener("visibilitychange", () => {
  void forestSave.sync();
  if (!document.hidden && todayKey() !== renderedToday) updateControls();
});
setInterval(() => void forestSave.sync(), 30_000);
el["account-sync-retry"].addEventListener("click", () => void forestSave.sync());
el["account-sync-local"].addEventListener("click", () => forestSave.resolveConflict("local"));
el["account-sync-cloud"].addEventListener("click", () => forestSave.resolveConflict("cloud"));
window.addEventListener("focus", () => {
  if (todayKey() !== renderedToday) updateControls();
  refreshGrowth();
});
setInterval(refreshGrowth, 1000);
setInterval(() => {
  if (todayKey() !== renderedToday) updateControls();
}, 30_000);

renderActionCategories();
renderPlots();
renderOrbs();
updateControls();
if (state.weeklyEnergyReclaimed > 0) {
  notify(`已收回 ${state.weeklyEnergyReclaimed} 点按旧规则重复发放的周常生命力。`);
}
cameraTo(875, false);
syncWorldScene();
