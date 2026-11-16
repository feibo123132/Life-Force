"use strict";

(() => {
  const scene = document.querySelector("#ranch-scene");
  const ranchView = document.querySelector("#ranch-view");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const range = (min, max) => min + (max - min) * Math.random();

  // Each route stays on open grass between the landmarks painted into the background.
  const residents = [
    {
      species: "chicken", name: "鸡", size: 4.6, speed: 49, stepTime: 145, legCut: 80, dip: 31,
      eye: [28, 25.8], lid: "#eac087", route: [[.421, .669], [.380, .701], [.341, .670], [.376, .639], [.443, .652]],
    },
    {
      species: "duck", name: "鸭", size: 4.3, speed: 42, stepTime: 195, legCut: 83, dip: 27,
      eye: [34.7, 23.1], lid: "#efc477", route: [[.349, .581], [.403, .566], [.439, .600], [.383, .617], [.324, .597]],
    },
    {
      species: "pig", name: "猪", size: 6.8, speed: 45, dip: 16,
      walkFrames: { columns: 4, rows: 2, stride: 44, rest: 7 },
      eye: [34.5, 36.4], lid: "#e99d7e", route: [[.620, .706], [.562, .674], [.656, .645], [.725, .672], [.655, .746]],
    },
    {
      species: "sheep", name: "羊", size: 6.5, speed: 41, stepTime: 205, legCut: 75, dip: 23,
      eye: [33.5, 29.2], lid: "#e8b980", route: [[.621, .553], [.550, .530], [.570, .475], [.616, .484], [.687, .569]],
    },
    {
      species: "cow", name: "小牛", size: 9.1, speed: 38, idleAction: "groom",
      walkFrames: { columns: 4, rows: 4, stride: 49, rest: 0 },
      actionFrames: {
        idle: { columns: 1, rows: 1 },
        eat: { columns: 4, rows: 4, frameTime: 160 },
        groom: { columns: 4, rows: 4, frameTime: 120 },
      },
      route: [[.524, .618], [.476, .626], [.551, .602], [.594, .626], [.515, .660]],
    },
    {
      species: "cow", spriteSet: "calf", name: "笑脸小牛", size: 5.80, speed: 38, facesRight: true, idleAction: "dance",
      walkFrames: { columns: 4, rows: 4, stride: 100, rest: 0 },
      actionFrames: {
        idle: { columns: 1, rows: 1 },
        eat: { columns: 4, rows: 4, frameTime: 120 },
        dance: { columns: 4, rows: 4, frameTime: 130 },
      },
      route: [[.578, .434], [.590, .395], [.637, .410], [.632, .444], [.555, .435]],
    },
    {
      species: "chicken", spriteSet: "chick", name: "小黄鸡", size: 3.47, speed: 44, idleAction: "dance",
      walkFrames: { columns: 4, rows: 4, stride: 84, rest: 0 },
      actionFrames: {
        idle: { columns: 1, rows: 1 },
        eat: { columns: 4, rows: 4, frameTime: 120 },
        dance: { columns: 4, rows: 4, frameTime: 80 },
      },
      route: [[.536, .766], [.565, .737], [.547, .705], [.502, .721], [.489, .758]],
    },
    {
      species: "chicken", spriteSet: "rooster", name: "红冠鸡", size: 5.6, speed: 37, idleAction: "crow",
      walkFrames: { columns: 4, rows: 4, stride: 30, rest: 0 },
      actionFrames: {
        idle: { columns: 1, rows: 1 },
        eat: { columns: 4, rows: 4, frameTime: 140 },
        crow: { columns: 4, rows: 4, frameTime: 160 },
      },
      route: [[.706, .606], [.737, .565], [.700, .579], [.676, .622], [.733, .625]],
    },
  ];

  function place(animal, x, y) {
    animal.element.style.setProperty("--x", `${x * 100}%`);
    animal.element.style.setProperty("--y", `${y * 100}%`);
    animal.element.style.zIndex = Math.round(y * 1000);
  }

  function showSpriteFrame(animal, pose, index) {
    const { columns, rows } = pose === "walk" ? animal.walkFrames : animal.actionFrames[pose];
    if (animal.sheetPose !== pose) {
      animal.sheet.style.backgroundImage = `url("./assets/ranch/${animal.spriteSet ?? animal.species}-${pose}.webp")`;
      animal.sheet.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
      animal.sheetPose = pose;
    }
    const x = columns > 1 ? index % columns * 100 / (columns - 1) : 0;
    const y = rows > 1 ? Math.floor(index / columns) * 100 / (rows - 1) : 0;
    animal.element.style.setProperty("--frame-position", `${x}% ${y}%`);
  }

  function setAnimalPose(animal, pose, now) {
    animal.element.dataset.pose = pose;
    animal.poseStarted = now;
    if (pose === "walk" && animal.walkFrames) showSpriteFrame(animal, "walk", 0);
    else if (animal.actionFrames?.[pose]) showSpriteFrame(animal, pose, 0);
    else if (animal.walkFrames) showSpriteFrame(animal, "walk", animal.walkFrames.rest);
  }

  function createAnimal(config, index) {
    const element = document.createElement("div");
    element.className = "ranch-animal";
    if (config.actionFrames?.eat) element.classList.add("ranch-animal-eat-frames");
    element.dataset.species = config.species;
    element.dataset.pose = "idle";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", config.name);
    element.style.setProperty("--size", `${config.size}%`);

    const facing = document.createElement("div");
    facing.className = "ranch-animal-facing";
    const body = document.createElement("div");
    body.className = "ranch-animal-body";
    let sheet;
    if (config.walkFrames) {
      sheet = document.createElement("div");
      sheet.className = "ranch-animal-frames";
      body.append(sheet);
    } else {
      element.classList.add("ranch-animal-cutout");
      element.style.setProperty("--step-time", `${config.stepTime}ms`);
      element.style.setProperty("--leg-cut", `${config.legCut}%`);
      const sprite = document.createElement("img");
      sprite.src = `./assets/ranch/${config.species}.webp`;
      sprite.alt = "";
      sprite.draggable = false;
      const feet = sprite.cloneNode();
      sprite.className = "ranch-animal-sprite";
      feet.className = "ranch-animal-feet";
      body.append(sprite, feet);
    }
    facing.append(body);
    if (config.eye) {
      element.style.setProperty("--dip", `-${config.dip}deg`);
      element.style.setProperty("--eye-x", `${config.eye[0]}%`);
      element.style.setProperty("--eye-y", `${config.eye[1]}%`);
      element.style.setProperty("--lid", config.lid);
      const eye = document.createElement("span");
      eye.className = "ranch-eye";
      body.append(eye);
      const feed = document.createElement("span");
      feed.className = "ranch-feed";
      facing.append(feed);
    }
    element.append(facing);
    scene.append(element);

    const animal = {
      ...config, element, sheet, point: 0, move: null, until: range(450, 1450) + index * 240,
      nextBlink: range(1300, 3900), blinkUntil: 0, walksToMeal: index % 3 + 1,
    };
    setAnimalPose(animal, "idle", 0);
    place(animal, ...config.route[0]);
    return animal;
  }

  function updateAnimal(animal, now) {
    if (animal.eye) {
      if (now >= animal.nextBlink) {
        animal.blinkUntil = now + 145;
        animal.nextBlink = now + range(2300, 6300);
      }
      animal.element.classList.toggle("is-blinking", now < animal.blinkUntil);
    }

    if (animal.move) {
      const { from, to, start, duration, cycles } = animal.move;
      const progress = Math.min(1, (now - start) / duration);
      place(animal, from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress);
      if (animal.walkFrames) {
        // Close each route on a planted pose and advance the gait with distance traveled.
        const frames = animal.walkFrames.columns * animal.walkFrames.rows;
        const elapsedFrames = Math.min(cycles * frames - 1, Math.floor(progress * cycles * frames));
        showSpriteFrame(animal, "walk", elapsedFrames % frames);
      }
      if (progress < 1) return;

      animal.move = null;
      const eating = --animal.walksToMeal === 0;
      if (eating) animal.walksToMeal = Math.floor(range(2, 5));
      const pose = eating ? "eat" : animal.idleAction && Math.random() < .45 ? animal.idleAction : "idle";
      const clip = animal.actionFrames?.[pose];
      setAnimalPose(animal, pose, now);
      animal.until = now + (clip?.frameTime ? clip.columns * clip.rows * clip.frameTime : eating ? range(2100, 3600) : range(720, 2050));
      return;
    }

    const currentPose = animal.element.dataset.pose;
    const clip = animal.actionFrames?.[currentPose];
    if (clip?.frameTime) {
      if (now < animal.until) {
        showSpriteFrame(animal, currentPose, Math.floor((now - animal.poseStarted) / clip.frameTime));
        return;
      }
      setAnimalPose(animal, "idle", now);
      animal.until = now + range(500, 1250);
    }

    if (now < animal.until) return;
    const from = animal.route[animal.point];
    const next = Math.floor(Math.random() * (animal.route.length - 1));
    animal.point = next >= animal.point ? next + 1 : next;
    const to = animal.route[animal.point];
    const distance = Math.hypot((to[0] - from[0]) * 1672, (to[1] - from[1]) * 941);
    const cycles = animal.walkFrames ? Math.max(1, Math.round(distance / animal.walkFrames.stride)) : 0;
    animal.move = { from, to, start: now, duration: distance / animal.speed * 1000, cycles };
    const facesTravelDirection = (to[0] > from[0]) === Boolean(animal.facesRight);
    animal.element.style.setProperty("--facing", facesTravelDirection ? 1 : -1);
    setAnimalPose(animal, "walk", now);
  }

  const animals = [];
  let frame;
  let lastTime;
  let elapsed = 0;

  function tick(time) {
    if (lastTime !== undefined) elapsed += Math.min(50, time - lastTime);
    lastTime = time;
    for (const animal of animals) updateAnimal(animal, elapsed);
    frame = requestAnimationFrame(tick);
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    lastTime = undefined;
    if (ranchView.hidden) return;
    if (!animals.length) animals.push(...residents.map(createAnimal));
    if (!reducedMotion.matches) {
      frame = requestAnimationFrame(tick);
      return;
    }
    for (const animal of animals) {
      setAnimalPose(animal, "idle", elapsed);
      animal.element.classList.remove("is-blinking");
      if (animal.move) {
        place(animal, ...animal.move.to);
        animal.move = null;
        animal.until = elapsed + range(700, 1500);
      }
    }
  }

  new MutationObserver(updateMotion).observe(ranchView, { attributeFilter: ["hidden"] });
  reducedMotion.addEventListener("change", updateMotion);
  updateMotion();
})();
