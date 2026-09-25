/* ============================================================
 * Happy Cat · 摸摸猫
 * 一只放在浏览器里的小猫。开源 · 纯前端 · 无依赖。
 * ============================================================ */
(function () {
  "use strict";

  /* ---------------- 状态 ---------------- */
  const STORAGE_KEY = "happy-cat-save-v1";

  const state = {
    mood: 80,      // 心情 0-100
    hunger: 70,    // 饱食 0-100
    energy: 90,    // 能量 0-100
    pets: 0,       // 累计摸猫次数
    fed: 0,        // 累计喂鱼次数
    plays: 0,      // 累计玩耍次数
    achievements: [], // 已解锁成就 id
    sound: true,
    lastSeen: Date.now(),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.assign(state, saved);

      // 离线时间衰减：每 60 秒掉 1 点，最多掉 40
      const awayMin = Math.min((Date.now() - (saved.lastSeen || Date.now())) / 60000, 240);
      const drop = Math.floor(awayMin);
      state.mood = Math.max(0, state.mood - drop);
      state.hunger = Math.max(0, state.hunger - drop);
      state.energy = Math.max(5, state.energy - Math.floor(drop / 2));
    } catch (e) { /* 损坏存档则重置 */ }
  }

  function save() {
    state.lastSeen = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  const clamp = (v) => Math.max(0, Math.min(100, v));

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);
  const catArea = $("cat-area");
  const catWrap = $("cat-wrap");
  const speech = $("speech");
  const particles = $("particles");
  const yarn = $("yarn");
  const bars = { mood: $("bar-mood"), hunger: $("bar-hunger"), energy: $("bar-energy") };

  const eyesOpen = $("eyes-open");
  const eyesHappy = $("eyes-happy");
  const eyesSleepy = $("eyes-sleepy");
  const blushL = $("blush-l");
  const blushR = $("blush-r");

  let sleeping = false;

  /* ---------------- 音效（WebAudio 合成，无外部资源） ---------------- */
  let audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function playMeow() {
    if (!state.sound) return;
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(430, t + 0.35);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(gain).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.45);
  }

  function playPurr() {
    if (!state.sound) return;
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 55;
    lfo.frequency.value = 22;          // 呼噜的“突突突”
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(gain.gain);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.9);
    osc.connect(gain).connect(ac.destination);
    osc.start(t); lfo.start(t);
    osc.stop(t + 1); lfo.stop(t + 1);
  }

  function playMunch() {
    if (!state.sound) return;
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    [0, 0.15, 0.3].forEach((off) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, t + off);
      osc.frequency.exponentialRampToValueAtTime(120, t + off + 0.1);
      gain.gain.setValueAtTime(0.15, t + off);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.12);
      osc.connect(gain).connect(ac.destination);
      osc.start(t + off); osc.stop(t + off + 0.14);
    });
  }

  /* ---------------- 粒子 ---------------- */
  function spawnParticle(char, x, y) {
    const el = document.createElement("span");
    el.className = "particle";
    el.textContent = char;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--spin", (Math.random() * 40 - 20) + "deg");
    particles.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function burstHearts(n = 3) {
    const rect = catArea.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        spawnParticle("💗", 60 + Math.random() * (rect.width - 120), 40 + Math.random() * 120);
      }, i * 130);
    }
  }

  function spawnZzz() {
    const rect = catArea.getBoundingClientRect();
    spawnParticle("💤", rect.width - 90, 60);
  }

  /* ---------------- 台词 ---------------- */
  let speechTimer = null;
  function say(text, ms = 2200) {
    speech.textContent = text;
    speech.classList.remove("hidden");
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => speech.classList.add("hidden"), ms);
  }

  /* ---------------- 表情 ---------------- */
  function setEyes(which) {
    eyesHappy.classList.toggle("show", which === "happy");
    eyesSleepy.classList.toggle("show", which === "sleepy");
  }
  function setBlush(on) {
    blushL.setAttribute("opacity", on ? 0.75 : 0);
    blushR.setAttribute("opacity", on ? 0.75 : 0);
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    bars.mood.style.width = state.mood + "%";
    bars.hunger.style.width = state.hunger + "%";
    bars.energy.style.width = state.energy + "%";
    Object.values(bars).forEach((b) => b.classList.toggle("low", parseInt(b.style.width) < 25));

    if (sleeping) {
      setEyes("sleepy");
      setBlush(false);
      return;
    }
    if (state.energy < 20) {
      setEyes("sleepy"); setBlush(false);
    } else if (state.mood > 85) {
      setEyes("happy"); setBlush(true);
    } else {
      setEyes("open"); setBlush(false);
    }
  }

  /* ---------------- 行为 ---------------- */
  function pet(x, y) {
    if (sleeping) { say("嘘…人家在睡觉 Zzz"); return; }
    if (state.energy < 8) { say("太累了…摸不动了，让我睡会"); return; }

    state.pets++;
    state.mood = clamp(state.mood + 2);
    state.energy = clamp(state.energy - 0.4);

    catArea.classList.remove("petting");
    void catArea.offsetWidth; // 重启动画
    catArea.classList.add("petting");
    setTimeout(() => catArea.classList.remove("petting"), 500);

    if (Math.random() < 0.35) burstHearts(2);
    if (Math.random() < 0.4) playPurr();

    const lines = ["呼噜呼噜～", "再摸一下嘛～", "好舒服呀～", "喵呜～就是这个位置！", "你手好暖～", "咕噜咕噜咕噜…"];
    if (Math.random() < 0.3) say(lines[Math.floor(Math.random() * lines.length)], 1400);

    checkMilestones();
    render(); save();
  }

  function feed() {
    if (sleeping) { say("呼…（梦里也在吃）"); return; }
    if (state.hunger > 92) { say("吃不下了！肚子圆滚滚"); return; }

    state.fed++;
    state.hunger = clamp(state.hunger + 26);
    state.mood = clamp(state.mood + 6);
    playMunch();
    say("咔嚓咔嚓…真香！🐟", 1800);
    spawnParticle("🐟", catArea.getBoundingClientRect().width * 0.3, 90);
    checkMilestones();
    render(); save();
  }

  function play() {
    if (sleeping) { say("Zzz…（翻了个身）"); return; }
    if (state.energy < 15) { say("跑不动了…让我眯一会"); return; }

    state.plays++;
    state.mood = clamp(state.mood + 12);
    state.energy = clamp(state.energy - 10);
    state.hunger = clamp(state.hunger - 6);

    playMeow();
    yarn.classList.remove("hidden");
    let bounce = 0;
    const iv = setInterval(() => {
      yarn.style.left = 20 + Math.random() * 60 + "%";
      if (++bounce > 5) { clearInterval(iv); yarn.classList.add("hidden"); }
    }, 550);

    say("喵！毛线球是我的！", 1600);
    burstHearts(2);
    checkMilestones();
    render(); save();
  }

  function toggleSleep() {
    sleeping = !sleeping;
    catArea.classList.toggle("sleeping", sleeping);
    $("btn-sleep").textContent = sleeping ? "☀️ 起床" : "💤 睡觉";
    if (sleeping) {
      setEyes("sleepy");
      say("晚安…Zzz", 2000);
      const iv = setInterval(() => {
        if (!sleeping) { clearInterval(iv); return; }
        state.energy = clamp(state.energy + 8);
        state.mood = clamp(state.mood + 1);
        spawnZzz();
        render();
        if (state.energy >= 100) { clearInterval(iv); wake(); }
        save();
      }, 1200);
    } else {
      say("喵！睡饱啦！", 1600);
      setBlush(true);
      setTimeout(() => setBlush(false), 1500);
      render();
    }
  }

  function wake() {
    sleeping = false;
    catArea.classList.remove("sleeping");
    $("btn-sleep").textContent = "💤 睡觉";
    say("喵呜～睡饱了！", 1800);
    render();
  }

  /* ---------------- 成就 ---------------- */
  const ACHIEVEMENTS = [
    { id: "first-pet",  icon: "🐾", name: "初次相遇",     desc: "第一次摸猫",        test: (s) => s.pets >= 1 },
    { id: "pet-50",     icon: "🤚", name: "熟练铲屎官",   desc: "累计摸猫 50 次",    test: (s) => s.pets >= 50 },
    { id: "pet-500",    icon: "✋", name: "手速惊人",     desc: "累计摸猫 500 次",   test: (s) => s.pets >= 500 },
    { id: "first-feed", icon: "🐟", name: "开饭啦",       desc: "第一次喂小鱼干",    test: (s) => s.fed >= 1 },
    { id: "feed-20",    icon: "🍽️", name: "干饭猫之友",   desc: "累计喂食 20 次",    test: (s) => s.fed >= 20 },
    { id: "play-10",    icon: "🧶", name: "玩伴",         desc: "一起玩 10 次",      test: (s) => s.plays >= 10 },
    { id: "full-house", icon: "🌟", name: "猫生赢家",     desc: "三项状态全满",      test: (s) => s.mood >= 99 && s.hunger >= 99 && s.energy >= 99 },
    { id: "night-owl",  icon: "🌙", name: "夜猫子",       desc: "凌晨 0-5 点来看猫", test: () => { const h = new Date().getHours(); return h >= 0 && h < 5; } },
  ];

  function renderAchievements() {
    const list = $("ach-list");
    list.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = state.achievements.includes(a.id);
      const div = document.createElement("div");
      div.className = "ach" + (unlocked ? " unlocked" : "");
      div.textContent = (unlocked ? a.icon + " " : "🔒 ") + (unlocked ? a.name : "？？？");
      div.title = a.desc;
      list.appendChild(div);
    });
    $("ach-count").textContent = `${state.achievements.length}/${ACHIEVEMENTS.length}`;
  }

  function checkMilestones() {
    ACHIEVEMENTS.forEach((a) => {
      if (!state.achievements.includes(a.id) && a.test(state)) {
        state.achievements.push(a.id);
        toast(`🏅 成就解锁：${a.name}`);
        renderAchievements();
        save();
      }
    });
  }

  function toast(text, ms = 2600) {
    const el = $("toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), ms);
  }

  /* ---------------- 自然衰减 ---------------- */
  setInterval(() => {
    if (sleeping) return;
    state.hunger = clamp(state.hunger - 0.6);
    state.energy = clamp(state.energy - 0.4);
    if (state.hunger < 20 || state.energy < 20) {
      state.mood = clamp(state.mood - 1);
    }
    // 饿了/困了会主动说话
    if (state.hunger < 20 && Math.random() < 0.3) say("咕咕咕…好饿，给我小鱼干！");

    render(); save();
  }, 15000);

  /* ---------------- 事件绑定 ---------------- */
  let lastPetAt = 0;
  function onCatPointer(e) {
    const now = Date.now();
    if (now - lastPetAt < 180) return; // 节流
    lastPetAt = now;
    pet();
  }

  catArea.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".speech")) return;
    onCatPointer(e);
  });

  $("btn-pet").addEventListener("click", () => pet());
  $("btn-feed").addEventListener("click", feed);
  $("btn-play").addEventListener("click", play);
  $("btn-sleep").addEventListener("click", toggleSleep);
  $("sound-btn").addEventListener("click", () => {
    state.sound = !state.sound;
    $("sound-btn").textContent = state.sound ? "🔊" : "🔇";
    save();
  });

  // 键盘可达性：1 摸 / 2 喂 / 3 玩 / 4 睡
  document.addEventListener("keydown", (e) => {
    if (e.key === "1") pet();
    if (e.key === "2") feed();
    if (e.key === "3") play();
    if (e.key === "4") toggleSleep();
  });

  window.addEventListener("beforeunload", save);

  /* ---------------- 启动 ---------------- */
  load();
  $("sound-btn").textContent = state.sound ? "🔊" : "🔇";
  render();
  renderAchievements();
  checkMilestones();
  setTimeout(() => {
    const h = state.hunger, en = state.energy;
    if (h < 25) say("我饿好久了…喂我！");
    else if (en < 25) say("好困呀…（按 4 哄我睡）");
    else say("你回来啦！摸摸我吧～", 2600);
  }, 600);
})();
