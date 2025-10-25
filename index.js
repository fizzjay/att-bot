const readline = require('readline');
const { Client } = require('att-client');
const fs = require('fs');
const path = require('path');
const { attConfig } = require('./config2');

// === Input setup ===
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, ans => res(ans)));

// === ATT Client ===
const bot = new Client(attConfig);
let connection = null;

// === Linked Players JSON ===
const linkedPath = path.join(__dirname, 'linkedplayers.json');
const linkedPlayers = fs.existsSync(linkedPath)
  ? JSON.parse(fs.readFileSync(linkedPath))
  : {};

// === Utility functions ===
function distance(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}
function getBaitTier(i) {
  if (i <= 5) return "Common";
  if (i <= 11) return "Uncommon";
  if (i <= 17) return "Rare";
  if (i <= 23) return "Epic";
  return "Legendary";
}
function handNearButtons(hand, buttons) {
  for (const b of buttons) if (distance(hand, b) <= 0.5) return true;
  return false;
}

// === Fishing & Casino config ===
const FISHING_AREA = [-629.014, 132.39, 99.187];
const FISHING_RADIUS = 6;
const FISHING_INTERVAL = 6000;
const ACTIVATE_BUTTONS = [[-644.649, 129.539, 96.801]];
const BUY_BUTTONS = [[-648.281, 129.425, 102.730]];
const SELL_BUTTONS = [[-652.948, 129.639, 90.326]];
const CASINO_POS = [-808.617, 135.843, 0.896];
const CASINO_RADIUS = 1.5;

// === Data ===
let fishingTimers = {}, ACTIVE_PLAYERS = {},
    ACTIVATE_STATE = {}, BUY_STATE = {}, SELL_STATE = {},
    rouletteInProgress = {}, CASINO_WELCOME = {}, factionBuffTimers = {};

const playersFile = './players.json';
let playersData = fs.existsSync(playersFile)
  ? JSON.parse(fs.readFileSync(playersFile))
  : {};

function savePlayers() {
  fs.writeFileSync(playersFile, JSON.stringify(playersData, null, 2));
}

// === Bait & Fish ===
const BAITS = [
  { name: "Worms", price: 0 },
  { name: "Insects", price: 50 },
  { name: "Bread Crust", price: 100 },
  { name: "Dough Balls", price: 150 },
  { name: "Corn Kernels", price: 200 },
  { name: "Small Grubs", price: 250 },
  { name: "Minnows", price: 350 },
  { name: "Cheese Cubes", price: 400 },
  { name: "Maggots", price: 450 },
  { name: "Shrimp", price: 500 },
  { name: "Crickets", price: 550 },
  { name: "Sweet Corn", price: 600 },
  { name: "Glow Worms", price: 700 },
  { name: "Salmon Eggs", price: 750 },
  { name: "Mealworms", price: 800 },
  { name: "Squid Chunks", price: 850 },
  { name: "Jellyfish Tentacle", price: 900 },
  { name: "Special Herb Mix", price: 1000 },
  { name: "Golden Worm", price: 1200 },
  { name: "Crystal Shrimp", price: 1250 },
  { name: "Firefly Larvae", price: 1300 },
  { name: "Phantom Minnows", price: 1350 },
  { name: "Mystic Corn", price: 1400 },
  { name: "Coral Fragments", price: 1500 },
  { name: "Dragonfly Essence", price: 1700 },
  { name: "Phoenix Feather Flakes", price: 1750 },
  { name: "Leviathan Tentacle", price: 1800 },
  { name: "Mermaid Tears", price: 1850 },
  { name: "Stardust Grain", price: 1900 },
  { name: "Titan Worm", price: 2000 },
  { name: "Rgamersthumb", price: 9000 }
];

