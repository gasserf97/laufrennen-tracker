(() => {
  const ROTATE_MS = 30000;
  const POLL_MS = 5000;

  const state = {
    tournament: null,
    screen: "courts", // courts | standings | ko
    rotateTimer: null,
    pollTimer: null,
  };

  const els = {
    subtitle: document.getElementById("displaySubtitle"),
    clock: document.getElementById("displayClock"),
    rotateHint: document.getElementById("displayRotateHint"),
    error: document.getElementById("displayError"),
    screen: document.getElementById("displayScreen"),
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function tournamentIdFromPath() {
    const match = location.pathname.match(/\/t\/([a-z0-9]+)/i);
    return match ? match[1] : null;
  }

  function teamLabel(team) {
    if (!team) return "TBD";
    if (team.player2) return `${team.player1} / ${team.player2}`;
    return team.player1;
  }

  function findTeam(tournament, id) {
    return (tournament.teams || []).find((t) => t.id === id) || null;
  }

  function calcMatchPoints(homeScore, awayScore) {
    if (homeScore == null || awayScore == null) return null;
    if (homeScore === awayScore) return null;
    const hi = Math.max(homeScore, awayScore);
    const lo = Math.min(homeScore, awayScore);
    const isSpecial = hi === 12 && lo === 11;
    if (homeScore > awayScore) {
      return isSpecial ? { homePts: 2, awayPts: 1 } : { homePts: 3, awayPts: 0 };
    }
    return isSpecial ? { homePts: 1, awayPts: 2 } : { homePts: 0, awayPts: 3 };
  }

  function isMatchComplete(match) {
    return calcMatchPoints(match.homeScore, match.awayScore) != null;
  }

  function updateClock() {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function nextMatchesByCourt(tournament) {
    const byCourt = { 1: [], 2: [] };
    (tournament.schedule || []).forEach((block) => {
      (block.slots || []).forEach((slot) => {
        (slot.matches || []).forEach((m) => {
          if (isMatchComplete(m)) return;
          const court = m.court === 2 ? 2 : 1;
          byCourt[court].push({
            ...m,
            groupName: block.group?.name || "",
            slot: slot.slot,
            home: findTeam(tournament, m.homeId),
            away: findTeam(tournament, m.awayId),
          });
        });
      });
    });
    return byCourt;
  }

  function standingsForGroup(tournament, group) {
    const stats = new Map();
    (group.teams || []).forEach((t) => {
      stats.set(t.id, {
        team: t,
        played: 0,
        won: 0,
        points: 0,
        scored: 0,
        conceded: 0,
      });
    });

    (tournament.matches || [])
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

  function renderCourts(tournament) {
    const byCourt = nextMatchesByCourt(tournament);
    const courtHtml = (court) => {
      const list = byCourt[court].slice(0, 4);
      if (!list.length) {
        return `
          <section class="display-court">
            <h2>Feld ${court}</h2>
            <p class="display-empty">Keine offenen Spiele</p>
          </section>`;
      }
      return `
        <section class="display-court">
          <h2>Feld ${court}</h2>
          <div class="display-match-stack">
            ${list
              .map(
                (m, index) => `
              <article class="display-match ${index === 0 ? "is-next" : ""}">
                <span class="display-match-tag">${
                  index === 0 ? "Jetzt / als Nächstes" : `Danach · Runde ${m.slot}`
                }${m.groupName ? ` · ${escapeHtml(m.groupName)}` : ""}</span>
                <p class="display-side">${escapeHtml(teamLabel(m.home))}</p>
                <p class="display-vs">vs</p>
                <p class="display-side">${escapeHtml(teamLabel(m.away))}</p>
              </article>`
              )
              .join("")}
          </div>
        </section>`;
    };

    els.subtitle.textContent = "Nächste Spiele";
    els.rotateHint.textContent = "Wechselt in 30s zu den Tabellen";
    els.screen.innerHTML = `
      <div class="display-courts">
        ${courtHtml(1)}
        ${courtHtml(2)}
      </div>`;
  }

  function renderStandings(tournament) {
    const groups = tournament.groups || [];
    els.subtitle.textContent = "Aktuelle Gruppen";
    els.rotateHint.textContent = "Wechselt in 30s zu den nächsten Spielen";
    els.screen.innerHTML = `
      <div class="display-standings">
        ${groups
          .map((group) => {
            const rows = standingsForGroup(tournament, group);
            return `
              <section class="display-table-card">
                <h2>${escapeHtml(group.name)}</h2>
                <table class="display-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mannschaft</th>
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
                          <td>${i + 1}</td>
                          <td>${escapeHtml(teamLabel(row.team))}</td>
                          <td class="rank-cell">${row.points}</td>
                          <td>${diffLabel}</td>
                        </tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>
              </section>`;
          })
          .join("")}
      </div>`;
  }

  function renderKo(tournament) {
    const rounds = tournament.koRounds || [];
    els.subtitle.textContent = "K.O.-Phase";
    els.rotateHint.textContent = "Nur K.O.-Baum";
    els.screen.innerHTML = `
      <div class="display-ko">
        ${rounds
          .map(
            (round) => `
          <section class="display-ko-round">
            <h2>${escapeHtml(round.name)}</h2>
            <div class="display-ko-matches">
              ${(round.slots || [])
                .flatMap((slot) => slot.matches || [])
                .map((m) => {
                  const ready = m.home && m.away;
                  const score =
                    ready && m.homeScore != null && m.awayScore != null
                      ? `${m.homeScore}:${m.awayScore}`
                      : "– : –";
                  return `
                    <article class="display-match">
                      <span class="display-match-tag">Feld ${m.court || "–"}</span>
                      <p class="display-side">${escapeHtml(teamLabel(m.home))}</p>
                      <p class="display-score">${escapeHtml(score)}</p>
                      <p class="display-side">${escapeHtml(teamLabel(m.away))}</p>
                    </article>`;
                })
                .join("")}
            </div>
          </section>`
          )
          .join("")}
      </div>`;
  }

  function inKoPhase(tournament) {
    return (
      tournament.phase === "ko" &&
      Array.isArray(tournament.koRounds) &&
      tournament.koRounds.length > 0
    );
  }

  function render() {
    const tournament = state.tournament;
    if (!tournament) return;

    if (inKoPhase(tournament)) {
      state.screen = "ko";
      renderKo(tournament);
      return;
    }

    if (state.screen === "standings") renderStandings(tournament);
    else renderCourts(tournament);
  }

  function startRotation() {
    clearInterval(state.rotateTimer);
    state.rotateTimer = window.setInterval(() => {
      if (!state.tournament || inKoPhase(state.tournament)) {
        render();
        return;
      }
      state.screen = state.screen === "courts" ? "standings" : "courts";
      render();
    }, ROTATE_MS);
  }

  async function loadTournament() {
    const id = tournamentIdFromPath();
    if (!id) {
      els.error.hidden = false;
      els.error.textContent = "Ungültiger Anzeige-Link.";
      return;
    }

    try {
      const res = await fetch(`/api/tournaments/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Turnier nicht gefunden.");
      state.tournament = data;
      els.error.hidden = true;
      if (inKoPhase(data)) state.screen = "ko";
      else if (state.screen === "ko") state.screen = "courts";
      render();
    } catch (error) {
      els.error.hidden = false;
      els.error.textContent = error.message;
    }
  }

  updateClock();
  window.setInterval(updateClock, 1000);
  loadTournament();
  startRotation();
  state.pollTimer = window.setInterval(loadTournament, POLL_MS);
})();
