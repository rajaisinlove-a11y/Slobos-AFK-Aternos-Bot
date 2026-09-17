'use strict';

const express = require('express');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const env = process.env;
const csv = (value, fallback) => (value === undefined ? fallback : value.split('|').map(x => x.trim()).filter(Boolean));
const config = {
  host: env.MC_HOST || 'localhost',
  port: Number(env.MC_PORT || 25565),
  username: env.MC_USERNAME || 'java_afk_bot',
  password: env.MC_PASSWORD || undefined,
  auth: env.MC_AUTH || 'offline',
  version: env.MC_VERSION || false,
  chatMessages: csv(env.CHAT_MESSAGES, ['I am keeping the server online']),
  chatInterval: Math.max(15, Number(env.CHAT_INTERVAL_SECONDS || 120)) * 1000,
  antiAfk: env.ANTI_AFK !== 'false',
  autoAuth: env.AUTO_AUTH === 'true',
  authPassword: env.AUTO_AUTH_PASSWORD || '',
  combat: env.COMBAT === 'true',
  dashboardToken: env.DASHBOARD_TOKEN || ''
};

const app = express();
const PORT = Number(env.PORT || 5000);
let bot = null;
let reconnectTimer = null;
let chatTimer = null;
let movementTimer = null;
let combatTimer = null;
let stopping = false;
let reconnectDelay = 2000;
const state = { status: 'starting', since: Date.now(), lastError: null, lastEvent: 'Starting', reconnects: 0, position: null, logs: [] };

function log(message, error = false) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  state.logs.push(line);
  if (state.logs.length > 200) state.logs.shift();
  if (error) state.lastError = message;
  state.lastEvent = message;
}
function clearTimers() {
  if (chatTimer) clearInterval(chatTimer);
  if (movementTimer) clearInterval(movementTimer);
  if (combatTimer) clearInterval(combatTimer);
  chatTimer = movementTimer = combatTimer = null;
}
function disconnectBot(reason) {
  if (!bot) return;
  // bot.quit only exists once the handshake finished; fall back to ending the socket.
  try { if (typeof bot.quit === 'function') bot.quit(reason); else if (typeof bot.end === 'function') bot.end(reason); else bot._client?.end?.(reason); } catch (e) { log(`Disconnect failed: ${e.message}`, true); }
}
function scheduleReconnect() {
  if (stopping || reconnectTimer) return;
  state.status = 'reconnecting';
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, 120000);
  state.reconnects++;
  log(`Reconnecting in ${Math.round(delay / 1000)} seconds`);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
}
function sendChat(message) {
  if (bot && state.status === 'connected' && message) {
    // Never write auth commands (which contain the password) into the logs.
    const safe = /^\/(login|register)\b/i.test(message) ? message.split(' ')[0] + ' ****' : message;
    try { bot.chat(message); log(`Chat sent: ${safe}`); } catch (e) { log(`Chat failed: ${e.message}`, true); }
  }
}
let lastAuthCommandAt = 0;
function handleAutoAuth(message) {
  if (!config.autoAuth || !/register|login/i.test(message)) return;
  // Both 'chat' and 'messagestr' can fire for the same prompt; debounce so we only answer once.
  const now = Date.now();
  if (now - lastAuthCommandAt < 5000) return;
  lastAuthCommandAt = now;
  sendChat(message.toLowerCase().includes('register') ? `/register ${config.authPassword} ${config.authPassword}` : `/login ${config.authPassword}`);
}
function startBehavior() {
  clearTimers();
  if (config.chatMessages.length) {
    chatTimer = setInterval(() => sendChat(config.chatMessages[Math.floor(Math.random() * config.chatMessages.length)]), config.chatInterval);
  }
  if (config.antiAfk) {
    movementTimer = setInterval(() => {
      if (!bot || state.status !== 'connected') return;
      // Small, harmless movement that also prevents common idle kicks.
      bot.setControlState('jump', true);
      setTimeout(() => bot && bot.setControlState('jump', false), 400);
      bot.look(bot.entity.yaw + 0.7, bot.entity.pitch, true).catch(() => {});
    }, 30000);
  }
  if (config.combat) {
    combatTimer = setInterval(() => {
      if (!bot || state.status !== 'connected' || !bot.entity) return;
      const target = bot.nearestEntity(entity => entity.type === 'mob' && entity.position.distanceTo(bot.entity.position) < 4);
      if (target) {
        bot.lookAt(target.position.offset(0, target.height || 1, 0), true).then(() => bot.attack(target)).catch(() => {});
      }
    }, 2500);
  }
}
function connect() {
  if (stopping) return;
  clearTimers();
  state.status = 'connecting'; state.since = Date.now(); state.position = null;
  log(`Connecting to Java server ${config.host}:${config.port}${config.version ? ` (version ${config.version})` : ' (auto-detect)'}`);
  try {
    bot = mineflayer.createBot({ host: config.host, port: config.port, username: config.username, password: config.password, auth: config.auth, version: config.version || false, hideErrors: true });
    bot.loadPlugin(pathfinder);
    bot.once('spawn', () => {
      state.status = 'connected'; state.since = Date.now(); state.lastError = null; reconnectDelay = 2000;
      log(`Connected as ${config.username}; server version ${bot.version || 'unknown'}`);
      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new Movements(bot, mcData));
      startBehavior();
    });
    bot.on('chat', (username, message) => {
      if (username !== bot.username) log(`Chat <${username}> ${message}`);
      handleAutoAuth(message);
    });
    bot.on('messagestr', message => handleAutoAuth(message));
    bot.on('physicTick', () => { if (bot.entity?.position) state.position = { x: +bot.entity.position.x.toFixed(2), y: +bot.entity.position.y.toFixed(2), z: +bot.entity.position.z.toFixed(2) }; });
    bot.on('kicked', reason => log(`Kicked: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`, true));
    bot.on('error', err => log(`Bot error: ${err.message}`, true));
    bot.on('end', reason => { clearTimers(); state.status = 'offline'; log(`Connection ended${reason ? `: ${reason}` : ''}`); scheduleReconnect(); });
  } catch (err) { log(`Failed to create bot: ${err.message}`, true); scheduleReconnect(); }
}

