(() => {
  const { escapeHtml, formatElapsed, renderRanking, exportExcel } = window.RaceRanking;
  const OWN_RACES_KEY = "laufrennen.ownRaceIds";
  const SAVED_LISTS_KEY = "laufrennen.savedLists";

  const state = {
    raceId: null,
    raceName: "",
    participants: [],
    phase: "home", // home | setup | ready | running | finished
    startedAt: null,
    endedAt: null,
    clockTimer: null,
    rankingView: "category",
    saveTimer: null,
    saving: false,
    deleteRaceId: null,
    deleteListId: null,
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
    btnCopyRaceLink: document.getElementById("btnCopyRaceLink"),
    btnCopySetupRaceLink: document.getElementById("btnCopySetupRaceLink"),
    raceLinkInput: document.getElementById("raceLinkInput"),
    setupRaceLinkInput: document.getElementById("setupRaceLinkInput"),
    setupShareNote: document.getElementById("setupShareNote"),
    shareLinkInput: document.getElementById("shareLinkInput"),
    shareNote: document.getElementById("shareNote"),
    finishedTitle: document.getElementById("finishedTitle"),
    tiles: document.getElementById("tiles"),
    finishedCount: document.getElementById("finishedCount"),
    remainingCount: document.getElementById("remainingCount"),
    finishedSummary: document.getElementById("finishedSummary"),
    rankingContent: document.getElementById("rankingContent"),
    confirmModal: document.getElementById("confirmModal"),
    deleteModal: document.getElementById("deleteModal"),
    deleteModalText: document.getElementById("deleteModalText"),
    btnConfirmDelete: document.getElementById("btnConfirmDelete"),
    savedListHome: document.getElementById("savedListHome"),
    savedListSetup: document.getElementById("savedListSetup"),
    savedListCount: document.getElementById("savedListCount"),
    btnSaveList: document.getElementById("btnSaveList"),
    saveListModal: document.getElementById("saveListModal"),
    saveListNameInput: document.getElementById("saveListNameInput"),
    saveListError: document.getElementById("saveListError"),
    btnConfirmSaveList: document.getElementById("btnConfirmSaveList"),
    deleteListModal: document.getElementById("deleteListModal"),
    deleteListModalText: document.getElementById("deleteListModalText"),
    btnConfirmDeleteList: document.getElementById("btnConfirmDeleteList"),
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

  function forgetRaceId(id) {
    const ids = getOwnRaceIds().filter((x) => x !== id);
    localStorage.setItem(OWN_RACES_KEY, JSON.stringify(ids));
  }

  function rememberRaceId(id) {
    const ids = getOwnRaceIds().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(OWN_RACES_KEY, JSON.stringify(ids.slice(0, 100)));
  }

  function getSavedLists() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_LISTS_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function writeSavedLists(lists) {
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists));
  }

  function newListId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function participantToTemplate(p) {
    return {
      startNumber: p.startNumber,
      name: p.name,
      gender: p.gender,
      category: p.category,
    };
  }

  function participantsFromTemplate(templates) {
    return templates.map((p, index) => ({
      id: `${p.startNumber}-${index}`,
      startNumber: p.startNumber,
      name: p.name,
      gender: p.gender,
      category: p.category,
      status: "pending",
      finishMs: null,
    }));
  }

  function formatListDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function renderSavedListCards(container, mode) {
    const lists = getSavedLists();
    if (els.savedListCount) els.savedListCount.textContent = String(lists.length);

    if (!lists.length) {
      container.innerHTML =
        mode === "home"
          ? `<p class="empty-hint">Noch keine Laufliste gespeichert.</p>`
          : `<p class="empty-hint">Noch keine Laufliste auf diesem Gerät.</p>`;
      return;
    }

    container.innerHTML = lists
      .map((list) => {
        const count = list.participants?.length ?? 0;
        const updated = formatListDate(list.updatedAt || list.createdAt);
        const primaryAction =
          mode === "home"
            ? `<button type="button" class="btn btn-primary" data-use-list="${escapeHtml(list.id)}">Neues Rennen</button>`
            : `<button type="button" class="btn btn-primary" data-load-list="${escapeHtml(list.id)}">Laden</button>`;
        return `
          <article class="race-card">
            <div>
              <h3>${escapeHtml(list.name)}</h3>
              <p>${escapeHtml(`${count} Teilnehmer${updated ? ` · ${updated}` : ""}`)}</p>
            </div>
            <div class="race-card-actions">
              ${primaryAction}
              <button type="button" class="btn btn-danger-soft" data-delete-list="${escapeHtml(list.id)}" data-delete-list-name="${escapeHtml(list.name)}">
                Löschen
              </button>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderSavedLists() {
    if (els.savedListHome) renderSavedListCards(els.savedListHome, "home");
    if (els.savedListSetup) renderSavedListCards(els.savedListSetup, "setup");
  }

  function openSaveListModal() {
    if (!state.participants.length) {
      showImportError("Zuerst Teilnehmer importieren oder laden.");
      return;
    }
    els.saveListError.hidden = true;
    els.saveListNameInput.value = state.raceName || "";
    els.saveListModal.hidden = false;
    els.saveListNameInput.focus();
  }

  function closeSaveListModal() {
    els.saveListModal.hidden = true;
    els.saveListError.hidden = true;
  }

  function saveCurrentList(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("Bitte einen Namen für die Liste eingeben.");
    if (!state.participants.length) throw new Error("Keine Teilnehmer zum Speichern.");

    const lists = getSavedLists();
    const templates = state.participants.map(participantToTemplate);
    const now = new Date().toISOString();
    const existing = lists.find((l) => l.name === trimmed);

    if (existing) {
      existing.participants = templates;
      existing.updatedAt = now;
    } else {
      lists.unshift({
        id: newListId(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        participants: templates,
      });
    }

    writeSavedLists(lists.slice(0, 50));
    renderSavedLists();
  }

  function getSavedListById(id) {
    return getSavedLists().find((l) => l.id === id) || null;
  }

  function loadSavedListInSetup(list) {
    if (!list?.participants?.length) {
      throw new Error("Die Laufliste ist leer.");
    }
    state.participants = participantsFromTemplate(list.participants);
    renderPreview();
    showImportError("");
    scheduleSave();
  }

  async function createRaceFromList(list) {
    if (!list?.participants?.length) {
      throw new Error("Die Laufliste ist leer.");
    }
    showHomeError("");
    els.btnCreateRace.disabled = true;
    try {
      const race = await api("/api/races", {
        method: "POST",
        body: JSON.stringify({ name: list.name }),
      });
      const participants = participantsFromTemplate(list.participants);
      await api(`/api/races/${race.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: race.name,
          status: "setup",
          participants,
          startedAt: null,
          endedAt: null,
        }),
      });
      goRaceUrl(race.id);
      applyRace({
        ...race,
        participants,
        status: "setup",
        startedAt: null,
        endedAt: null,
      });
    } finally {
      els.btnCreateRace.disabled = false;
    }
  }

  function openDeleteListModal(id, name) {
    state.deleteListId = id;
    els.deleteListModalText.textContent = `„${name}" wird von diesem Gerät gelöscht.`;
    els.deleteListModal.hidden = false;
  }

  function closeDeleteListModal() {
    state.deleteListId = null;
    els.deleteListModal.hidden = true;
  }

  function deleteSavedList(id) {
    writeSavedLists(getSavedLists().filter((l) => l.id !== id));
    closeDeleteListModal();
    renderSavedLists();
  }

  function handleSavedListClick(event, mode) {
    const useBtn = event.target.closest("[data-use-list]");
    if (useBtn && mode === "home") {
      const list = getSavedListById(useBtn.dataset.useList);
      if (!list) {
        showHomeError("Laufliste nicht gefunden.");
        renderSavedLists();
        return;
      }
      createRaceFromList(list).catch((error) => showHomeError(error.message));
      return;
    }

    const loadBtn = event.target.closest("[data-load-list]");
    if (loadBtn && mode === "setup") {
      try {
        const list = getSavedListById(loadBtn.dataset.loadList);
        if (!list) throw new Error("Laufliste nicht gefunden.");
        loadSavedListInSetup(list);
      } catch (error) {
        showImportError(error.message);
        renderSavedLists();
      }
      return;
    }

    const deleteBtn = event.target.closest("[data-delete-list]");
    if (deleteBtn) {
      openDeleteListModal(
        deleteBtn.dataset.deleteList,
        deleteBtn.dataset.deleteListName || "Laufliste"
      );
    }
  }

  function goHomeUrl() {
    if (location.pathname !== "/" || location.search || location.hash) {
      history.pushState({}, "", "/");
    }
  }

  function goRaceUrl(id) {
    const path = `/r/${id}`;
    if (location.pathname !== path || location.hash) {
      history.pushState({}, "", path);
    }
  }

  function parseRoute() {
    const pathMatch = location.pathname.match(/^\/r\/([a-z0-9]+)/i);
    if (pathMatch) return { view: "race", id: pathMatch[1] };
    const raw = location.hash.replace(/^#/, "");
    const raceMatch = raw.match(/^\/race\/([a-z0-9]+)$/i);
    if (raceMatch) return { view: "race", id: raceMatch[1] };
    return { view: "home" };
  }

  function raceUrl(id) {
    return `${location.origin}/r/${id}`;
  }

  function resultsUrl(id) {
    return `${location.origin}/e/${id}`;
  }

  function fillRaceLinks() {
    const race = state.raceId ? raceUrl(state.raceId) : "";
    const results = state.raceId ? resultsUrl(state.raceId) : "";
    if (els.setupRaceLinkInput) els.setupRaceLinkInput.value = race;
    if (els.raceLinkInput) els.raceLinkInput.value = race;
    if (els.shareLinkInput) els.shareLinkInput.value = results;
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
      home: "Alle Rennen",
      setup: state.raceName || "Teilnehmer importieren",
      ready: state.raceName || "Bereit zum Start",
      running: state.raceName || "Rennen läuft",
      finished: state.raceName || "Ergebnis & Export",
    };
    els.subtitle.textContent = labels[phase];
    els.raceClock.hidden = phase !== "running" && phase !== "finished";
    if (phase === "setup" || phase === "finished") fillRaceLinks();
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
      renderSavedLists();
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
      state.rankingView = "category";
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
    state.rankingView = "category";
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    els.previewBody.innerHTML = "";
    els.rankingContent.innerHTML = "";
    showImportError("");
    showHomeError("");
    setPhase("home");
    goHomeUrl();
    renderSavedLists();

    els.raceList.innerHTML = `<p class="empty-hint">Lade Rennen…</p>`;
    try {
      const races = await api("/api/races");
      els.raceListCount.textContent = String(races.length);

      if (!races.length) {
        els.raceList.innerHTML = `<p class="empty-hint">Noch keine Rennen vorhanden.</p>`;
        return;
      }

      els.raceList.innerHTML = races
        .map((race) => {
          const meta = [
            statusLabel(race.status),
            `${race.participantCount} Teilnehmer`,
            race.status === "finished" ? `${race.finishedCount} im Ziel` : null,
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
                <button type="button" class="btn btn-ghost" data-copy-race="${escapeHtml(race.id)}">
                  Link
                </button>
                ${
                  race.status === "finished"
                    ? `<button type="button" class="btn btn-ghost" data-copy-result="${escapeHtml(race.id)}">Ergebnis</button>`
                    : ""
                }
                <button type="button" class="btn btn-danger-soft" data-delete-race="${escapeHtml(race.id)}" data-delete-name="${escapeHtml(race.name)}">
                  Löschen
                </button>
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
    goRaceUrl(id);
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
      goRaceUrl(race.id);
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

  function normalizeHeader(value) {
    return String(value ?? "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isIndexHeader(value) {
    const h = normalizeHeader(value);
    return (
      h === "nr" ||
      h === "#" ||
      h === "pos" ||
      h === "position" ||
      h === "index" ||
      h.includes("lfd") ||
      h.includes("laufende") ||
      h === "id"
    );
  }

  function buildColumnMap(headerRow) {
    const headers = headerRow.map(normalizeHeader);
    const findIndex = (patterns, fallback) => {
      const idx = headers.findIndex((h) => patterns.some((p) => h.includes(p)));
      return idx >= 0 ? idx : fallback;
    };

    let startOffset = 0;
    if (headers.length > 4 && isIndexHeader(headerRow[0])) {
      startOffset = 1;
    }

    const startNumber = findIndex(
      ["startnummer", "startnr", "start-nr", "bib", "start nr"],
      startOffset
    );
    let name = findIndex(
      ["name", "nachname", "laeufer", "teilnehmer", "runner"],
      startOffset + 1
    );
    let gender = findIndex(["geschlecht", "gender", "sex", "m/w", "mw"], startOffset + 2);
    let category = findIndex(
      ["kategorie", "category", "klasse", "altersklasse", "ak", "class"],
      startOffset + 3
    );

    const used = new Set([startNumber, name, gender, category]);
    if (category === startOffset + 3 && headers.length > startOffset + 4) {
      for (let i = headers.length - 1; i >= startOffset; i -= 1) {
        if (!used.has(i) && headers[i]) {
          category = i;
          break;
        }
      }
    }

    return { startNumber, name, gender, category };
  }

  function cell(row, index) {
    if (Array.isArray(row)) return row[index];
    const keys = Object.keys(row);
    return row[keys[index]];
  }

  function valueAt(row, index) {
    if (index == null || index < 0) return "";
    return cell(row, index);
  }

  function looksLikeHeader(row) {
    const first = normalizeHeader(cell(row, 0));
    return (
      first.includes("start") ||
      first.includes("nummer") ||
      first === "nr" ||
      first === "#" ||
      first.includes("name") ||
      first.includes("kategorie") ||
      first.includes("geschlecht") ||
      isIndexHeader(cell(row, 0))
    );
  }

  function parseRows(rows) {
    if (!rows.length) throw new Error("Die Datei enthält keine Daten.");

    let dataRows = rows;
    let columns = { startNumber: 0, name: 1, gender: 2, category: 3 };

    if (looksLikeHeader(rows[0])) {
      columns = buildColumnMap(rows[0]);
      dataRows = rows.slice(1);
    } else if (rows[0]?.length > 4) {
      const first = String(cell(rows[0], 0) ?? "").trim();
      const second = String(cell(rows[0], 1) ?? "").trim();
      if (/^\d+$/.test(first) && /^\d+$/.test(second) && Number(first) <= Number(second)) {
        columns = { startNumber: 1, name: 2, gender: 3, category: 4 };
      }
    }

    const participants = dataRows
      .map((row, index) => {
        const startNumber = String(valueAt(row, columns.startNumber) ?? "").trim();
        const name = String(valueAt(row, columns.name) ?? "").trim();
        const gender = normalizeGender(valueAt(row, columns.gender));
        const category = String(valueAt(row, columns.category) ?? "").trim();
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
    state.rankingView = "category";
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
    fillRaceLinks();
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
      const probe = document.createElement("textarea");
      probe.value = text;
      document.body.appendChild(probe);
      probe.select();
      const ok = document.execCommand("copy");
      probe.remove();
      return ok;
    }
  }

  function openDeleteModal(id, name) {
    state.deleteRaceId = id;
    els.deleteModalText.textContent = `„${name}" und alle Ergebnisse werden unwiderruflich gelöscht.`;
    els.deleteModal.hidden = false;
  }

  function closeDeleteModal() {
    state.deleteRaceId = null;
    els.deleteModal.hidden = true;
  }

  async function deleteRace(id) {
    await api(`/api/races/${id}`, { method: "DELETE" });
    forgetRaceId(id);
    if (state.raceId === id) {
      state.raceId = null;
    }
    closeDeleteModal();
    await loadHome();
  }

  async function flashCopied(noteEl) {
    if (!noteEl) return;
    noteEl.hidden = false;
    window.setTimeout(() => {
      noteEl.hidden = true;
    }, 1800);
  }

  async function routeFromLocation() {
    const route = parseRoute();
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

    const copyRaceBtn = event.target.closest("[data-copy-race]");
    if (copyRaceBtn) {
      const url = raceUrl(copyRaceBtn.dataset.copyRace);
      const ok = await copyText(url);
      showHomeError(ok ? "Rennen-Link kopiert." : `Bitte manuell kopieren: ${url}`);
      return;
    }

    const copyBtn = event.target.closest("[data-copy-result]");
    if (copyBtn) {
      const url = resultsUrl(copyBtn.dataset.copyResult);
      const ok = await copyText(url);
      showHomeError(ok ? "Ergebnis-Link kopiert." : `Bitte manuell kopieren: ${url}`);
      return;
    }

    const deleteBtn = event.target.closest("[data-delete-race]");
    if (deleteBtn) {
      openDeleteModal(deleteBtn.dataset.deleteRace, deleteBtn.dataset.deleteName || "Rennen");
    }
  });

  els.savedListHome?.addEventListener("click", (event) => {
    handleSavedListClick(event, "home");
  });

  els.savedListSetup?.addEventListener("click", (event) => {
    handleSavedListClick(event, "setup");
  });

  els.btnSaveList?.addEventListener("click", () => {
    openSaveListModal();
  });

  els.btnConfirmSaveList?.addEventListener("click", () => {
    try {
      saveCurrentList(els.saveListNameInput.value);
      closeSaveListModal();
      showImportError("");
    } catch (error) {
      els.saveListError.hidden = false;
      els.saveListError.textContent = error.message;
    }
  });

  els.saveListNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") els.btnConfirmSaveList?.click();
  });

  els.saveListModal?.querySelectorAll("[data-close-save-list]").forEach((node) => {
    node.addEventListener("click", closeSaveListModal);
  });

  els.btnConfirmDeleteList?.addEventListener("click", () => {
    if (!state.deleteListId) return;
    deleteSavedList(state.deleteListId);
  });

  els.deleteListModal?.querySelectorAll("[data-close-delete-list]").forEach((node) => {
    node.addEventListener("click", closeDeleteListModal);
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
    if (ok) flashCopied(els.shareNote);
  });

  els.btnCopyRaceLink?.addEventListener("click", async () => {
    const ok = await copyText(els.raceLinkInput.value);
    if (ok) flashCopied(els.shareNote);
  });

  els.btnCopySetupRaceLink?.addEventListener("click", async () => {
    const ok = await copyText(els.setupRaceLinkInput.value);
    if (ok) flashCopied(els.setupShareNote);
  });

  els.btnConfirmDelete.addEventListener("click", async () => {
    if (!state.deleteRaceId) return;
    try {
      await deleteRace(state.deleteRaceId);
    } catch (error) {
      closeDeleteModal();
      showHomeError(error.message);
    }
  });

  els.deleteModal.querySelectorAll("[data-close-delete]").forEach((node) => {
    node.addEventListener("click", closeDeleteModal);
  });

  els.btnNewRace.addEventListener("click", async () => {
    await saveRace();
    await loadHome();
    els.raceNameInput.focus();
  });

  window.addEventListener("popstate", () => {
    routeFromLocation();
  });

  window.addEventListener("hashchange", () => {
    routeFromLocation();
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

  routeFromLocation();
})();
