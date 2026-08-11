const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "races.json");
const GIST_ID = process.env.RACES_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

function emptyDb() {
  return { races: {} };
}

function useGist() {
  return Boolean(GIST_ID && GITHUB_TOKEN);
}

function ensureFileDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(), null, 2));
  }
}

function readFileDb() {
  ensureFileDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return emptyDb();
  }
}

function writeFileDb(db) {
  ensureFileDb();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

async function gistRequest(method, body) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "laufrennen-tracker",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data.message || `GitHub Gist Fehler (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function readGistDb() {
  const gist = await gistRequest("GET");
  const file = gist.files && (gist.files["races.json"] || Object.values(gist.files)[0]);
  if (!file || !file.content) return emptyDb();
  try {
    const parsed = JSON.parse(file.content);
    if (!parsed || typeof parsed !== "object") return emptyDb();
    if (!parsed.races || typeof parsed.races !== "object") {
      return { races: {} };
    }
    return parsed;
  } catch {
    return emptyDb();
  }
}

async function writeGistDb(db) {
  await gistRequest("PATCH", {
    files: {
      "races.json": {
        content: JSON.stringify(db, null, 2),
      },
    },
  });
}

async function readDb() {
  if (useGist()) return readGistDb();
  return readFileDb();
}

async function writeDb(db) {
  if (useGist()) return writeGistDb(db);
  return writeFileDb(db);
}

function storageMode() {
  return useGist() ? "gist" : "file";
}

module.exports = {
  readDb,
  writeDb,
  storageMode,
  ensureFileDb,
};
