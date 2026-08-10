(() => {
  const { escapeHtml, formatElapsed, renderRanking, exportExcel } = window.RaceRanking;
  const OWN_RACES_KEY = "laufrennen.ownRaceIds";

  const state = {
    raceId: null,
    raceName: "",
    participants: [],
    phase: "home", // home | setup | ready | running | finished
    startedAt: null,
    endedAt: null,
    clockTimer: null,
    rankingView: "overall",
    saveTimer: null,
    saving: false,
  };

  const els = {
    subtitle: document.getElementById("subtitle"),
    raceClock: document.getElementById("raceClock"),
    clockValue: document.getElementById("clockValue"),
    raceNameInput: document.getElementById("raceNameInput"),
    homeError: document.getElementById("homeError"),
    btnCreateRace: document.getElementById("btnCreateRace"),
    raceList: document.getElementById("raceList"),
    raceListCount: document.getElementById("raceListCount"),
    setupTitle: document.getElementById("setupTitle"),
    fileInput: document.getElementById("fileInput"),
    importError: document.getElementById("importError"),
    previewBlock: document.getElementById("previewBlock"),
    previewBody: document.getElementById("previewBody"),
    participantCount: document.getElementById("participantCount"),
    readyCount: document.getElementById("readyCount"),
    btnReady: document.getElementById("btnReady"),
    btnStart: document.getElementById("btnStart"),
    btnBackToImport: document.getElementById("btnBackToImport"),
    btnEndRace: document.getElementById("btnEndRace"),
    btnConfirmEnd: document.getElementById("btnConfirmEnd"),
    btnNewRace: document.getElementById("btnNewRace"),
    btnExport: document.getElementById("btnExport"),
    btnCopyShare: document.getElementById("btnCopyShare"),
    shareLinkInput: document.getElementById("shareLinkInput"),
    shareNote: document.getElementById("shareNote"),
    finishedTitle: document.getElementById("finishedTitle"),
    tiles: document.getElementById("tiles"),
    finishedCount: document.getElementById("finishedCount"),
    remainingCount: document.getElementById("remainingCount"),
    finishedSummary: document.getElementById("finishedSummary"),
    rankingContent: document.getElementById("rankingContent"),
    confirmModal: document.getElementById("confirmModal"),
    views: {
      home: document.getElementById("view-home"),
      setup: document.getElementById("view-setup"),
      ready: document.getElementById("view-ready"),
      running: document.getElementById("view-running"),
      finished: document.getElementById("view-finished"),
    },
  };

  function getOwnRaceIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(OWN_RACES_KEY) || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch {
      return [];
    }
  }

  function rememberRaceId(id) {
    const ids = getOwnRaceIds().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(OWN_RACES_KEY, JSON.stringify(ids.slice(0, 100)));
  }

  function setHash(path) {
    const next = path || "";
    if (location.hash === next) return;
    location.hash = next;
  }

  function parseHash() {
    const raw = location.hash.replace(/^#/, "");
    const raceMatch = raw.match(/^\/race\/([a-z0-9]+)$/i);
    if (raceMatch) return { view: "race", id: raceMatch[1] };
    return { view: "home" };
  }

  function shareUrl(id) {
    return `${location.origin}/e/${id}`;
  }

  function showHomeError(message) {
    els.homeError.hidden = !message;
    els.homeError.textContent = message || "";
  }

  function showImportError(message) {
    els.importError.hidden = !message;
    els.importError.textContent = message || "";
  }

  function setPhase(phase) {
    state.phase = phase;
    Object.entries(els.views).forEach(([key, node]) => {
      node.hidden = key !== phase;
    });

    const labels = {
      home: "Deine Rennen",
      setup: state.raceName || "Teilnehmer importieren",
      ready: state.raceName || "Bereit zum Start",
      running: state.raceName || "Rennen läuft",
      finished: state.raceName || "Ergebnis & Export",
    };
    els.subtitle.textContent = labels[phase];
    els.raceClock.hidden = phase !== "running" && phase !== "finished";
  }

  function statusLabel(status) {
    if (status === "finished") return "Beendet";
    if (status === "running") return "Läuft";
    if (status === "ready") return "Bereit";
    return "Vorbereitung";
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Anfrage fehlgeschlagen.");
    }
    return data;
  }

  function payloadFromState() {
    return {
      name: state.raceName,
      status: state.phase === "home" ? "setup" : state.phase,
      participants: state.participants,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
    };
  }

  function applyRace(race) {
    state.raceId = race.id;
    state.raceName = race.name;
    state.participants = Array.isArray(race.participants) ? race.participants : [];
    state.startedAt = race.startedAt ?? null;
    state.endedAt = race.endedAt ?? null;
    rememberRaceId(race.id);

    const phase =
      race.status === "finished" ||
      race.status === "running" ||
      race.status === "ready" ||
      race.status === "setup"
        ? race.status
        : "setup";

    if (phase === "setup") {
      renderPreview();
      setPhase("setup");
      if (els.setupTitle) els.setupTitle.textContent = race.name;
    } else if (phase === "ready") {
      els.readyCount.textContent = String(state.participants.length);
      setPhase("ready");
    } else if (phase === "running") {
      setPhase("running");
      renderTiles();
      startClock();
    } else {
      state.rankingView = "overall";
      syncRankingTabs();
      renderFinished();
      setPhase("finished");
      stopClock();
      updateClock();
    }
  }

  function scheduleSave() {
    if (!state.raceId || state.phase === "home") return;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      saveRace().catch(() => {});
    }, 350);
  }

  async function saveRace() {
    if (!state.raceId || state.saving) return;
    state.saving = true;
    try {
      await api(`/api/races/${state.raceId}`, {
        method: "PUT",
        body: JSON.stringify(payloadFromState()),
      });
    } finally {
      state.saving = false;
    }
  }

  async function loadHome() {
    stopClock();
    state.raceId = null;
    state.raceName = "";
    state.participants = [];
    state.startedAt = null;
    state.endedAt = null;
    state.rankingView = "overall";
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    els.previewBody.innerHTML = "";
    els.rankingContent.innerHTML = "";
    showImportError("");
    showHomeError("");
    setPhase("home");
    setHash("");

    const ids = getOwnRaceIds();
    els.raceListCount.textContent = String(ids.length);
    if (!ids.length) {
      els.raceList.innerHTML = `<p class="empty-hint">Noch keine Rennen auf diesem Gerät.</p>`;
      return;
    }

    els.raceList.innerHTML = `<p class="empty-hint">Lade Rennen…</p>`;
    try {
      const races = await api(`/api/races?ids=${encodeURIComponent(ids.join(","))}`);
      const byId = new Map(races.map((r) => [r.id, r]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
      els.raceListCount.textContent = String(ordered.length);

      if (!ordered.length) {
        els.raceList.innerHTML = `<p class="empty-hint">Keine gespeicherten Rennen gefunden.</p>`;
        return;
      }

      els.raceList.innerHTML = ordered
        .map((race) => {
          const meta = [
            statusLabel(race.status),
            `${race.participantCount} Teilnehmer`,
            race.status === "finished"
              ? `${race.finishedCount} im Ziel`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return `
            <article class="race-card">
              <div>
                <h3>${escapeHtml(race.name)}</h3>
                <p>${escapeHtml(meta)}</p>
              </div>
              <div class="race-card-actions">
                <button type="button" class="btn btn-primary" data-open-race="${escapeHtml(race.id)}">
                  Öffnen
                </button>
                ${
                  race.status === "finished"
                    ? `<button type="button" class="btn btn-ghost" data-copy-result="${escapeHtml(race.id)}">Link</button>`
                    : ""
                }
              </div>
            </article>`;
        })
        .join("");
    } catch (error) {
      els.raceList.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    }
  }

  async function openRace(id) {
    const race = await api(`/api/races/${id}`);
    setHash(`#/race/${id}`);
    applyRace(race);
  }

  async function createRace() {
    const name = els.raceNameInput.value.trim();
    if (!name) {
      showHomeError("Bitte einen Namen für das Rennen eingeben.");
      return;
    }
    showHomeError("");
    els.btnCreateRace.disabled = true;
    try {
      const race = await api("/api/races", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      els.raceNameInput.value = "";
      setHash(`#/race/${race.id}`);
      applyRace(race);
    } catch (error) {
      showHomeError(error.message);
    } finally {
      els.btnCreateRace.disabled = false;
    }
  }

  function normalizeGender(value) {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "M" || raw === "MÄNNLICH" || raw === "MAENNLICH" || raw === "MALE") {
      return "M";
    }
    if (raw === "W" || raw === "F" || raw === "WEIBLICH" || raw === "FEMALE") {
      return "W";
    }
    return raw.slice(0, 1) || "?";
  }

  function cell(row, index) {
    if (Array.isArray(row)) return row[index];
    const keys = Object.keys(row);
    return row[keys[index]];
  }

  function looksLikeHeader(row) {
    const first = String(cell(row, 0) ?? "").toLowerCase();
    return (
      first.includes("start") ||
      first.includes("nummer") ||
      first === "nr" ||
      first === "#" ||
      first === "startnummer"
    );
  }

  function parseRows(rows) {
    if (!rows.length) throw new Error("Die Datei enthält keine Daten.");

    let dataRows = rows;
    if (looksLikeHeader(rows[0])) dataRows = rows.slice(1);

    const participants = dataRows
      .map((row, index) => {
        const startNumber = String(cell(row, 0) ?? "").trim();
        const name = String(cell(row, 1) ?? "").trim();
        const gender = normalizeGender(cell(row, 2));
        const category = String(cell(row, 3) ?? "").trim();
        if (!startNumber && !name) return null;
        if (!startNumber || !name) {
          throw new Error(`Zeile ${index + 1}: Startnummer und Name sind Pflichtfelder.`);
        }
        return {
          id: `${startNumber}-${index}`,
          startNumber,
          name,
          gender,
          category: category || "—",
          status: "pending",
          finishMs: null,
        };
      })
      .filter(Boolean);

    if (!participants.length) throw new Error("Keine gültigen Teilnehmer gefunden.");

    const numbers = participants.map((p) => p.startNumber);
    if (new Set(numbers).size !== numbers.length) {
      throw new Error("Doppelte Startnummern in der Datei.");
    }

    return participants.sort((a, b) =>
      String(a.startNumber).localeCompare(String(b.startNumber), "de", { numeric: true })
    );
  }

  function parseCsvText(text) {
    const workbook = XLSX.read(text, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  }

  async function parseFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      return parseRows(parseCsvText(await file.text()));
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return parseRows(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }));
    }
    throw new Error("Bitte eine CSV- oder Excel-Datei wählen.");
  }

  function renderPreview() {
    if (!state.participants.length) {
      els.previewBlock.hidden = true;
      els.previewBody.innerHTML = "";
      return;
    }
    els.participantCount.textContent = String(state.participants.length);
    els.previewBody.innerHTML = state.participants
      .map(
        (p) => `
      <tr>
        <td>${escapeHtml(p.startNumber)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.gender)}</td>
        <td>${escapeHtml(p.category)}</td>
      </tr>`
      )
      .join("");
    els.previewBlock.hidden = false;
  }

  function updateClock() {
    if (!state.startedAt) return;
    const end = state.endedAt ?? Date.now();
    els.clockValue.textContent = formatElapsed(end - state.startedAt);
  }

  function startClock() {
    stopClock();
    updateClock();
    state.clockTimer = window.setInterval(updateClock, 100);
  }

  function stopClock() {
    if (state.clockTimer) {
      clearInterval(state.clockTimer);
      state.clockTimer = null;
    }
  }

  function counts() {
    return {
      finished: state.participants.filter((p) => p.status === "finished").length,
      remaining: state.participants.filter((p) => p.status === "pending").length,
    };
  }

  function updateStats() {
    const { finished, remaining } = counts();
    els.finishedCount.textContent = String(finished);
    els.remainingCount.textContent = String(remaining);
  }

  function renderTiles() {
    els.tiles.innerHTML = "";
    const pending = state.participants.filter((p) => p.status === "pending");
    pending.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.dataset.id = p.id;
      btn.disabled = state.phase !== "running";
      btn.innerHTML = `
        <span class="tile-number">${escapeHtml(p.startNumber)}</span>
      `;
      btn.addEventListener("click", () => markFinished(p.id));
      els.tiles.appendChild(btn);
    });
    updateStats();
  }

  function markFinished(id) {
    if (state.phase !== "running" || !state.startedAt) return;
    const participant = state.participants.find((p) => p.id === id);
    if (!participant || participant.status !== "pending") return;

    participant.status = "finished";
    participant.finishMs = Date.now() - state.startedAt;

    const tile = els.tiles.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (tile) {
      tile.classList.add("is-leaving");
      tile.disabled = true;
      window.setTimeout(() => {
        if (state.phase !== "running") return;
        renderTiles();
      }, 160);
    } else {
      renderTiles();
    }

    scheduleSave();

    if (counts().remaining === 0) {
      endRace({ confirm: false });
    } else {
      updateStats();
    }
  }

  async function endRace({ confirm }) {
    if (state.phase !== "running") return;
    if (confirm) {
      openModal();
      return;
    }

    state.endedAt = Date.now();
    stopClock();
    updateClock();
    state.participants.forEach((p) => {
      if (p.status === "pending") {
        p.status = "dns";
        p.finishMs = null;
      }
    });

    closeModal();
    state.rankingView = "overall";
    syncRankingTabs();
    renderFinished();
    setPhase("finished");
    await saveRace();
  }

  function renderFinished() {
    const finished = state.participants.filter((p) => p.status === "finished").length;
    const dns = state.participants.filter((p) => p.status === "dns").length;
    const totalTime =
      state.endedAt && state.startedAt
        ? formatElapsed(state.endedAt - state.startedAt)
        : "—";

    els.finishedTitle.textContent = state.raceName || "Rangliste";
    els.finishedSummary.textContent = `${finished} im Ziel, ${dns} nicht angetreten · Laufzeit ${totalTime}`;
    els.shareLinkInput.value = state.raceId ? shareUrl(state.raceId) : "";
    renderRanking(els.rankingContent, state.participants, state.rankingView);
  }

  function syncRankingTabs() {
    document.querySelectorAll("#view-finished .tab[data-ranking]").forEach((tab) => {
      const active = tab.dataset.ranking === state.rankingView;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function openModal() {
    els.confirmModal.hidden = false;
  }

  function closeModal() {
    els.confirmModal.hidden = true;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      els.shareLinkInput.focus();
      els.shareLinkInput.select();
      return document.execCommand("copy");
    }
  }

  async function routeFromHash() {
    const route = parseHash();
    if (route.view === "race") {
      if (state.raceId === route.id && state.phase !== "home") return;
      try {
        await openRace(route.id);
      } catch (error) {
        showHomeError(error.message);
        await loadHome();
      }
      return;
    }
    await loadHome();
  }

  els.btnCreateRace.addEventListener("click", () => {
    createRace();
  });

  els.raceNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createRace();
  });

  els.raceList.addEventListener("click", async (event) => {
    const openBtn = event.target.closest("[data-open-race]");
    if (openBtn) {
      try {
        await openRace(openBtn.dataset.openRace);
      } catch (error) {
        showHomeError(error.message);
      }
      return;
    }
    const copyBtn = event.target.closest("[data-copy-result]");
    if (copyBtn) {
      const url = shareUrl(copyBtn.dataset.copyResult);
      const ok = await copyText(url);
      showHomeError(ok ? "Ergebnis-Link kopiert." : `Bitte manuell kopieren: ${url}`);
    }
  });

  [
    "btnHomeFromSetup",
    "btnHomeFromReady",
    "btnHomeFromFinished",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", async () => {
      await saveRace();
      await loadHome();
    });
  });

  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    showImportError("");
    try {
      state.participants = await parseFile(file);
      renderPreview();
      scheduleSave();
    } catch (error) {
      state.participants = [];
      els.previewBlock.hidden = true;
      showImportError(error.message || "Import fehlgeschlagen.");
      scheduleSave();
    }
  });

  els.btnReady.addEventListener("click", () => {
    if (!state.participants.length) return;
    els.readyCount.textContent = String(state.participants.length);
    setPhase("ready");
    scheduleSave();
  });

  els.btnBackToImport.addEventListener("click", () => {
    if (els.setupTitle) els.setupTitle.textContent = state.raceName || "Teilnehmer laden";
    renderPreview();
    setPhase("setup");
    scheduleSave();
  });

  els.btnStart.addEventListener("click", () => {
    state.participants.forEach((p) => {
      p.status = "pending";
      p.finishMs = null;
    });
    state.startedAt = Date.now();
    state.endedAt = null;
    setPhase("running");
    renderTiles();
    startClock();
    scheduleSave();
  });

  els.btnEndRace.addEventListener("click", () => endRace({ confirm: true }));
  els.btnConfirmEnd.addEventListener("click", () => endRace({ confirm: false }));
  els.confirmModal.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", closeModal);
  });

  document.querySelectorAll("#view-finished .tab[data-ranking]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.rankingView = tab.dataset.ranking;
      syncRankingTabs();
      renderFinished();
    });
  });

  els.btnExport.addEventListener("click", () => {
    exportExcel(state.participants, state.raceName);
  });

  els.btnCopyShare.addEventListener("click", async () => {
    const ok = await copyText(els.shareLinkInput.value);
    els.shareNote.hidden = !ok;
    if (ok) {
      setTimeout(() => {
        els.shareNote.hidden = true;
      }, 1800);
    }
  });

  els.btnNewRace.addEventListener("click", async () => {
    await saveRace();
    await loadHome();
    els.raceNameInput.focus();
  });

  window.addEventListener("hashchange", () => {
    routeFromHash();
  });

  window.addEventListener("beforeunload", () => {
    if (!state.raceId || state.phase === "home") return;
    fetch(`/api/races/${state.raceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromState()),
      keepalive: true,
    }).catch(() => {});
  });

  routeFromHash();
})();
