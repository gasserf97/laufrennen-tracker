(() => {
  const state = {
    participants: [],
    phase: "setup", // setup | ready | running | finished
    startedAt: null,
    endedAt: null,
    clockTimer: null,
    rankingView: "overall", // overall | gender | category
  };

  const genderLabel = {
    M: "Männer",
    W: "Frauen",
  };

  const els = {
    subtitle: document.getElementById("subtitle"),
    raceClock: document.getElementById("raceClock"),
    clockValue: document.getElementById("clockValue"),
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
    tiles: document.getElementById("tiles"),
    finishedCount: document.getElementById("finishedCount"),
    remainingCount: document.getElementById("remainingCount"),
    finishedSummary: document.getElementById("finishedSummary"),
    rankingContent: document.getElementById("rankingContent"),
    confirmModal: document.getElementById("confirmModal"),
    views: {
      setup: document.getElementById("view-setup"),
      ready: document.getElementById("view-ready"),
      running: document.getElementById("view-running"),
      finished: document.getElementById("view-finished"),
    },
  };

  function setPhase(phase) {
    state.phase = phase;
    Object.entries(els.views).forEach(([key, node]) => {
      node.hidden = key !== phase;
    });

    const labels = {
      setup: "Teilnehmer importieren",
      ready: "Bereit zum Start",
      running: "Rennen läuft – tippe auf die Startnummer",
      finished: "Ergebnis & Export",
    };
    els.subtitle.textContent = labels[phase];
    els.raceClock.hidden = phase !== "running" && phase !== "finished";
  }

  function showError(message) {
    els.importError.hidden = !message;
    els.importError.textContent = message || "";
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
    if (!rows.length) {
      throw new Error("Die Datei enthält keine Daten.");
    }

    let dataRows = rows;
    if (looksLikeHeader(rows[0])) {
      dataRows = rows.slice(1);
    }

    const participants = dataRows
      .map((row, index) => {
        const startNumber = String(cell(row, 0) ?? "").trim();
        const name = String(cell(row, 1) ?? "").trim();
        const gender = normalizeGender(cell(row, 2));
        const category = String(cell(row, 3) ?? "").trim();

        if (!startNumber && !name) return null;
        if (!startNumber || !name) {
          throw new Error(
            `Zeile ${index + 1}: Startnummer und Name sind Pflichtfelder.`
          );
        }

        return {
          id: `${startNumber}-${index}`,
          startNumber,
          name,
          gender,
          category: category || "—",
          status: "pending", // pending | finished | dns
          finishMs: null,
        };
      })
      .filter(Boolean);

    if (!participants.length) {
      throw new Error("Keine gültigen Teilnehmer gefunden.");
    }

    const numbers = participants.map((p) => p.startNumber);
    const unique = new Set(numbers);
    if (unique.size !== numbers.length) {
      throw new Error("Doppelte Startnummern in der Datei.");
    }

    return participants.sort((a, b) =>
      String(a.startNumber).localeCompare(String(b.startNumber), "de", {
        numeric: true,
      })
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
      const text = await file.text();
      return parseRows(parseCsvText(text));
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      return parseRows(rows);
    }

    throw new Error("Bitte eine CSV- oder Excel-Datei wählen.");
  }

  function renderPreview() {
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatElapsed(ms) {
    if (ms == null || ms < 0) return "—";
    const totalTenths = Math.floor(ms / 100);
    const tenths = totalTenths % 10;
    const totalSeconds = Math.floor(totalTenths / 10);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
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
    const finished = state.participants.filter((p) => p.status === "finished").length;
    const remaining = state.participants.filter((p) => p.status === "pending").length;
    return { finished, remaining };
  }

  function updateStats() {
    const { finished, remaining } = counts();
    els.finishedCount.textContent = String(finished);
    els.remainingCount.textContent = String(remaining);
  }

  function renderTiles() {
    els.tiles.innerHTML = "";
    state.participants.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile" + (p.status === "finished" ? " is-finished" : "");
      btn.dataset.id = p.id;
      btn.disabled = p.status !== "pending" || state.phase !== "running";

      const meta =
        p.status === "finished"
          ? `<span class="tile-meta">${escapeHtml(formatElapsed(p.finishMs))}</span>`
          : "";

      btn.innerHTML = `
        <span class="tile-number">${escapeHtml(p.startNumber)}</span>
        ${meta}
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
      tile.classList.add("is-finished");
      tile.disabled = true;
      let meta = tile.querySelector(".tile-meta");
      if (!meta) {
        meta = document.createElement("span");
        meta.className = "tile-meta";
        tile.appendChild(meta);
      }
      meta.textContent = formatElapsed(participant.finishMs);
    }

    updateStats();

    if (counts().remaining === 0) {
      endRace({ confirm: false });
    }
  }

  function endRace({ confirm }) {
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
    renderResults();
    setPhase("finished");
  }

  function compareByTime(a, b) {
    if (a.status === "finished" && b.status !== "finished") return -1;
    if (b.status === "finished" && a.status !== "finished") return 1;
    if (a.status === "finished" && b.status === "finished") {
      return a.finishMs - b.finishMs;
    }
    return String(a.startNumber).localeCompare(String(b.startNumber), "de", {
      numeric: true,
    });
  }

  function rankList(list) {
    let place = 0;
    let finishedCount = 0;
    return [...list].sort(compareByTime).map((p) => {
      if (p.status === "finished") {
        finishedCount += 1;
        place = finishedCount;
        return { ...p, place };
      }
      return { ...p, place: null };
    });
  }

  function statusLabel(p) {
    return p.status === "finished" ? "Im Ziel" : "Nicht angetreten";
  }

  function genderTitle(code) {
    return genderLabel[code] || `Geschlecht ${code}`;
  }

  function buildOverallRows() {
    return rankList(state.participants);
  }

  function buildGroupedRows(keyFn, titleFn) {
    const groups = new Map();
    state.participants.forEach((p) => {
      const key = keyFn(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), "de", { numeric: true }))
      .map(([key, list]) => ({
        title: titleFn(key),
        rows: rankList(list),
      }));
  }

  function tableHtml(rows, { showGender = true, showCategory = true } = {}) {
    const head = `
      <thead>
        <tr>
          <th>Platz</th>
          <th>#</th>
          <th>Name</th>
          ${showGender ? "<th>G</th>" : ""}
          ${showCategory ? "<th>Kat.</th>" : ""}
          <th>Status</th>
          <th>Zeit</th>
        </tr>
      </thead>`;

    const body = rows
      .map((p) => {
        const place = p.place == null ? "—" : String(p.place);
        const status =
          p.status === "finished"
            ? `<span class="status-ok">Im Ziel</span>`
            : `<span class="status-dns">Nicht angetreten</span>`;
        const time = p.status === "finished" ? formatElapsed(p.finishMs) : "—";
        return `
          <tr>
            <td class="rank-cell">${place}</td>
            <td>${escapeHtml(p.startNumber)}</td>
            <td>${escapeHtml(p.name)}</td>
            ${showGender ? `<td>${escapeHtml(p.gender)}</td>` : ""}
            ${showCategory ? `<td>${escapeHtml(p.category)}</td>` : ""}
            <td>${status}</td>
            <td>${time}</td>
          </tr>`;
      })
      .join("");

    return `<div class="table-wrap"><table>${head}<tbody>${body}</tbody></table></div>`;
  }

  function renderResults() {
    const finished = state.participants.filter((p) => p.status === "finished").length;
    const dns = state.participants.filter((p) => p.status === "dns").length;
    const totalTime =
      state.endedAt && state.startedAt
        ? formatElapsed(state.endedAt - state.startedAt)
        : "—";

    els.finishedSummary.textContent = `${finished} im Ziel, ${dns} nicht angetreten · Laufzeit ${totalTime}`;

    if (state.rankingView === "overall") {
      els.rankingContent.innerHTML = tableHtml(buildOverallRows());
      return;
    }

    if (state.rankingView === "gender") {
      const groups = buildGroupedRows((p) => p.gender, genderTitle);
      els.rankingContent.innerHTML = groups
        .map(
          (group) => `
          <div class="ranking-group">
            <h3>${escapeHtml(group.title)}</h3>
            ${tableHtml(group.rows, { showGender: false, showCategory: true })}
          </div>`
        )
        .join("");
      return;
    }

    const groups = buildGroupedRows(
      (p) => p.category,
      (key) => key
    );
    els.rankingContent.innerHTML = groups
      .map(
        (group) => `
        <div class="ranking-group">
          <h3>${escapeHtml(group.title)}</h3>
          ${tableHtml(group.rows, { showGender: true, showCategory: false })}
        </div>`
      )
      .join("");
  }

  function syncRankingTabs() {
    document.querySelectorAll(".tab[data-ranking]").forEach((tab) => {
      const active = tab.dataset.ranking === state.rankingView;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function sheetRowsFromRanked(list) {
    return list.map((p) => ({
      Platz: p.place == null ? "" : p.place,
      Startnummer: p.startNumber,
      Name: p.name,
      Geschlecht: p.gender,
      Kategorie: p.category,
      Status: statusLabel(p),
      Zeit: p.status === "finished" ? formatElapsed(p.finishMs) : "",
    }));
  }

  function safeSheetName(name) {
    return String(name)
      .replace(/[\\/?*:[\]]/g, "-")
      .slice(0, 31) || "Blatt";
  }

  function uniqueSheetName(used, base) {
    let name = safeSheetName(base);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    let i = 2;
    while (used.has(safeSheetName(`${base} ${i}`))) i += 1;
    name = safeSheetName(`${base} ${i}`);
    used.add(name);
    return name;
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();

    const overall = sheetRowsFromRanked(buildOverallRows());
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(overall),
      uniqueSheetName(usedNames, "Gesamt")
    );

    buildGroupedRows((p) => p.gender, genderTitle).forEach((group) => {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sheetRowsFromRanked(group.rows)),
        uniqueSheetName(usedNames, group.title)
      );
    });

    buildGroupedRows(
      (p) => p.category,
      (key) => `Kat ${key}`
    ).forEach((group) => {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sheetRowsFromRanked(group.rows)),
        uniqueSheetName(usedNames, group.title)
      );
    });

    const stamp = new Date();
    const fileName = `rangliste-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  function openModal() {
    els.confirmModal.hidden = false;
  }

  function closeModal() {
    els.confirmModal.hidden = true;
  }

  function resetToSetup() {
    stopClock();
    state.participants = [];
    state.startedAt = null;
    state.endedAt = null;
    state.rankingView = "overall";
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    els.previewBody.innerHTML = "";
    els.rankingContent.innerHTML = "";
    showError("");
    setPhase("setup");
  }

  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    showError("");
    try {
      state.participants = await parseFile(file);
      renderPreview();
    } catch (error) {
      state.participants = [];
      els.previewBlock.hidden = true;
      showError(error.message || "Import fehlgeschlagen.");
    }
  });

  els.btnReady.addEventListener("click", () => {
    if (!state.participants.length) return;
    els.readyCount.textContent = String(state.participants.length);
    setPhase("ready");
  });

  els.btnBackToImport.addEventListener("click", () => {
    resetToSetup();
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
  });

  els.btnEndRace.addEventListener("click", () => {
    endRace({ confirm: true });
  });

  els.btnConfirmEnd.addEventListener("click", () => {
    endRace({ confirm: false });
  });

  els.confirmModal.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", closeModal);
  });

  document.querySelectorAll(".tab[data-ranking]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.rankingView = tab.dataset.ranking;
      syncRankingTabs();
      renderResults();
    });
  });

  els.btnExport.addEventListener("click", () => {
    exportExcel();
  });

  els.btnNewRace.addEventListener("click", () => {
    resetToSetup();
  });

  setPhase("setup");
})();
