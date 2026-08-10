const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "races.json");

const app = express();
app.use(express.json({ limit: "2mb" }));

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ races: {} }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { races: {} };
  }
}

function writeDb(db) {
  ensureDb();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function newId() {
  return crypto.randomBytes(5).toString("hex");
}

function summarize(race) {
  const participants = race.participants || [];
  return {
    id: race.id,
    name: race.name,
    createdAt: race.createdAt,
    updatedAt: race.updatedAt,
    status: race.status,
    startedAt: race.startedAt,
    endedAt: race.endedAt,
    participantCount: participants.length,
    finishedCount: participants.filter((p) => p.status === "finished").length,
    dnsCount: participants.filter((p) => p.status === "dns").length,
  };
}

function publicRace(race) {
  return {
    id: race.id,
    name: race.name,
    status: race.status,
    startedAt: race.startedAt,
    endedAt: race.endedAt,
    updatedAt: race.updatedAt,
    participants: (race.participants || []).map((p) => ({
      startNumber: p.startNumber,
      name: p.name,
      gender: p.gender,
      category: p.category,
      status: p.status,
      finishMs: p.finishMs,
    })),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/races", (req, res) => {
  const db = readDb();
  const ids = String(req.query.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let races = Object.values(db.races);
  if (ids.length) {
    const set = new Set(ids);
    races = races.filter((r) => set.has(r.id));
  }

  races.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json(races.map(summarize));
});

app.post("/api/races", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Name fehlt." });
  }

  const now = new Date().toISOString();
  const race = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    status: "setup",
    participants: [],
    startedAt: null,
    endedAt: null,
  };

  const db = readDb();
  db.races[race.id] = race;
  writeDb(db);
  res.status(201).json(race);
});

app.get("/api/races/:id", (req, res) => {
  const db = readDb();
  const race = db.races[req.params.id];
  if (!race) return res.status(404).json({ error: "Rennen nicht gefunden." });
  res.json(race);
});

app.get("/api/races/:id/public", (req, res) => {
  const db = readDb();
  const race = db.races[req.params.id];
  if (!race) return res.status(404).json({ error: "Rennen nicht gefunden." });
  res.json(publicRace(race));
});

app.put("/api/races/:id", (req, res) => {
  const db = readDb();
  const existing = db.races[req.params.id];
  if (!existing) return res.status(404).json({ error: "Rennen nicht gefunden." });

  const body = req.body || {};
  const next = {
    ...existing,
    name: body.name != null ? String(body.name).trim() || existing.name : existing.name,
    status: body.status != null ? body.status : existing.status,
    participants: Array.isArray(body.participants) ? body.participants : existing.participants,
    startedAt: body.startedAt !== undefined ? body.startedAt : existing.startedAt,
    endedAt: body.endedAt !== undefined ? body.endedAt : existing.endedAt,
    updatedAt: new Date().toISOString(),
  };

  db.races[next.id] = next;
  writeDb(db);
  res.json(next);
});

app.get("/e/:id", (_req, res) => {
  res.sendFile(path.join(ROOT, "ergebnis.html"));
});

app.use(express.static(ROOT, {
  index: "index.html",
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Nicht gefunden." });
  }
  return next();
});

ensureDb();
app.listen(PORT, () => {
  console.log(`Laufrennen Tracker listening on ${PORT}`);
});
