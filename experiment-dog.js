(() => {
  const dog = document.getElementById("experiment-dog");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const width = 1672;
  const height = 941;
  const seat = [1376, 832];
  const strolls = [
    {
      // Open lawn between the field and the kennel.
      rest: 4,
      points: [
        [1398, 815, 1410, 834], [1353, 796, 1376, 813],
        [1224, 782, 1242, 795], [1208, 710, 1218, 722],
        [1172, 693, 1200, 710], [1210, 697, 1227, 719],
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
  let nextExpression = 8500;
  let seatedAt = 0;
  let expressionEnds = 0;
  let nextSmile = 3;
  let shownWalkFrame = -1;
  let shownSitFrame = -1;
  let action = null;
  let nextAction = randomBetween(40000, 70000);
  let soundUnlocked = false;
  const perspective = y => .52 + y / height * .57;

  function place() {
    const [x, y] = position;
    dog.style.setProperty("--dog-x", (x / width * 100) + "%");
    dog.style.setProperty("--dog-y", (y / height * 100) + "%");
    dog.style.setProperty("--dog-scale", perspective(y));
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

  function sit() {
    route = [];
    resumeAt = 0;
    position = seat;
    showSeatedPose();
    expressionEnds = 0;
    nextStroll = elapsed + randomBetween(28000, 46000);
    nextExpression = elapsed + randomBetween(8500, 17000);
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
    }
    place();
  }

  function tick(time) {
    const delta = lastTime === undefined ? 0 : Math.min(50, time - lastTime);
    lastTime = time;
    if (menu && !menu.hidden) {
      frame = requestAnimationFrame(tick);
      return;
    }
    elapsed += delta;
    if (action) {
      const progress = elapsed - action.started;
      if (progress >= action.duration) finishAction();
      else showActionFrame(progress);
    } else if (soundUnlocked && elapsed >= nextAction && !dog.classList.contains("is-walking") &&
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
      showSitFrame(nextSmile);
      nextSmile = nextSmile === 3 ? 4 : 3;
      expressionEnds = elapsed + 1200;
      nextExpression = elapsed + randomBetween(12000, 19000);
    } else if (elapsed >= expressionEnds) {
      pant();
    }
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    lastTime = undefined;
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
    if (!menu) return;
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

  if (menu) {
    dog.addEventListener("pointerdown", event => event.stopPropagation());
    dog.addEventListener("click", event => {
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
