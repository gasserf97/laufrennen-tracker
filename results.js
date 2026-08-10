(() => {
  const { formatElapsed, renderRanking, exportExcel } = window.RaceRanking;

  const state = {
    race: null,
    rankingView: "overall",
  };

  const els = {
    subtitle: document.getElementById("subtitle"),
    raceTitle: document.getElementById("raceTitle"),
    summary: document.getElementById("summary"),
    loadError: document.getElementById("loadError"),
    pendingBox: document.getElementById("pendingBox"),
    resultsBox: document.getElementById("resultsBox"),
    rankingContent: document.getElementById("rankingContent"),
    btnExport: document.getElementById("btnExport"),
  };

  function raceIdFromPath() {
    const match = location.pathname.match(/\/e\/([a-z0-9]+)/i);
    return match ? match[1] : null;
  }

  function syncTabs() {
    document.querySelectorAll(".tab[data-ranking]").forEach((tab) => {
      const active = tab.dataset.ranking === state.rankingView;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function render() {
    const race = state.race;
    if (!race) return;

    document.title = `${race.name} · Ergebnisse`;
    els.raceTitle.textContent = race.name;
    els.subtitle.textContent = race.status === "finished" ? "Öffentliche Rangliste" : "Noch nicht beendet";

    if (race.status !== "finished") {
      els.pendingBox.hidden = false;
      els.resultsBox.hidden = true;
      els.summary.textContent = "Nur Ergebnisse werden hier angezeigt – Timing ist für Läufer nicht sichtbar.";
      return;
    }

    const finished = race.participants.filter((p) => p.status === "finished").length;
    const dns = race.participants.filter((p) => p.status === "dns").length;
    const totalTime =
      race.endedAt && race.startedAt
        ? formatElapsed(race.endedAt - race.startedAt)
        : "—";

    els.summary.textContent = `${finished} im Ziel, ${dns} nicht angetreten · Laufzeit ${totalTime}`;
    els.pendingBox.hidden = true;
    els.resultsBox.hidden = false;
    renderRanking(els.rankingContent, race.participants, state.rankingView);
  }

  async function load() {
    const id = raceIdFromPath();
    if (!id) {
      els.loadError.hidden = false;
      els.loadError.textContent = "Ungültiger Ergebnis-Link.";
      return;
    }

    try {
      const res = await fetch(`/api/races/${id}/public`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rennen nicht gefunden.");
      state.race = data;
      els.loadError.hidden = true;
      render();
    } catch (error) {
      els.loadError.hidden = false;
      els.loadError.textContent = error.message;
      els.pendingBox.hidden = true;
      els.resultsBox.hidden = true;
    }
  }

  document.querySelectorAll(".tab[data-ranking]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.rankingView = tab.dataset.ranking;
      syncTabs();
      render();
    });
  });

  els.btnExport.addEventListener("click", () => {
    if (!state.race || state.race.status !== "finished") return;
    exportExcel(state.race.participants, state.race.name);
  });

  syncTabs();
  load();
})();
