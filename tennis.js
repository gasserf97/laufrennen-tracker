(() => {
  const COURTS = 2;
  const SCORE_MAX = 13;

  const state = {
    tournamentId: null,
    tournamentName: "",
    phase: "setup", // setup | groups | ko
    mode: null,
    teams: [],
    groupCount: 2,
    groups: [],
    schedule: [],
    matches: [],
    koSize: 8,
    koRounds: [],
    saveTimer: null,
    deleteTournamentId: null,
  };

  const els = {
    subtitle: document.getElementById("subtitle"),
    btnSingles: document.getElementById("btnSingles"),
    btnDoubles: document.getElementById("btnDoubles"),
    tournamentNameInput: document.getElementById("tournamentNameInput"),
    modeError: document.getElementById("modeError"),
    tournamentList: document.getElementById("tournamentList"),
    tournamentListCount: document.getElementById("tournamentListCount"),
    deleteTournamentModal: document.getElementById("deleteTournamentModal"),
    deleteTournamentText: document.getElementById("deleteTournamentText"),
    btnConfirmDeleteTournament: document.getElementById("btnConfirmDeleteTournament"),
    btnBackMode: document.getElementById("btnBackMode"),
    btnBackImport: document.getElementById("btnBackImport"),
    btnBackGroups: document.getElementById("btnBackGroups"),
    btnBackSchedule: document.getElementById("btnBackSchedule"),
    btnToGroups: document.getElementById("btnToGroups"),
    btnBuildSchedule: document.getElementById("btnBuildSchedule"),
    btnBuildKo: document.getElementById("btnBuildKo"),
    btnNewTennis: document.getElementById("btnNewTennis"),
    btnNewTennisFromKo: document.getElementById("btnNewTennisFromKo"),
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
    standingsContent: document.getElementById("standingsContent"),
    koSetupBox: document.getElementById("koSetupBox"),
    koSetupHint: document.getElementById("koSetupHint"),
    koSizeSelect: document.getElementById("koSizeSelect"),
    koError: document.getElementById("koError"),
    koSummary: document.getElementById("koSummary"),
    koContent: document.getElementById("koContent"),
    displayShareBox: document.getElementById("displayShareBox"),
    displayLinkInput: document.getElementById("displayLinkInput"),
    btnCopyDisplay: document.getElementById("btnCopyDisplay"),
    displayShareNote: document.getElementById("displayShareNote"),
    displayShareBoxKo: document.getElementById("displayShareBoxKo"),
    displayLinkInputKo: document.getElementById("displayLinkInputKo"),
    btnCopyDisplayKo: document.getElementById("btnCopyDisplayKo"),
    displayShareNoteKo: document.getElementById("displayShareNoteKo"),
    views: {
      mode: document.getElementById("view-mode"),
      import: document.getElementById("view-import"),
      groups: document.getElementById("view-groups"),
      schedule: document.getElementById("view-schedule"),
      ko: document.getElementById("view-ko"),
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
      schedule: "Gruppenspiele",
      ko: "K.O.-Phase",
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

  function showModeError(message) {
    if (!els.modeError) return;
    els.modeError.hidden = !message;
    els.modeError.textContent = message || "";
  }

  function showKoError(message) {
    els.koError.hidden = !message;
    els.koError.textContent = message || "";
  }

  function displayUrl() {
    if (!state.tournamentId) return "";
    return `${location.origin}/t/${state.tournamentId}`;
  }

  function fillDisplayLinks() {
    const url = displayUrl();
    if (els.displayLinkInput) els.displayLinkInput.value = url;
    if (els.displayLinkInputKo) els.displayLinkInputKo.value = url;
    if (els.displayShareBox) els.displayShareBox.hidden = !url;
    if (els.displayShareBoxKo) els.displayShareBoxKo.hidden = !url;
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

  function payloadFromState() {
    return {
      name: state.tournamentName || "Tennis-Turnier",
      phase: state.phase === "ko" ? "ko" : "groups",
      mode: state.mode,
      teams: state.teams,
      groupCount: state.groupCount,
      groups: state.groups,
      schedule: state.schedule,
      matches: state.matches,
      koSize: state.koSize,
      koRounds: state.koRounds,
    };
  }

  function phaseLabel(phase, mode) {
    const modeLabel = mode === "doubles" ? "Doppel" : "Einzel";
    if (phase === "ko") return `${modeLabel} · K.O.`;
    if (phase === "groups") return `${modeLabel} · Gruppenphase`;
    return modeLabel;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function loadTournamentList() {
    if (!els.tournamentList) return;
    els.tournamentList.innerHTML = `<p class="empty-hint">Lade Turniere…</p>`;
    try {
      const res = await fetch("/api/tournaments");
      const list = await res.json().catch(() => []);
      if (!res.ok) throw new Error(list.error || "Turniere laden fehlgeschlagen.");
      if (els.tournamentListCount) {
        els.tournamentListCount.textContent = String(list.length);
      }
      if (!list.length) {
        els.tournamentList.innerHTML =
          `<p class="empty-hint">Noch keine Turniere gespeichert.</p>`;
        return;
      }
      els.tournamentList.innerHTML = list
        .map((t) => {
          const meta = [
            phaseLabel(t.phase, t.mode),
            `${t.teamCount} Teilnehmer`,
            t.matchCount
              ? `${t.doneMatches || 0}/${t.matchCount} Spiele`
              : null,
            formatDate(t.updatedAt),
          ]
            .filter(Boolean)
            .join(" · ");
          return `
            <article class="race-card">
              <div>
                <h3>${escapeHtml(t.name || "Tennis-Turnier")}</h3>
                <p>${escapeHtml(meta)}</p>
              </div>
              <div class="race-card-actions">
                <button type="button" class="btn btn-primary" data-open-tournament="${escapeHtml(t.id)}">
                  Fortsetzen
                </button>
                <button type="button" class="btn btn-ghost" data-copy-display="${escapeHtml(t.id)}">
                  Anzeige
                </button>
                <button type="button" class="btn btn-danger-soft" data-delete-tournament="${escapeHtml(t.id)}" data-delete-tournament-name="${escapeHtml(t.name || "Turnier")}">
                  Löschen
                </button>
              </div>
            </article>`;
        })
        .join("");
    } catch (error) {
      els.tournamentList.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    }
  }

  function goTournamentUrl(id) {
    const hash = `#/tournament/${id}`;
    if (location.hash !== hash) {
      history.replaceState({}, "", `${location.pathname}${hash}`);
    }
  }

  function clearTournamentUrl() {
    if (location.hash) history.replaceState({}, "", location.pathname);
  }

  function applyTournament(tournament) {
    state.tournamentId = tournament.id;
    state.tournamentName = tournament.name || "Tennis-Turnier";
    state.mode = tournament.mode || "singles";
    state.phase = tournament.phase === "ko" ? "ko" : "groups";
    state.teams = Array.isArray(tournament.teams) ? tournament.teams : [];
    state.groupCount = tournament.groupCount || 1;
    state.groups = Array.isArray(tournament.groups) ? tournament.groups : [];
    state.schedule = Array.isArray(tournament.schedule) ? tournament.schedule : [];
    state.matches = Array.isArray(tournament.matches) ? tournament.matches : [];
    state.koSize = tournament.koSize || 8;
    state.koRounds = Array.isArray(tournament.koRounds) ? tournament.koRounds : [];
    fillDisplayLinks();
    goTournamentUrl(tournament.id);

    if (state.phase === "ko" && state.koRounds.length) {
      renderKo();
      setView("ko");
      return;
    }
    if (state.schedule.length && state.matches.length) {
      renderSchedule();
      setView("schedule");
      return;
    }
    if (state.teams.length) {
      renderPreview();
      setView("import");
      return;
    }
    setView("import");
  }

  async function openTournament(id) {
    const res = await fetch(`/api/tournaments/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Turnier nicht gefunden.");
    applyTournament(data);
  }

  function openDeleteTournamentModal(id, name) {
    state.deleteTournamentId = id;
    els.deleteTournamentText.textContent = `„${name}" und alle Ergebnisse werden unwiderruflich gelöscht.`;
    els.deleteTournamentModal.hidden = false;
  }

  function closeDeleteTournamentModal() {
    state.deleteTournamentId = null;
    els.deleteTournamentModal.hidden = true;
  }

  async function deleteTournament(id) {
    const res = await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
    if (state.tournamentId === id) {
      state.tournamentId = null;
      clearTournamentUrl();
    }
    closeDeleteTournamentModal();
    await goHome();
  }

  async function goHome() {
    state.tournamentId = null;
    state.tournamentName = "";
    state.phase = "setup";
    state.mode = null;
    state.teams = [];
    state.groups = [];
    state.schedule = [];
    state.matches = [];
    state.koRounds = [];
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    els.groupCountInput.value = "2";
    els.koSetupBox.hidden = true;
    fillDisplayLinks();
    showImportError("");
    showGroupError("");
    showKoError("");
    showModeError("");
    clearTournamentUrl();
    setView("mode");
    await loadTournamentList();
  }

  async function ensureTournamentSaved() {
    const body = payloadFromState();
    if (!state.tournamentId) {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Turnier speichern fehlgeschlagen.");
      state.tournamentId = data.id;
      fillDisplayLinks();
      return data;
    }

    const res = await fetch(`/api/tournaments/${state.tournamentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Turnier speichern fehlgeschlagen.");
    fillDisplayLinks();
    return data;
  }

  function schedulePersist() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      ensureTournamentSaved().catch((error) => {
        console.error(error);
      });
    }, 400);
  }

  function teamLabel(team) {
    if (!team) return "TBD";
    if (team.player2) return `${team.player1} / ${team.player2}`;
    return team.player1;
  }

  function scoreOptions(selected) {
    let html = `<option value="">–</option>`;
    for (let i = 0; i <= SCORE_MAX; i += 1) {
      html += `<option value="${i}" ${String(selected) === String(i) ? "selected" : ""}>${i}</option>`;
    }
    return html;
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
      let name = col0;
      if (/^\d+$/.test(col0) && col1) name = col1;
      if (!name) return;
      teams.push({ id: `t${index + 1}`, player1: name, player2: null });
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
      teams.push({ id: `t${index + 1}`, player1: p1, player2: p2 });
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
      .map((t, i) =>
        doubles
          ? `<tr><td>${i + 1}</td><td>${escapeHtml(t.player1)}</td><td>${escapeHtml(t.player2)}</td></tr>`
          : `<tr><td>${i + 1}</td><td>${escapeHtml(t.player1)}</td></tr>`
      )
      .join("");
    els.teamCount.textContent = String(state.teams.length);
    els.previewBlock.hidden = false;
  }

  function setupMode(mode) {
    const name = (els.tournamentNameInput?.value || "").trim();
    if (!name) {
      showModeError("Bitte einen Namen für das Turnier eingeben.");
      els.tournamentNameInput?.focus();
      return;
    }
    showModeError("");
    state.mode = mode;
    state.tournamentId = null;
    state.tournamentName = name;
    state.phase = "setup";
    state.teams = [];
    state.groups = [];
    state.schedule = [];
    state.matches = [];
    state.koRounds = [];
    els.fileInput.value = "";
    els.previewBlock.hidden = true;
    fillDisplayLinks();
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
    if (groupCount > n) throw new Error("Nicht mehr Gruppen als Mannschaften möglich.");
    const shuffled = [...teams].sort((a, b) => String(a.id).localeCompare(String(b.id)));
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
              ${g.teams.map((t) => `<li>${escapeHtml(teamLabel(t))}</li>`).join("")}
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

  function roundRobinRounds(teams) {
    const list = [...teams];
    if (list.length % 2 === 1) list.push(null);
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
        if (a && b) matches.push({ home: a, away: b });
      }
      result.push(matches);
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr.splice(0, arr.length, fixed, ...rest);
    }
    return result;
  }

  function assignCourts(rounds, groupId) {
    const slots = [];
    let slotNo = 1;
    let matchIndex = 0;
    rounds.forEach((matches) => {
      for (let i = 0; i < matches.length; i += COURTS) {
        const chunk = matches.slice(i, i + COURTS);
        slots.push({
          slot: slotNo,
          matches: chunk.map((m, idx) => {
            matchIndex += 1;
            return {
              id: `g${groupId}-m${matchIndex}`,
              groupId,
              court: idx + 1,
              homeId: m.home.id,
              awayId: m.away.id,
              homeScore: null,
              awayScore: null,
            };
          }),
        });
        slotNo += 1;
      }
    });
    return slots;
  }

  function findTeam(id) {
    return state.teams.find((t) => t.id === id) || null;
  }

  function getMatch(id) {
    return state.matches.find((m) => m.id === id) || null;
  }

  /** Returns { homePts, awayPts } or null if incomplete/invalid. */
  function calcMatchPoints(homeScore, awayScore) {
    if (homeScore == null || awayScore == null) return null;
    if (homeScore === awayScore) return null;
    const hi = Math.max(homeScore, awayScore);
    const lo = Math.min(homeScore, awayScore);
    const isSpecial = hi === 13 && lo === 11;
    if (homeScore > awayScore) {
      return isSpecial ? { homePts: 2, awayPts: 1 } : { homePts: 3, awayPts: 0 };
    }
    return isSpecial ? { homePts: 1, awayPts: 2 } : { homePts: 0, awayPts: 3 };
  }

  function isMatchComplete(match) {
    return calcMatchPoints(match.homeScore, match.awayScore) != null;
  }

  function allGroupMatchesDone() {
    return state.matches.length > 0 && state.matches.every(isMatchComplete);
  }

  function standingsForGroup(group) {
    const stats = new Map();
    group.teams.forEach((t) => {
      stats.set(t.id, {
        team: t,
        played: 0,
        won: 0,
        points: 0,
        scored: 0,
        conceded: 0,
      });
    });

    state.matches
      .filter((m) => m.groupId === group.id)
      .forEach((m) => {
        const pts = calcMatchPoints(m.homeScore, m.awayScore);
        if (!pts) return;
        const home = stats.get(m.homeId);
        const away = stats.get(m.awayId);
        if (!home || !away) return;
        home.played += 1;
        away.played += 1;
        home.scored += m.homeScore;
        home.conceded += m.awayScore;
        away.scored += m.awayScore;
        away.conceded += m.homeScore;
        home.points += pts.homePts;
        away.points += pts.awayPts;
        if (pts.homePts > pts.awayPts) home.won += 1;
        else away.won += 1;
      });

    return [...stats.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.scored - a.conceded;
      const diffB = b.scored - b.conceded;
      if (diffB !== diffA) return diffB - diffA;
      if (b.scored !== a.scored) return b.scored - a.scored;
      return String(a.team.player1).localeCompare(String(b.team.player1), "de");
    });
  }

  function overallStandings() {
    const byId = new Map();
    state.groups.forEach((group) => {
      standingsForGroup(group).forEach((row) => {
        byId.set(row.team.id, row);
      });
    });
    return [...byId.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.scored - a.conceded;
      const diffB = b.scored - b.conceded;
      if (diffB !== diffA) return diffB - diffA;
      if (b.scored !== a.scored) return b.scored - a.scored;
      return String(a.team.player1).localeCompare(String(b.team.player1), "de");
    });
  }

  function renderStandings() {
    els.standingsContent.innerHTML = state.groups
      .map((group) => {
        const rows = standingsForGroup(group);
        return `
          <section class="result-section">
            <header class="result-section-head">
              <h3 class="result-section-title">${escapeHtml(group.name)} · Tabelle</h3>
            </header>
            <div class="result-section-body">
              <div class="table-wrap table-wrap-compact">
                <table>
                  <thead>
                    <tr>
                      <th>Platz</th>
                      <th>Mannschaft</th>
                      <th>Sp</th>
                      <th>S</th>
                      <th>Pkt</th>
                      <th>+/−</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map((row, i) => {
                        const diff = row.scored - row.conceded;
                        const diffLabel = diff > 0 ? `+${diff}` : String(diff);
                        return `<tr>
                          <td class="rank-cell">${i + 1}</td>
                          <td>${escapeHtml(teamLabel(row.team))}</td>
                          <td>${row.played}</td>
                          <td>${row.won}</td>
                          <td class="rank-cell">${row.points}</td>
                          <td>${diffLabel}</td>
                        </tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </section>`;
      })
      .join("");
  }

  function renderSchedule() {
    const done = state.matches.filter(isMatchComplete).length;
    const total = state.matches.length;
    els.scheduleSummary.textContent = `${state.groups.length} Gruppen · ${done}/${total} Spiele mit Ergebnis · max. ${COURTS} Felder gleichzeitig`;

    els.scheduleContent.innerHTML = state.schedule
      .map((block) => {
        const slotsHtml = block.slots
          .map(
            (slot) => `
            <div class="schedule-slot">
              <h4>Runde ${slot.slot}</h4>
              <div class="court-grid">
                ${slot.matches
                  .map((m) => {
                    const home = findTeam(m.homeId);
                    const away = findTeam(m.awayId);
                    const pts = calcMatchPoints(m.homeScore, m.awayScore);
                    const ptsLabel = pts
                      ? ` · ${pts.homePts}:${pts.awayPts} Pkt`
                      : "";
                    return `
                  <article class="match-card" data-match-id="${escapeHtml(m.id)}">
                    <span class="court-label">Feld ${m.court}${ptsLabel}</span>
                    <p class="match-side">${escapeHtml(teamLabel(home))}</p>
                    <div class="score-row">
                      <select class="score-select" data-match="${escapeHtml(m.id)}" data-side="home" aria-label="Punkte Heim">
                        ${scoreOptions(m.homeScore)}
                      </select>
                      <span class="score-sep">:</span>
                      <select class="score-select" data-match="${escapeHtml(m.id)}" data-side="away" aria-label="Punkte Gast">
                        ${scoreOptions(m.awayScore)}
                      </select>
                    </div>
                    <p class="match-side">${escapeHtml(teamLabel(away))}</p>
                  </article>`;
                  })
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

    renderStandings();
    updateKoSetup();
    fillDisplayLinks();
  }

  function updateKoSetup() {
    if (!allGroupMatchesDone()) {
      els.koSetupBox.hidden = true;
      return;
    }
    const available = state.teams.length;
    els.koSetupBox.hidden = false;
    els.koSetupHint.textContent = `Alle Gruppenspiele sind fertig (${available} Mannschaften). Wie viele kommen in die K.O.-Phase?`;
    [...els.koSizeSelect.options].forEach((opt) => {
      const n = Number(opt.value);
      opt.disabled = n > available;
      if (opt.disabled) opt.textContent = `${n} (zu wenig Teilnehmer)`;
      else opt.textContent = String(n);
    });
    const firstOk = [...els.koSizeSelect.options].find((o) => !o.disabled);
    if (firstOk) els.koSizeSelect.value = firstOk.value;
  }

  async function buildSchedule() {
    if (!state.groups.length) {
      renderGroupPreview();
      if (!state.groups.length) return;
    }

    state.phase = "groups";
    state.schedule = state.groups.map((group) => ({
      group,
      slots: assignCourts(roundRobinRounds(group.teams), group.id),
    }));
    state.matches = state.schedule.flatMap((block) =>
      block.slots.flatMap((slot) => slot.matches)
    );
    state.koRounds = [];
    showKoError("");
    renderSchedule();
    setView("schedule");
    try {
      await ensureTournamentSaved();
    } catch (error) {
      showGroupError(error.message);
    }
  }

  function onScoreChange(matchId, side, value) {
    const match = getMatch(matchId);
    if (!match) return;
    const num = value === "" ? null : Number(value);
    if (side === "home") match.homeScore = num;
    else match.awayScore = num;

    state.schedule.forEach((block) => {
      block.slots.forEach((slot) => {
        slot.matches.forEach((m) => {
          if (m.id === matchId) {
            m.homeScore = match.homeScore;
            m.awayScore = match.awayScore;
          }
        });
      });
    });

    renderSchedule();
    schedulePersist();
  }

  function koRoundName(size) {
    if (size === 2) return "Finale";
    if (size === 4) return "Halbfinale";
    if (size === 8) return "Viertelfinale";
    if (size === 16) return "Achtelfinale";
    if (size === 32) return "Runde der letzten 32";
    return `K.O. ${size}`;
  }

  function seedPairings(teams) {
    // Classic: 1 vs N, 2 vs N-1, ...
    const n = teams.length;
    const pairs = [];
    for (let i = 0; i < n / 2; i += 1) {
      pairs.push({ home: teams[i], away: teams[n - 1 - i] });
    }
    return pairs;
  }

  function buildKoBracket() {
    showKoError("");
    const size = Number(els.koSizeSelect.value);
    if (![8, 16, 32].includes(size)) {
      showKoError("Bitte 8, 16 oder 32 wählen.");
      return;
    }
    if (size > state.teams.length) {
      showKoError(`Nur ${state.teams.length} Mannschaften vorhanden.`);
      return;
    }
    if (!allGroupMatchesDone()) {
      showKoError("Zuerst alle Gruppenspiele ausfüllen.");
      return;
    }

    state.koSize = size;
    const qualified = overallStandings()
      .slice(0, size)
      .map((row) => row.team);

    const rounds = [];
    let current = seedPairings(qualified);
    let roundSize = size;
    let matchCounter = 0;

    while (current.length) {
      const slots = [];
      let slotNo = 1;
      for (let i = 0; i < current.length; i += COURTS) {
        const chunk = current.slice(i, i + COURTS);
        slots.push({
          slot: slotNo,
          matches: chunk.map((pair, idx) => {
            matchCounter += 1;
            return {
              id: `ko-m${matchCounter}`,
              court: idx + 1,
              home: pair.home,
              away: pair.away,
              homeScore: null,
              awayScore: null,
              winnerId: null,
            };
          }),
        });
        slotNo += 1;
      }

      rounds.push({
        name: koRoundName(roundSize),
        size: roundSize,
        slots,
      });

      // Placeholder next round until results exist
      roundSize = roundSize / 2;
      if (roundSize < 2) break;
      current = Array.from({ length: roundSize }, () => ({
        home: null,
        away: null,
      }));
    }

    state.koRounds = rounds;
    state.phase = "ko";
    renderKo();
    setView("ko");
    ensureTournamentSaved().catch((error) => showKoError(error.message));
  }

  function getKoMatch(id) {
    for (const round of state.koRounds) {
      for (const slot of round.slots) {
        for (const m of slot.matches) {
          if (m.id === id) return m;
        }
      }
    }
    return null;
  }

  function koMatchWinner(match) {
    const pts = calcMatchPoints(match.homeScore, match.awayScore);
    if (!pts || !match.home || !match.away) return null;
    return pts.homePts > pts.awayPts ? match.home : match.away;
  }

  function propagateKoWinners() {
    for (let r = 0; r < state.koRounds.length - 1; r += 1) {
      const round = state.koRounds[r];
      const next = state.koRounds[r + 1];
      const winners = [];
      round.slots.forEach((slot) => {
        slot.matches.forEach((m) => {
          const w = koMatchWinner(m);
          m.winnerId = w ? w.id : null;
          winners.push(w);
        });
      });

      let wi = 0;
      next.slots.forEach((slot) => {
        slot.matches.forEach((m) => {
          m.home = winners[wi] || null;
          m.away = winners[wi + 1] || null;
          if (!m.home || !m.away) {
            m.homeScore = null;
            m.awayScore = null;
            m.winnerId = null;
          }
          wi += 2;
        });
      });
    }
  }

  function renderKo() {
    propagateKoWinners();
    els.koSummary.textContent = `Top ${state.koSize} nach Gruppentabelle · Ergebnisse wie in der Gruppenphase`;
    fillDisplayLinks();

    els.koContent.innerHTML = state.koRounds
      .map((round) => {
        const slotsHtml = round.slots
          .map(
            (slot) => `
            <div class="schedule-slot">
              <h4>Runde ${slot.slot}</h4>
              <div class="court-grid">
                ${slot.matches
                  .map((m) => {
                    const ready = m.home && m.away;
                    const pts = ready
                      ? calcMatchPoints(m.homeScore, m.awayScore)
                      : null;
                    const ptsLabel = pts
                      ? ` · ${pts.homePts}:${pts.awayPts} Pkt`
                      : "";
                    return `
                  <article class="match-card">
                    <span class="court-label">Feld ${m.court}${ptsLabel}</span>
                    <p class="match-side">${escapeHtml(teamLabel(m.home))}</p>
                    ${
                      ready
                        ? `<div class="score-row">
                            <select class="score-select" data-ko-match="${escapeHtml(m.id)}" data-side="home">
                              ${scoreOptions(m.homeScore)}
                            </select>
                            <span class="score-sep">:</span>
                            <select class="score-select" data-ko-match="${escapeHtml(m.id)}" data-side="away">
                              ${scoreOptions(m.awayScore)}
                            </select>
                          </div>`
                        : `<p class="match-vs">wartet auf Ergebnis</p>`
                    }
                    <p class="match-side">${escapeHtml(teamLabel(m.away))}</p>
                  </article>`;
                  })
                  .join("")}
              </div>
            </div>`
          )
          .join("");

        return `
          <section class="result-section">
            <header class="result-section-head">
              <h3 class="result-section-title">${escapeHtml(round.name)}</h3>
              <p class="result-section-meta">${round.size} Mannschaften</p>
            </header>
            <div class="result-section-body schedule-body">
              ${slotsHtml}
            </div>
          </section>`;
      })
      .join("");
  }

  function onKoScoreChange(matchId, side, value) {
    const match = getKoMatch(matchId);
    if (!match || !match.home || !match.away) return;
    const num = value === "" ? null : Number(value);
    if (side === "home") match.homeScore = num;
    else match.awayScore = num;
    renderKo();
    schedulePersist();
  }

  function resetAll() {
    goHome();
  }

  els.btnSingles.addEventListener("click", () => setupMode("singles"));
  els.btnDoubles.addEventListener("click", () => setupMode("doubles"));
  els.tournamentNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") setupMode("singles");
  });
  els.btnBackMode.addEventListener("click", () => goHome());
  els.btnBackImport.addEventListener("click", () => setView("import"));
  els.btnBackGroups.addEventListener("click", () => {
    setView("groups");
    renderGroupPreview();
  });
  els.btnBackSchedule.addEventListener("click", () => {
    setView("schedule");
    renderSchedule();
  });
  els.btnNewTennis.addEventListener("click", () => goHome());
  els.btnNewTennisFromKo.addEventListener("click", () => goHome());

  els.tournamentList?.addEventListener("click", async (event) => {
    const openBtn = event.target.closest("[data-open-tournament]");
    if (openBtn) {
      try {
        showModeError("");
        await openTournament(openBtn.dataset.openTournament);
      } catch (error) {
        showModeError(error.message);
      }
      return;
    }

    const copyBtn = event.target.closest("[data-copy-display]");
    if (copyBtn) {
      const url = `${location.origin}/t/${copyBtn.dataset.copyDisplay}`;
      const ok = await copyText(url);
      showModeError(ok ? "Anzeige-Link kopiert." : `Link: ${url}`);
      return;
    }

    const deleteBtn = event.target.closest("[data-delete-tournament]");
    if (deleteBtn) {
      openDeleteTournamentModal(
        deleteBtn.dataset.deleteTournament,
        deleteBtn.dataset.deleteTournamentName || "Turnier"
      );
    }
  });

  els.btnConfirmDeleteTournament?.addEventListener("click", async () => {
    if (!state.deleteTournamentId) return;
    try {
      await deleteTournament(state.deleteTournamentId);
    } catch (error) {
      closeDeleteTournamentModal();
      showModeError(error.message);
    }
  });

  els.deleteTournamentModal
    ?.querySelectorAll("[data-close-delete-tournament]")
    .forEach((node) => {
      node.addEventListener("click", closeDeleteTournamentModal);
    });

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

  els.groupCountInput.addEventListener("input", () => renderGroupPreview());
  els.btnBuildSchedule.addEventListener("click", () => {
    buildSchedule();
  });
  els.btnBuildKo.addEventListener("click", () => buildKoBracket());

  async function flashCopied(noteEl) {
    if (!noteEl) return;
    noteEl.hidden = false;
    window.setTimeout(() => {
      noteEl.hidden = true;
    }, 1800);
  }

  els.btnCopyDisplay?.addEventListener("click", async () => {
    const ok = await copyText(els.displayLinkInput.value);
    if (ok) flashCopied(els.displayShareNote);
  });

  els.btnCopyDisplayKo?.addEventListener("click", async () => {
    const ok = await copyText(els.displayLinkInputKo.value);
    if (ok) flashCopied(els.displayShareNoteKo);
  });

  els.scheduleContent.addEventListener("change", (event) => {
    const select = event.target.closest(".score-select[data-match]");
    if (!select) return;
    onScoreChange(select.dataset.match, select.dataset.side, select.value);
  });

  els.koContent.addEventListener("change", (event) => {
    const select = event.target.closest(".score-select[data-ko-match]");
    if (!select) return;
    onKoScoreChange(select.dataset.koMatch, select.dataset.side, select.value);
  });

  async function bootFromHash() {
    const match = location.hash.match(/^#\/tournament\/([a-z0-9]+)/i);
    if (match) {
      if (state.tournamentId === match[1] && (state.phase === "groups" || state.phase === "ko")) {
        return;
      }
      try {
        await openTournament(match[1]);
        return;
      } catch (error) {
        showModeError(error.message);
      }
    }
    await goHome();
  }

  window.addEventListener("hashchange", () => {
    bootFromHash();
  });

  bootFromHash();
})();
