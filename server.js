const crypto = require("crypto");
const path = require("path");
const express = require("express");
const { readDb, writeDb, storageMode, ensureFileDb } = require("./storage");

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;

const app = express();
app.use(express.json({ limit: "2mb" }));

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

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storage: storageMode() });
});

app.get(
  "/api/races",
  asyncHandler(async (req, res) => {
    const db = await readDb();
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let races = Object.values(db.races || {});
    if (ids.length) {
      const set = new Set(ids);
      races = races.filter((r) => set.has(r.id));
    }

    races.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(races.map(summarize));
  })
);

app.post(
  "/api/races",
  asyncHandler(async (req, res) => {
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

    const db = await readDb();
    db.races = db.races || {};
    db.races[race.id] = race;
    await writeDb(db);
    res.status(201).json(race);
  })
);

app.get(
  "/api/races/:id",
  asyncHandler(async (req, res) => {
    const db = await readDb();
    const race = db.races?.[req.params.id];
    if (!race) return res.status(404).json({ error: "Rennen nicht gefunden." });
    res.json(race);
  })
);

app.get(
  "/api/races/:id/public",
  asyncHandler(async (req, res) => {
    const db = await readDb();
    const race = db.races?.[req.params.id];
    if (!race) return res.status(404).json({ error: "Rennen nicht gefunden." });
    res.json(publicRace(race));
  })
);

app.put(
  "/api/races/:id",
  asyncHandler(async (req, res) => {
    const db = await readDb();
    const existing = db.races?.[req.params.id];
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
    await writeDb(db);
    res.json(next);
  })
);

app.delete(
  "/api/races/:id",
  asyncHandler(async (req, res) => {
    const db = await readDb();
    if (!db.races?.[req.params.id]) {
      return res.status(404).json({ error: "Rennen nicht gefunden." });
    }
    delete db.races[req.params.id];
    await writeDb(db);
    res.json({ ok: true });
  })
);

app.get("/e/:id", (_req, res) => {
  res.sendFile(path.join(ROOT, "ergebnis.html"));
});

app.get("/r/:id", (_req, res) => {
  res.sendFile(path.join(ROOT, "laufen.html"));
});

app.get("/laufen", (_req, res) => {
  res.sendFile(path.join(ROOT, "laufen.html"));
});

app.get("/laufen/", (_req, res) => {
  res.redirect("/laufen");
});

app.get("/tennis", (_req, res) => {
  res.sendFile(path.join(ROOT, "tennis.html"));
});

app.get("/tennis/", (_req, res) => {
  res.redirect("/tennis");
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Serverfehler" });
});

if (storageMode() === "file") {
  ensureFileDb();
}

app.listen(PORT, () => {
  console.log(`Sport Tracker listening on ${PORT} (storage=${storageMode()})`);
});
