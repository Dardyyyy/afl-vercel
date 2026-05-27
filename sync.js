// In-memory store (persists per serverless instance, resets on cold start)
// For production, connect Vercel KV: npm i @vercel/kv
// For now we use a simple JSON file approach via Vercel's /tmp

import { readFileSync, writeFileSync, existsSync } from 'fs';
const DB_PATH = '/tmp/afl-sync.json';

function loadDB() {
  try {
    if (existsSync(DB_PATH)) return JSON.parse(readFileSync(DB_PATH, 'utf8'));
  } catch (e) {}
  return { steps: {}, users: {}, reports: [], activity: [] };
}
function saveDB(db) {
  writeFileSync(DB_PATH, JSON.stringify(db));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = loadDB();

  if (req.method === 'GET') {
    // Return current shared state
    return res.status(200).json({
      steps: db.steps,
      users: db.users,
      reports: db.reports || [],
      activity: (db.activity || []).slice(-100)
    });
  }

  if (req.method === 'POST') {
    const { action, user, data } = req.body;

    if (action === 'login') {
      db.users[user] = { name: user, lastSeen: Date.now(), online: true };
      db.activity.push({ t: Date.now(), u: user, a: 'login' });
      saveDB(db);
      return res.status(200).json({ ok: true, users: db.users });
    }

    if (action === 'logout') {
      if (db.users[user]) db.users[user].online = false;
      db.activity.push({ t: Date.now(), u: user, a: 'logout' });
      saveDB(db);
      return res.status(200).json({ ok: true });
    }

    if (action === 'step_update') {
      // data = { seq, status, comment, program }
      const { seq, status, comment, program } = data;
      if (!db.steps[seq]) db.steps[seq] = {};
      db.steps[seq].status = status;
      db.steps[seq].comment = comment || '';
      db.steps[seq].user = user;
      db.steps[seq].time = Date.now();
      db.steps[seq].program = program || '';
      db.activity.push({ t: Date.now(), u: user, a: status, s: seq, p: program });
      // Keep activity trimmed
      if (db.activity.length > 500) db.activity = db.activity.slice(-300);
      saveDB(db);
      return res.status(200).json({ ok: true, step: db.steps[seq] });
    }

    if (action === 'report') {
      db.reports.push({ ...data, user, time: Date.now() });
      if (db.reports.length > 50) db.reports = db.reports.slice(-50);
      db.activity.push({ t: Date.now(), u: user, a: 'report' });
      saveDB(db);
      return res.status(200).json({ ok: true });
    }

    if (action === 'heartbeat') {
      if (db.users[user]) {
        db.users[user].lastSeen = Date.now();
        db.users[user].online = true;
        db.users[user].currentStep = data?.currentStep || null;
        db.users[user].currentProg = data?.currentProg || null;
      }
      // Mark users offline if no heartbeat for 2 min
      const now = Date.now();
      for (const [u, info] of Object.entries(db.users)) {
        if (now - info.lastSeen > 120000) info.online = false;
      }
      saveDB(db);
      return res.status(200).json({ ok: true, users: db.users, activity: (db.activity || []).slice(-20) });
    }

    if (action === 'reset') {
      // Reset all step states
      db.steps = {};
      db.activity.push({ t: Date.now(), u: user, a: 'reset' });
      saveDB(db);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