const FISH = {
  Common: { "Small Carp": 1, "Bluegill": 2, "Minnow": 3 },
  Uncommon: { "Carp": 8, "Trout": 6, "Bass": 9 },
  Rare: { "Golden Trout": 20, "Electric Eel": 18, "Pufferfish": 15 },
  Epic: { "Firefin Salmon": 30, "Ghost Catfish": 27, "Obsidian Eel": 33 },
  Legendary: { "Dragonfish": 50, "Leviathan Carp": 45, "Phoenix Salmon": 48 }
};

// === Fishing system ===
async function startFishing(username) {
  if (!playersData[username])
    playersData[username] = { baitIndex: 0, fishInventory: [] };
  let baitIndex = playersData[username].baitIndex || 0;
  let tier = getBaitTier(baitIndex);
  let fishList = Object.keys(FISH[tier]);
  let fish = fishList[Math.floor(Math.random() * fishList.length)];
  let price = FISH[tier][fish];
  playersData[username].fishInventory.push({ name: fish, price });
  savePlayers();
  await connection.send(`player message "${username}" "You caught a ${fish} worth ${price} coins!"`);
}
async function sellFish(username) {
  const p = playersData[username];
  if (!p?.fishInventory?.length) return;
  let total = p.fishInventory.reduce((a, f) => a + f.price, 0);
  p.fishInventory = [];
  savePlayers();
  await connection.send(`trade atm add "${username}" ${total}`);
  await connection.send(`player message "${username}" "Sold all fish for ${total} coins!"`);
}
async function buyBait(username) {
  const p = (playersData[username] ||= { baitIndex: 0, fishInventory: [] });
  let i = p.baitIndex;
  if (i + 1 >= BAITS.length)
    return connection.send(`player message "${username}" "You already have the best bait!"`);
  const next = BAITS[i + 1];
  p.baitIndex++;
  p.currentBait = next.name;
  savePlayers();
  await connection.send(`player message "${username}" "Bought ${next.name}!"`);
}

// === Casino / Roulette ===
async function startRoulette(username) {
  rouletteInProgress[username] = true;
  const values = new Array(10).fill(0);
  let index = Math.floor(Math.random() * 10);
  let delay = 30, spins = 0, totalSpins = 70 + Math.floor(Math.random() * 30);

  const drawCircle = () => {
    const h = (i) => {
      const val = values[i];
      const str = val >= 0 ? `+${val}` : `${val}`;
      return i === index ? `[${str}]` : ` ${str} `;
    };
    return [
      `${h(0)} ${h(1)} ${h(2)}`,
      `${h(9)}          ${h(3)}`,
      `${h(8)}          ${h(4)}`,
      `${h(7)} ${h(6)} ${h(5)}`
    ].join('\n');
  };

  const spin = async () => {
    for (let i = 0; i < values.length; i++) {
      const val = Math.floor(Math.random() * 100) + 1;
      const sign = Math.random() < 0.4 ? 1 : -1;
      values[i] = val * sign;
    }
    await connection.send(`player message "${username}" "${drawCircle()}"`);
    index = (index + 1) % 10;
    delay += 10;
    spins++;
    if (spins >= totalSpins) {
      const result = values[(index + 9) % 10];
      await connection.send(`trade atm add ${username} ${result}`);
      await connection.send(`player message "${username}" "You won ${result} ATM!"`);
      rouletteInProgress[username] = false;
    } else setTimeout(spin, delay);
  };
  spin();
}

// === Faction Buff Logic ===
function applyFactionBuff(username, faction) {
  if (factionBuffTimers[username]) clearInterval(factionBuffTimers[username]);

  const apply = async () => {
    if (faction === "Kingdom of Avalis")
      await connection.send(`player modify-stat "${username}" speed 2 300`);
    else if (faction === "Kingdom of Veyra")
      await connection.send(`player modify-stat "${username}" damage 2 300`);
  };

  apply();
  factionBuffTimers[username] = setInterval(apply, 300 * 1000); // every 5 min
}