app.get('/', (_req, res) => res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width"><title>Java AFK Bot</title><style>body{font:16px system-ui;max-width:650px;margin:40px auto;padding:0 20px;background:#111;color:#eee}article{padding:20px;border:1px solid #333;border-radius:12px}dt{color:#aaa;margin-top:12px}dd{margin:3px 0}pre{white-space:pre-wrap;color:#aaa}</style><article><h1>Minecraft Java AFK Bot</h1><dl><dt>Status</dt><dd id="s">Loading…</dd><dt>Position</dt><dd id="p">—</dd><dt>Uptime</dt><dd id="u">—</dd><dt>Reconnects</dt><dd id="r">—</dd></dl><pre>Logs require a token: GET /logs with header Authorization: Bearer &lt;DASHBOARD_TOKEN&gt;</pre></article><script>async function u(){let x=await fetch('/health').then(r=>r.json());s.textContent=x.status+' — '+x.lastEvent;p.textContent=x.position?JSON.stringify(x.position):'—';document.getElementById('u').textContent=Math.floor(x.uptime/1000)+'s';r.textContent=x.reconnects}u();setInterval(u,5000)</script>`));
app.get('/health', (_req, res) => res.json({ ok: state.status === 'connected', status: state.status, position: state.position, uptime: Date.now() - state.since, lastEvent: state.lastEvent, reconnects: state.reconnects }));
function requireToken(req, res, next) {
  if (!config.dashboardToken) return res.status(503).json({ ok: false, error: 'DASHBOARD_TOKEN is not set; control endpoints are disabled' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== config.dashboardToken) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}
app.get('/logs', requireToken, (_req, res) => res.type('text').send(state.logs.join('\n')));
app.get('/stop', requireToken, (_req, res) => { stopping = true; clearTimers(); if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } disconnectBot('Stopped from dashboard'); state.status = 'stopped'; log('Bot stopped from dashboard'); res.json({ ok: true }); });
app.get('/start', requireToken, (_req, res) => { if (stopping) { stopping = false; reconnectDelay = 2000; connect(); log('Bot started from dashboard'); } res.json({ ok: true }); });
app.listen(PORT, '0.0.0.0', () => log(`HTTP dashboard listening on port ${PORT}`));
process.on('SIGTERM', () => { stopping = true; clearTimers(); disconnectBot('Shutdown'); process.exit(0); });
connect();
