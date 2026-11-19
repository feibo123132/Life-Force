(() => {
  const dog = document.getElementById("experiment-dog");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const width = 1672;
  const height = 941;
  const seat = [1376, 832];
  const scene = document.getElementById("scene");
  // Ground coordinates follow the same background and field grid as the farm.
  const bridge = [[279, 817], [304, 790], [451, 714], [490, 710],
    [503, 742], [456, 762], [416, 785], [367, 813], [316, 841], [289, 844]];
  const walkableAreas = [
    [[40, 123], [169, 141], [357, 171], [510, 211], [641, 238], [770, 248],
      [850, 240], [990, 218], [1004, 232], [951, 257], [895, 297], [900, 328],
      [945, 351], [1034, 379], [1123, 443], [1279, 469], [1380, 466],
      [1383, 500], [1387, 535], [1475, 558], [1635, 558], [1640, 920],
      [1471, 921], [1347, 907], [1200, 893], [1117, 861], [1031, 853],
      [947, 857], [862, 846], [815, 824], [754, 819], [675, 803],
      [624, 811], [583, 813], [553, 782], [509, 770], [443, 718],
      [405, 678], [365, 653], [330, 624], [315, 590], [312, 551],
      [338, 519], [388, 490], [430, 473], [470, 447], [482, 413],
      [469, 373], [453, 344], [392, 340], [345, 324], [327, 283],
      [309, 211], [272, 179], [221, 162], [151, 173], [54, 190]],
    bridge,
    [[253, 847], [289, 808], [327, 831], [321, 871], [355, 912],
      [399, 940], [326, 940], [283, 912], [251, 876]],
    [[26, 849], [99, 857], [176, 879], [229, 849], [269, 851],
      [286, 876], [318, 922], [29, 922]],
  ];
  const obstacles = [
    [field[0][0], field[0].at(-1), field.at(-1).at(-1), field.at(-1)[0]],
    [[1236, 687], [1317, 623], [1400, 582], [1548, 590], [1593, 648],
      [1626, 733], [1618, 800], [1517, 821], [1457, 831], [1387, 786],
      [1285, 782], [1227, 766]],
    [[1354, 854], [1393, 848], [1429, 866], [1441, 897], [1364, 903], [1334, 885]],
    [[1084, 805], [1118, 767], [1164, 736], [1200, 754], [1172, 785],
      [1136, 826], [1095, 827]],
    [[1016, 825], [1042, 790], [1070, 792], [1099, 831], [1060, 853], [1021, 847]],
    [[351, 579], [373, 564], [405, 576], [403, 600], [355, 604]],
  ];
  let homeNetwork;

  function contains(polygon, x, y) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[i];
      const [bx, by] = polygon[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }

  function distanceFromField([x, y]) {
    return Math.min(...obstacles[0].map(([ax, ay], index, edge) => {
      const [bx, by] = edge[(index + 1) % edge.length];
      const dx = bx - ax;
      const dy = by - ay;
      const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - ax - along * dx, y - ay - along * dy);
    }));
  }

  function isWalkable([x, y], fieldClearance = 18) {
    if (distanceFromField([x, y]) < fieldClearance) return false;
    // Keep the paws inside the ground even along riverbanks and tile edges.
    return [[0, 0], [-10, 0], [10, 0], [0, -6], [0, 6]].every(([dx, dy]) =>
      walkableAreas.some(area => contains(area, x + dx, y + dy)) &&
      !obstacles.some(area => contains(area, x + dx, y + dy))
    );
  }

  function canWalkBetween(from, to, fieldClearance = 18) {
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.ceil(distance / 5));
    for (let i = 0; i <= steps; i++) {
      const point = from.map((value, axis) => value + (to[axis] - value) * i / steps);
      if (!isWalkable(point, fieldClearance)) return false;
    }
    return true;
  }

  function grassRouteCost(from, to) {
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const samples = Math.max(1, Math.ceil(distance / 20));
    let cost = 0;
    for (let i = 0; i < samples; i++) {
      const point = from.map((value, axis) => value + (to[axis] - value) * (i + .5) / samples);
      cost += 1 + Math.max(0, 80 - distanceFromField(point)) / 80 * 5;
    }
    return distance * cost / samples;
  }

  function getHomeNetwork() {
    if (homeNetwork) return homeNetwork;
    const root = { point: seat, parent: null, cost: 0 };
    const known = new Map([[String(seat), root]]);
    const blocked = new Set();
    const pending = [root];
    const nodes = [];
    while (pending.length) {
      pending.sort((a, b) => b.cost - a.cost);
      const node = pending.pop();
      if (node.settled) continue;
      node.settled = true;
      nodes.push(node);
      for (const [dx, dy] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) {
        const point = [node.point[0] + dx, node.point[1] + dy];
        const key = String(point);
        const previous = known.get(key);
        if (previous?.settled || blocked.has(key)) continue;
        if (!isWalkable(point)) {
          blocked.add(key);
          continue;
        }
        if (!canWalkBetween(node.point, point)) continue;
        // Prefer open grass over a slightly shorter route hugging the field.
        const cost = node.cost + grassRouteCost(node.point, point);
        if (previous && previous.cost <= cost) continue;
        const next = previous ?? { point };
        next.cost = cost;
        next.parent = node;
        known.set(key, next);
        pending.push(next);
      }
    }
    homeNetwork = nodes;
    return nodes;
  }

  function planReturn(drop) {
    const nodes = getHomeNetwork();
    const ranked = nodes.slice().sort((a, b) =>
      Math.hypot(a.point[0] - drop[0], a.point[1] - drop[1]) -
      Math.hypot(b.point[0] - drop[0], b.point[1] - drop[1])
    );
    const connector = isWalkable(drop) && ranked.find(node => canWalkBetween(drop, node.point));
    const nearest = connector || ranked[0];
    const start = connector ? drop : nearest.point;
    const path = [];
    for (let node = nearest; node; node = node.parent) path.push(node.point);
    const stops = [];
    let from = start;
    while (path.length) {
      let previous = from;
      let cost = 0;
      const costs = path.map(point => {
        cost += grassRouteCost(previous, point);
        previous = point;
        return cost;
      });
      const index = Math.max(0, path.findLastIndex((point, index) => {
        return grassRouteCost(from, point) <= costs[index] * 1.05 && canWalkBetween(from, point);
      }));
      const to = path[index];
      const parts = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 120));
      for (let part = 1; part <= parts; part++) {
        stops.push({ point: from.map((value, axis) => value + (to[axis] - value) * part / parts) });
      }
      from = to;
      path.splice(0, index + 1);
    }
    if (stops.length > 3) {
      const rest = stops.slice(1, -1).filter(stop => !contains(bridge, ...stop.point));
      if (rest.length) rest[Math.floor(rest.length / 2)].rest = true;
    }
    return { start, stops };
  }
  const strolls = [
    {
      // Open lawn between the field and the kennel.
      rest: 4,
      points: [
        [1398, 815, 1410, 834], [1353, 796, 1376, 813],
        [1224, 782, 1242, 795], [1208, 710, 1218, 722],
        [1196, 694, 1210, 706], [1210, 697, 1227, 719],
        [1224, 770, 1240, 787], [1270, 815, 1295, 834],
        [1327, 830, 1353, 841],
      ],
    },
    {
      // Lower meadow near the stream, south of the small boulder.
      rest: 3,
      points: [
        [1317, 801, 1330, 814], [1231, 784, 1251, 798],
        [1187, 782, 1204, 793], [1145, 807, 1171, 821],
        [1180, 843, 1206, 855], [1250, 851, 1276, 862],
        [1312, 833, 1334, 844],
      ],
    },
    {
      // Lawn to the right of the kennel, circling the foreground rock.
      rest: 2,
      points: [
        [1430, 826, 1440, 834], [1463, 849, 1478, 858],
        [1546, 864, 1587, 887], [1490, 900, 1517, 910],
        [1432, 909, 1451, 917], [1295, 908, 1311, 916],
        [1291, 866, 1302, 880], [1300, 840, 1315, 850],
      ],
    },
  ];
  const pantFrames = [1, 2, 1, 0];
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  let previousStroll;

  function chooseStroll() {
    const choices = strolls.filter(stroll => stroll !== previousStroll);
    previousStroll = choices[Math.floor(Math.random() * choices.length)];
    const { points, rest } = previousStroll;
    const stops = points.map(([left, top, right, bottom], index) => ({
      point: [randomBetween(left, right), randomBetween(top, bottom)],
      rest: index === rest,
    }));
    if (Math.random() < .5) stops.reverse();
    return [...stops, { point: seat }];
  }

  let position = seat;
  let route = [];
  let facing = 1;
  let stride = 0;
  let frame;
  let lastTime;
  let elapsed = 0;
  let resumeAt = 0;
  let nextStroll = randomBetween(19000, 26000);
  let nextExpression = randomBetween(2800, 6200);
  let seatedAt = 0;
  let expressionEnds = 0;
  let shownWalkFrame = -1;
  let shownSitFrame = -1;
  let action = null;
  let nextAction = randomBetween(40000, 70000);
  let soundUnlocked = false;
  let drag = null;
  let suppressClickUntil = 0;
  let returnInteraction = false;
  const perspective = y => .52 + y / height * .57;

  function place() {
    const [x, y] = position;
    dog.style.setProperty("--dog-x", (x / width * 100) + "%");
    dog.style.setProperty("--dog-y", (y / height * 100) + "%");
    dog.style.setProperty("--dog-scale", perspective(y));
    // Share the crops' ground-depth ordering while walking, resting or being dragged.
    dog.style.zIndex = Math.max(1, Math.round(y));
  }

  function showWalkFrame(index) {
    if (shownWalkFrame === index) return;
    shownWalkFrame = index;
    dog.style.setProperty("--dog-frame", (index % 4 * 100 / 3) + "% " + (Math.floor(index / 4) * 50) + "%");
  }

  function showSitFrame(index) {
    if (shownSitFrame === index) return;
    shownSitFrame = index;
    dog.style.setProperty("--dog-expression", (index % 3 * 50) + "% " + (Math.floor(index / 3) * 100) + "%");
  }

  function showSeatedPose() {
    seatedAt = elapsed;
    dog.classList.remove("is-walking");
    showSitFrame(1);
  }

  function pant() {
    const phase = Math.floor((elapsed - seatedAt) / 165) % pantFrames.length;
    showSitFrame(pantFrames[phase]);
  }

  function blink() {
    const progress = 260 - (expressionEnds - elapsed);
    // Matched neutral/closed-eye poses keep both pupils hidden during the blink.
    showSitFrame(progress < 50 || progress >= 190 ? 3 : 4);
  }

  function sit() {
    route = [];
    returnInteraction = false;
    resumeAt = 0;
    position = seat;
    showSeatedPose();
    expressionEnds = 0;
    nextStroll = elapsed + randomBetween(28000, 46000);
    nextExpression = elapsed + randomBetween(2800, 6200);
    place();
  }

  function walk(delta) {
    const [x, y] = position;
    const stop = route[0];
    const [endX, endY] = stop.point;
    const dx = endX - x;
    const dy = endY - y;
    const distance = Math.hypot(dx, dy);
    const scale = perspective(y);
    const step = Math.min(distance, delta * .055 * scale);
    if (Math.abs(dx) > 1) facing = Math.sign(dx);
    dog.style.setProperty("--dog-facing", facing);
    stride += step / scale;
    const rearView = dy < -Math.abs(dx) * .42;
    showWalkFrame((rearView ? 4 : 0) + Math.floor(stride / 10) % 4);
    if (step < distance) {
      position = [x + dx * step / distance, y + dy * step / distance];
    } else {
      position = stop.point;
      route.shift();
      if (!route.length) {
        sit();
        return;
      }
      if (stop.rest) {
        resumeAt = elapsed + randomBetween(6000, 10000);
        showSeatedPose();
      }
      if (stop.action) performAction(stop.action);
    }
    place();
  }

  function tick(time) {
    const delta = lastTime === undefined ? 0 : Math.min(50, time - lastTime);
    lastTime = time;
    if (drag || (menu && !menu.hidden)) {
      frame = requestAnimationFrame(tick);
      return;
    }
    elapsed += delta;
    if (action) {
      const progress = elapsed - action.started;
      if (progress >= action.duration) finishAction();
      else showActionFrame(progress);
    } else if (!returnInteraction && soundUnlocked && elapsed >= nextAction && !dog.classList.contains("is-walking") &&
        !document.querySelector("dialog[open]")) {
      performAction(Math.random() < .6 ? "coy" : "fierce");
    } else if (elapsed < resumeAt) pant();
    else if (route.length) {
      if (resumeAt) {
        resumeAt = 0;
        dog.classList.add("is-walking");
      }
      walk(delta);
    } else if (elapsed >= nextStroll && elapsed >= expressionEnds) {
      route = chooseStroll();
      stride = 0;
      walk(0);
      dog.classList.add("is-walking");
    } else if (elapsed >= nextExpression) {
      expressionEnds = elapsed + 260;
      nextExpression = elapsed + randomBetween(2800, 6200);
      blink();
    } else if (elapsed < expressionEnds) {
      blink();
    } else if (elapsed >= expressionEnds) {
      pant();
    }
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    lastTime = undefined;
    if (dog.hidden || document.hidden) endDrag(true);
    if (dog.hidden || reducedMotion.matches || document.hidden) finishAction();
    if (dog.hidden || reducedMotion.matches) {
      if (route.length || elapsed < expressionEnds) sit();
      else place();
      showSitFrame(1);
      return;
    }
    place();
    if (!document.hidden) frame = requestAnimationFrame(tick);
  }

  // —— 互动：鼠标停在狗身上换成肉垫光标，右键弹出动作菜单 ——
  // 光标本体写在 forest.css 的 --dog-pointer 里（SVG 肉垫，取不到的系统会退回小手）。
  // 动作音效：文件放到 assets/sfx/，命名 dog-<动作>.mp3，再在这里登记对应路径。
  const soundSources = new Map([
    ["coy", "./assets/sfx/dog-coy.mp3"],
    ["fierce", "./assets/sfx/dog-fierce.mp3"],
  ]);
  const sounds = new Map();
  const actionDurations = new Map([["coy", 5000], ["fierce", 2750]]);

  function showActionFrame(progress) {
    const index = reducedMotion.matches ? 0 : Math.floor(progress / (action.id === "coy" ? 260 : 170)) % 4;
    dog.style.setProperty("--dog-action-frame", (index * 100 / 3) + "% " + (action.id === "coy" ? 0 : 100) + "%");
  }

  function finishAction() {
    if (!action) return;
    const duration = elapsed - action.started;
    const sound = sounds.get(action.id);
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
    if (action.wasWalking) dog.classList.add("is-walking");
    nextStroll += duration;
    nextExpression += duration;
    if (resumeAt) resumeAt += duration;
    if (expressionEnds) expressionEnds += duration;
    seatedAt = elapsed;
    action = null;
    delete dog.dataset.action;
    showSitFrame(1);
  }

  function performAction(id) {
    if (!actionDurations.has(id) || dog.hidden || document.hidden) return;
    finishAction();
    action = {
      id, started: elapsed, duration: actionDurations.get(id),
      wasWalking: dog.classList.contains("is-walking"),
    };
    dog.classList.remove("is-walking");
    dog.dataset.action = id;
    showActionFrame(0);
    playActionSound(id);
    nextAction = elapsed + randomBetween(45000, 90000);
    // Reduced-motion mode keeps a still pose while the sound plays.
    if (reducedMotion.matches) {
      const currentAction = action;
      setTimeout(() => {
        if (action === currentAction) finishAction();
      }, action.duration);
    }
  }

  function playActionSound(id) {
    const path = soundSources.get(id);
    if (!path) return;
    let sound = sounds.get(id);
    if (!sound) {
      // 离线试玩版把素材编进 HTML，走 forestAssetUrl 才能拿到 blob 地址。
      const url = typeof forestAssetUrl === "function" ? forestAssetUrl(path) : path;
      sound = new Audio(url);
      sound.volume = 0.8;
      sounds.set(id, sound);
    }
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  const menu = document.getElementById("dog-menu");
  const menuItems = menu ? [...menu.querySelectorAll("[data-dog-action]")] : [];

  function closeMenu({ restoreFocus = false } = {}) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menu.classList.remove("is-open");
    if (restoreFocus) dog.focus({ preventScroll: true });
  }

  function openMenu(x, y) {
    if (!menu || drag?.active) return;
    finishAction();
    menu.classList.remove("is-open");
    menu.hidden = false;
    // 先让菜单按内容排版一次，再据此夹回视口内，避免贴边时被裁掉。
    const { offsetWidth: width, offsetHeight: height } = menu;
    const edge = 8;
    const left = Math.min(Math.max(edge, x + 4), Math.max(edge, innerWidth - width - edge));
    const flipUp = y + height + 12 > innerHeight - edge;
    const top = flipUp ? Math.max(edge, y - height - 10) : Math.min(y + 10, innerHeight - height - edge);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    void menu.offsetWidth;
    menu.classList.add("is-open");
    menuItems[0]?.focus({ preventScroll: true });
  }

  function scenePoint(clientX, clientY) {
    const rect = scene.getBoundingClientRect();
    return [(clientX - rect.left) / rect.width * width, (clientY - rect.top) / rect.height * height];
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    if (!drag.active) return;
    event.preventDefault();
    const point = scenePoint(event.clientX, event.clientY);
    position = point.map((value, axis) => Math.max(0, Math.min(axis ? height : width, value - drag.offset[axis])));
    place();
  }

  function endDrag(cancelled = false) {
    if (!drag) return;
    const finished = drag;
    drag = null;
    clearTimeout(finished.timer);
    if (dog.hasPointerCapture(finished.id)) dog.releasePointerCapture(finished.id);
    if (!finished.active) return;
    dog.classList.remove("is-held");
    document.body.classList.remove("is-dragging-dog");
    suppressClickUntil = Date.now() + 500;
    const home = planReturn(cancelled ? finished.from : position);
    position = home.start;
    route = home.stops;
    returnInteraction = false;
    if (!cancelled) {
      let from = position;
      let distance = 0;
      const progress = route.map(stop => {
        distance += Math.hypot(stop.point[0] - from[0], stop.point[1] - from[1]);
        from = stop.point;
        return distance;
      });
      if (distance >= 240) {
        const candidates = route.filter((stop, index) =>
          progress[index] >= distance * .2 && progress[index] <= distance * .8 &&
          !contains(bridge, ...stop.point)
        );
        if (candidates.length) {
          const stop = candidates[Math.floor(Math.random() * candidates.length)];
          stop.action = Math.random() < .6 ? "coy" : "fierce";
          returnInteraction = true;
        }
      }
    }
    resumeAt = 0;
    stride = 0;
    expressionEnds = 0;
    if (reducedMotion.matches) sit();
    else {
      walk(0);
      if (route.length) dog.classList.add("is-walking");
    }
    place();
  }

  dog.title = "左键长按拖动，松开后小狗会自己回狗窝";
  dog.addEventListener("pointerdown", event => {
    event.stopPropagation();
    if (event.button !== 0 || !event.isPrimary || drag || dog.hidden) return;
    suppressClickUntil = 0;
    const point = scenePoint(event.clientX, event.clientY);
    const pending = {
      id: event.pointerId, from: position.slice(), active: false,
      clientX: event.clientX, clientY: event.clientY,
      offset: point.map((value, axis) => value - position[axis]),
    };
    drag = pending;
    dog.setPointerCapture(event.pointerId);
    pending.timer = setTimeout(() => {
      if (drag !== pending || dog.hidden || document.hidden) return;
      finishAction();
      closeMenu();
      pending.active = true;
      dog.classList.remove("is-walking");
      dog.classList.add("is-held");
      document.body.classList.add("is-dragging-dog");
      showWalkFrame(8);
      moveDrag({ ...pending, pointerId: pending.id, preventDefault() {} });
    }, 350);
  });
  addEventListener("pointermove", moveDrag, { passive: false });
  addEventListener("pointerup", event => {
    if (event.pointerId === drag?.id) endDrag();
  });
  addEventListener("pointercancel", event => {
    if (event.pointerId === drag?.id) endDrag(true);
  });
  dog.addEventListener("lostpointercapture", event => {
    if (event.pointerId === drag?.id) endDrag(true);
  });
  addEventListener("blur", () => endDrag(true));

  if (menu) {
    dog.addEventListener("click", event => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      openMenu(event.clientX, event.clientY);
    });
    dog.addEventListener("contextmenu", event => {
      event.preventDefault();
      openMenu(event.clientX, event.clientY);
    });

    dog.addEventListener("keydown", event => {
      const opens = event.key === "Enter" || event.key === " " || event.key === "ContextMenu"
        || (event.shiftKey && event.key === "F10");
      if (!opens) return;
      event.preventDefault();
      const rect = dog.getBoundingClientRect();
      openMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    menuItems.forEach(item => {
      item.addEventListener("click", () => {
        soundUnlocked = true;
        performAction(item.dataset.dogAction);
        closeMenu({ restoreFocus: true });
      });
    });

    menu.addEventListener("keydown", event => {
      const index = menuItems.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        menuItems[(index + step + menuItems.length) % menuItems.length].focus({ preventScroll: true });
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      } else if (event.key === "Tab") {
        closeMenu();
      }
    });

    // 点别处、在地面上右键、窗口尺寸变化都收起菜单。
    document.addEventListener("pointerdown", event => {
      if (menu.hidden || menu.contains(event.target) || event.target === dog) return;
      closeMenu();
    }, true);
    document.addEventListener("contextmenu", event => {
      if (menu.hidden || event.target === dog) return;
      closeMenu();
    }, true);
    addEventListener("resize", () => closeMenu());
    addEventListener("blur", () => closeMenu());
  }

  for (const type of ["pointerdown", "keydown"]) {
    document.addEventListener(type, event => {
      if (event.isTrusted) soundUnlocked = true;
    }, { capture: true, once: true });
  }
  new MutationObserver(() => {
    if (dog.hidden) closeMenu();
    updateMotion();
  }).observe(dog, { attributeFilter: ["hidden"] });
  reducedMotion.addEventListener("change", updateMotion);
  document.addEventListener("visibilitychange", updateMotion);
  updateMotion();
})();