// === Loop Systems ===
async function startBotLoops() {
  console.log("✅ Bot loops running...");

  // Fishing loop
  setInterval(async () => {
    const res = await connection.send('player list-detailed');
    const players = res.data?.Result || [];
    for (const p of players) {
      const name = p.username;
      const hand = p.RightHandPosition || p.LeftHandPosition;
      if (!hand) continue;

      if (handNearButtons(hand, ACTIVATE_BUTTONS) && !ACTIVATE_STATE[name]) {
        ACTIVATE_STATE[name] = true;
        ACTIVE_PLAYERS[name] = true;
        await connection.send(`player message "${name}" "Fishing activated!"`);
      } else if (!handNearButtons(hand, ACTIVATE_BUTTONS)) ACTIVATE_STATE[name] = false;

      if (handNearButtons(hand, BUY_BUTTONS) && ACTIVE_PLAYERS[name] && !BUY_STATE[name]) {
        BUY_STATE[name] = true;
        await buyBait(name);
      } else if (!handNearButtons(hand, BUY_BUTTONS)) BUY_STATE[name] = false;

      if (handNearButtons(hand, SELL_BUTTONS) && ACTIVE_PLAYERS[name] && !SELL_STATE[name]) {
        SELL_STATE[name] = true;
        await sellFish(name);
      } else if (!handNearButtons(hand, SELL_BUTTONS)) SELL_STATE[name] = false;

      const inArea = distance(hand, FISHING_AREA) <= FISHING_RADIUS;
      if (inArea && ACTIVE_PLAYERS[name] && !fishingTimers[name]) {
        fishingTimers[name] = setInterval(() => startFishing(name), FISHING_INTERVAL);
        await connection.send(`player message "${name}" "Auto fishing started!"`);
      } else if ((!inArea || !ACTIVE_PLAYERS[name]) && fishingTimers[name]) {
        clearInterval(fishingTimers[name]);
        delete fishingTimers[name];
        await connection.send(`player message "${name}" "Left fishing area."`);
      }
    }
  }, 6000);

const friendlyFireTracker = {};
const jailCoords = "-847.243,608.0,-1762.084";
const jailDuration = 50000; // 50 sec

function distance3D(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

function pushBackPosition(from, forward, dist) {
  const [x, y, z] = from;
  const [fx, fy, fz] = forward;
  return `${x - fx * dist},${y},${z - fz * dist}`;
}

connection.subscribe("PlayerStateChanged", async (msg) => {
  const { user, state, isEnter } = msg.data;
  if (state !== "Combat" || !isEnter) return;

  const attacker = user.username;
  const attackerId = user.id;
  const victim = lastHitBy[attacker];
  if (!victim || victim === attacker) return;
  const attackerEntry = Object.values(joinedPlayers).find(p => p.username.toLowerCase() === attacker.toLowerCase());
  const victimEntry = Object.values(joinedPlayers).find(p => p.username.toLowerCase() === victim.toLowerCase());
  if (!attackerEntry || !victimEntry) return;

  const sameFaction = attackerEntry.faction === victimEntry.faction && attackerEntry.faction != null;

  if (!sameFaction) return;
  const now = Date.now();
  if (!friendlyFireTracker[attacker]) friendlyFireTracker[attacker] = [];
  friendlyFireTracker[attacker].push(now);
  friendlyFireTracker[attacker] = friendlyFireTracker[attacker].filter(t => now - t < 10 * 60 * 1000); // 10 min window
  const count = friendlyFireTracker[attacker].length;

  connection.send(`player modify-stat ${victim} damageprotection 99 5`);
  connection.send(`player message "${victim}" "You are protected from friendly fire!" 3`);
  try {
    const list = await connection.send("player list-detailed");
    const players = list.data?.Result || [];
    const atkData = players.find(p => p.username === attacker);
    if (atkData && atkData.HeadForward && atkData.Position) {
      const tpPos = pushBackPosition(atkData.Position, atkData.HeadForward, 10);
      await connection.send(`player set-home ${attacker} ${tpPos}`);
      await connection.send(`player teleport ${attacker} home`);
      await connection.send(`player set-home ${attacker} 0,0,0`);
    }
  } catch (e) {
    console.warn(`[FF] Teleport error for ${attacker}:`, e.message);
  }

  const remaining = 3 - count;
  if (remaining > 0) {
    connection.send(`player message "${attacker}" "You can’t attack your faction members! ${remaining} more hit${remaining > 1 ? 's' : ''} till punishment!" 5`);
  }

  if (count >= 3) {
    connection.send(`player message "${attacker}" "You’ve been jailed for attacking your own faction!" 5`);
    connection.send(`player set-home ${attacker} ${jailCoords}`);
    connection.send(`player teleport ${attacker} home`);

    let remainingTime = jailDuration / 1000;
    const timer = setInterval(() => {
      if (remainingTime > 0) {
        connection.send(`player message "${attacker}" "Jail time left: ${remainingTime}s" 1`);
        remainingTime -= 5;
      } else {
        clearInterval(timer);
        connection.send(`player message "${attacker}" "You are free now. Don't attack your clan again!" 5`);
        connection.send(`player teleport ${attacker} ${attackerEntry.lastFreePosition || "0,0,0"}`);
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(timer);
      connection.send(`player message "${attacker}" "Released from jail!" 3`);
      connection.send(`player teleport ${attacker} ${attackerEntry.lastFreePosition || "0,0,0"}`);
    }, jailDuration);

    friendlyFireTracker[attacker] = [];
  }
});

  // Casino / roulette loop
  setInterval(async () => {
    const res = await connection.send('player list-detailed');
    const players = res.data?.Result || [];
    for (const p of players) {
      const name = p.username;
      if (!name || rouletteInProgress[name]) continue;
      const inv = (await connection.send(`player inventory ${name}`)).data?.Result?.[0];
      if (!inv) continue;
      const l = inv.LeftHand?.Name?.toLowerCase() || '';
      const r = inv.RightHand?.Name?.toLowerCase() || '';
      if (l.includes('key standard') || r.includes('key standard')) {
        console.log(`[ROULETTE] ${name} started roulette`);
        if (inv.LeftHand?.Identifier) await connection.send(`wacky destroy ${inv.LeftHand.Identifier}`);
        if (inv.RightHand?.Identifier) await connection.send(`wacky destroy ${inv.RightHand.Identifier}`);
        startRoulette(name);
      }
    }
  }, 2000);

  // Casino welcome loop
  setInterval(async () => {
    const res = await connection.send('player list-detailed');
    const players = res.data?.Result || [];
    for (const p of players) {
      const name = p.username?.toLowerCase();
      const pos = p.Position;
      if (!name || !pos) continue;
      const near = distance(pos, CASINO_POS) <= CASINO_RADIUS;
      if (near && !CASINO_WELCOME[name]) {
        CASINO_WELCOME[name] = true;
        await connection.send(`player message "${name}" "🎰 Welcome to the Casino!"`);
      } else if (!near) CASINO_WELCOME[name] = false;
    }
  }, 1000);
}

// === Start ===
async function start() {
  try {
    await bot.start();
    console.log('✅ ATT bot started');

    const serverId = 1196821868; // fixed server ID
    connection = await bot.openServerConnection(serverId);
    console.log(`✅ Connected to ATT server ID ${serverId}`);

    await connection.send(`player message "* online!" 30`);
    console.log('✅ Online message sent');

    // === Faction Logic ===
    connection.subscribe("PlayerJoined", async message => {
      const { user } = message.data;
      const username = user.username;

      const linkedEntry = Object.values(linkedPlayers).find(p => p.ign.toLowerCase() === username.toLowerCase());
      if (!linkedEntry || !linkedEntry.faction) return;

      const faction = linkedEntry.faction;
      console.log(`[FACTION] ${username} joined and belongs to ${faction}`);
      await connection.send(`player message "${username}" "🏰 Welcome back, warrior of ${faction}!"`);
      applyFactionBuff(username, faction);
      startBotLoops();
    });

  } catch (err) {
    console.error("❌ Error starting bot:", err);
  }
}
