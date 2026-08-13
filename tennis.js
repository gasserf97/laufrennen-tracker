(() => {
  const COURTS = 2;

  const state = {
    mode: null, // singles | doubles
    teams: [],
    groupCount: 2,
    groups: [],
    schedule: [],
  };

  const els = {
    subtitle: document.getElementById("subtitle"),
    btnSingles: document.getElementById("btnSingles"),
    btnDoubles: document.getElementById("btnDoubles"),
    btnBackMode: document.getElementById("btnBackMode"),
    btnBackImport: document.getElementById("btnBackImport"),
    btnBackGroups: document.getElementById("btnBackGroups"),
    btnToGroups: document.getElementById("btnToGroups"),
    btnBuildSchedule: document.getElementById("btnBuildSchedule"),
    btnNewTennis: document.getElementById("btnNewTennis"),
    importTitle: document.getElementById("importTitle"),
    importHint: document.getElementById("importHint"),
    sampleLink: document.getElementById("sampleLink"),
    fileInput: document.getElementById("tennisFileInput"),
    importError: document.getElementById("tennisImportError"),
    previewBlock: document.getElementById("tennisPreviewBlock"),
    previewHead: document.getElementById("previewHead"),
    previewBody: document.getElementById("tennisPreviewBody"),
    teamCount: document.getElementById("teamCount"),
    groupsTeamCount: document.getElementById("groupsTeamCount"),
    groupCountInput: document.getElementById("groupCountInput"),
    groupError: document.getElementById("groupError"),
    groupPreview: document.getElementById("groupPreview"),
    scheduleSummary: document.getElementById("scheduleSummary"),
    scheduleContent: document.getElementById("scheduleContent"),
    views: {
      mode: document.getElementById("view-mode"),
      import: document.getElementById("view-import"),
      groups: document.getElementById("view-groups"),
      schedule: document.getElementById("view-schedule"),
    },
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setView(name) {
    Object.entries(els.views).forEach(([key, node]) => {
      node.hidden = key !== name;
    });
    const labels = {
      mode: "Turnierart wählen",
      import: state.mode === "doubles" ? "Doppel · Teilnehmer" : "Einzel · Teilnehmer",
      groups: "Gruppen einteilen",
      schedule: "Spielplan",
    };
    els.subtitle.textContent = labels[name] || "";
  }

  function showImportError(message) {
    els.importError.hidden = !message;
    els.importError.textContent = message || "";
  }

  function showGroupError(message) {
    els.groupError.hidden = !message;
    els.groupError.textContent = message || "";
  }

  function teamLabel(team) {
    if (team.player2) return `${team.player1} / ${team.player2}`;
    return team.player1;
  }

  function cell(row, index) {
    if (Array.isArray(row)) return row[index];
    const keys = Object.keys(row);
    return row[keys[index]];
  }

  function looksLikeHeader(row) {
    const a = String(cell(row, 0) ?? "").toLowerCase();
    const b = String(cell(row, 1) ?? "").toLowerCase();
    return (
      a.includes("spieler") ||
      a.includes("name") ||
      a.includes("start") ||
      a.includes("team") ||
      b.includes("spieler") ||
      b.includes("name") ||
      b.includes("partner")
    );
  }

  function parseSingles(rows) {
    let data = rows;
    if (looksLikeHeader(rows[0])) data = rows.slice(1);

    const teams = [];
    data.forEach((row, index) => {
      const col0 = String(cell(row, 0) ?? "").trim();
      const col1 = String(cell(row, 1) ?? "").trim();
      // Prefer name in col1 if col0 looks like a start number
      let name = col0;
      if (/^\d+$/.test(col0) && col1) name = col1;
      if (!name) return;
      teams.push({
        id: `t${index + 1}`,
        player1: name,
        player2: null,
      });
    });
    if (teams.length < 2) throw new Error("Mindestens 2 Spieler nötig.");
    return teams;
  }

  function parseDoubles(rows) {
    let data = rows;
    if (looksLikeHeader(rows[0])) data = rows.slice(1);

    const teams = [];
    data.forEach((row, index) => {
      const p1 = String(cell(row, 0) ?? "").trim();
      const p2 = String(cell(row, 1) ?? "").trim();
      if (!p1 && !p2) return;
      if (!p1 || !p2) {
        throw new Error(
          `Zeile ${index + 1}: Bei Doppel müssen Spalte 1 und 2 gefüllt sein.`
        );
      }
      teams.push({
        id: `t${index + 1}`,
        player1: p1,
        player2: p2,
      });
    });
    if (teams.length < 2) throw new Error("Mindestens 2 Mannschaften nötig.");
    return teams;
  }

  async function parseFile(file) {
    const name = file.name.toLowerCase();
    let rows;
    if (name.endsWith(".csv")) {
      const workbook = XLSX.read(await file.text(), { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    } else {
      throw new Error("Bitte eine CSV- oder Excel-Datei wählen.");
    }
    if (!rows.length) throw new Error("Die Datei enthält keine Daten.");
    return state.mode === "doubles" ? parseDoubles(rows) : parseSingles(rows);
  }

  function renderPreview() {
    const doubles = state.mode === "doubles";
    els.previewHead.innerHTML = doubles
      ? "<th>#</th><th>Spieler 1</th><th>Spieler 2</th>"
      : "<th>#</th><th>Name</th>";
    els.previewBody.innerHTML = state.teams
      .map(
        (t, i) =>
          doubles
            ? `<tr><td>${i + 1}</td><td>${escapeHtml(t.player1)}</td><td>${escapeHtml(t.player2)}</td></tr>`
            : `<tr><td>${i + 1}</td><td>${escapeHtml(t.player1)}</td></tr>`
      )
      .join("");
    els.teamCount.textContent = String(state.teams.length);
    els.previewBlock.hidden = false;
  }

  function setupMode(mode) {
    state.mode = mode;
    state.teams = [];
    state.groups = [];
    state.schedule = [];
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    showImportError("");

    if (mode === "doubles") {
      els.importTitle.textContent = "Doppel · Mannschaften laden";
      els.importHint.textContent =
        "Excel/CSV: Spalte 1 = Spieler 1, Spalte 2 = Spieler 2 (eine Mannschaft).";
      els.sampleLink.href = "/beispiel-tennis-doppel.csv";
    } else {
      els.importTitle.textContent = "Einzel · Spieler laden";
      els.importHint.textContent =
        "Excel/CSV: Name in Spalte 1 (oder Startnummer + Name).";
      els.sampleLink.href = "/beispiel-tennis-einzel.csv";
    }
    setView("import");
  }

  function splitIntoGroups(teams, groupCount) {
    const n = teams.length;
    if (groupCount < 1) throw new Error("Mindestens 1 Gruppe.");
    if (groupCount > n) {
      throw new Error("Nicht mehr Gruppen als Mannschaften möglich.");
    }
    const shuffled = [...teams];
    // Deterministic shuffle by id so re-renders stay stable unless count changes
    shuffled.sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const groups = Array.from({ length: groupCount }, (_, i) => ({
      id: i + 1,
      name: `Gruppe ${String.fromCharCode(65 + i)}`,
      teams: [],
    }));

    shuffled.forEach((team, index) => {
      groups[index % groupCount].teams.push(team);
    });

    if (groups.some((g) => g.teams.length < 2)) {
      throw new Error(
        "Jede Gruppe braucht mindestens 2 Mannschaften. Weniger Gruppen wählen."
      );
    }
    return groups;
  }

  function renderGroupPreview() {
    const raw = Number(els.groupCountInput.value);
    showGroupError("");
    try {
      if (!Number.isInteger(raw) || raw < 1) {
        throw new Error("Bitte eine ganze Zahl ≥ 1 eingeben.");
      }
      state.groupCount = raw;
      state.groups = splitIntoGroups(state.teams, raw);
      els.groupPreview.innerHTML = state.groups
        .map(
          (g) => `
          <article class="group-card">
            <h3>${escapeHtml(g.name)} <span class="badge">${g.teams.length}</span></h3>
            <ul>
              ${g.teams
                .map((t) => `<li>${escapeHtml(teamLabel(t))}</li>`)
                .join("")}
            </ul>
          </article>`
        )
        .join("");
    } catch (error) {
      state.groups = [];
      els.groupPreview.innerHTML = "";
      showGroupError(error.message);
    }
  }

  /** Circle method: rounds of matches for n teams (bye if odd). */
  function roundRobinRounds(teams) {
    const list = [...teams];
    if (list.length % 2 === 1) list.push(null); // bye
    const n = list.length;
    const rounds = n - 1;
    const half = n / 2;
    const arr = [...list];
    const result = [];

    for (let r = 0; r < rounds; r += 1) {
      const matches = [];
      for (let i = 0; i < half; i += 1) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a && b) {
          matches.push({ home: a, away: b });
        }
      }
      result.push(matches);
      // rotate: keep first fixed
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr.splice(0, arr.length, fixed, ...rest);
    }
    return result;
  }

  /** Split matches into slots of max COURTS concurrent matches. */
  function assignCourts(rounds) {
    const slots = [];
    let slotNo = 1;
    rounds.forEach((matches) => {
      for (let i = 0; i < matches.length; i += COURTS) {
        const chunk = matches.slice(i, i + COURTS);
        slots.push({
          slot: slotNo,
          matches: chunk.map((m, idx) => ({
            court: idx + 1,
            home: m.home,
            away: m.away,
          })),
        });
        slotNo += 1;
      }
    });
    return slots;
  }

  function buildSchedule() {
    if (!state.groups.length) {
      renderGroupPreview();
      if (!state.groups.length) return;
    }

    state.schedule = state.groups.map((group) => ({
      group,
      slots: assignCourts(roundRobinRounds(group.teams)),
    }));

    const totalMatches = state.schedule.reduce(
      (sum, g) => sum + g.slots.reduce((s, slot) => s + slot.matches.length, 0),
      0
    );
    const totalSlots = Math.max(
      ...state.schedule.map((g) => g.slots.length),
      0
    );

    els.scheduleSummary.textContent = `${state.groups.length} Gruppen · ${totalMatches} Spiele · bis zu ${COURTS} Felder gleichzeitig · ${totalSlots} Zeitslots (max. über alle Gruppen)`;

    els.scheduleContent.innerHTML = state.schedule
      .map((block) => {
        const slotsHtml = block.slots
          .map(
            (slot) => `
            <div class="schedule-slot">
              <h4>Runde ${slot.slot}</h4>
              <div class="court-grid">
                ${slot.matches
                  .map(
                    (m) => `
                  <article class="match-card">
                    <span class="court-label">Feld ${m.court}</span>
                    <p class="match-side">${escapeHtml(teamLabel(m.home))}</p>
                    <p class="match-vs">vs</p>
                    <p class="match-side">${escapeHtml(teamLabel(m.away))}</p>
                  </article>`
                  )
                  .join("")}
              </div>
            </div>`
          )
          .join("");

        return `
          <section class="result-section">
            <header class="result-section-head">
              <h3 class="result-section-title">${escapeHtml(block.group.name)}</h3>
              <p class="result-section-meta">${block.group.teams.length} Mannschaften · ${block.slots.reduce((s, x) => s + x.matches.length, 0)} Spiele</p>
            </header>
            <div class="result-section-body schedule-body">
              ${slotsHtml}
            </div>
          </section>`;
      })
      .join("");

    setView("schedule");
  }

  function resetAll() {
    state.mode = null;
    state.teams = [];
    state.groupCount = 2;
    state.groups = [];
    state.schedule = [];
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    els.groupCountInput.value = "2";
    showImportError("");
    showGroupError("");
    setView("mode");
  }

  els.btnSingles.addEventListener("click", () => setupMode("singles"));
  els.btnDoubles.addEventListener("click", () => setupMode("doubles"));
  els.btnBackMode.addEventListener("click", resetAll);
  els.btnBackImport.addEventListener("click", () => {
    setView("import");
  });
  els.btnBackGroups.addEventListener("click", () => {
    setView("groups");
    renderGroupPreview();
  });
  els.btnNewTennis.addEventListener("click", resetAll);

  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    showImportError("");
    try {
      state.teams = await parseFile(file);
      renderPreview();
    } catch (error) {
      state.teams = [];
      els.previewBlock.hidden = true;
      showImportError(error.message || "Import fehlgeschlagen.");
    }
  });

  els.btnToGroups.addEventListener("click", () => {
    if (!state.teams.length) return;
    els.groupsTeamCount.textContent = String(state.teams.length);
    const maxGroups = Math.floor(state.teams.length / 2);
    const suggested = Math.min(2, maxGroups) || 1;
    els.groupCountInput.value = String(suggested);
    els.groupCountInput.max = String(maxGroups);
    setView("groups");
    renderGroupPreview();
  });

  els.groupCountInput.addEventListener("input", () => {
    renderGroupPreview();
  });

  els.btnBuildSchedule.addEventListener("click", () => {
    buildSchedule();
  });

  setView("mode");
})();
