window.RaceRanking = (() => {
  const genderLabel = {
    M: "Männer",
    W: "Frauen",
  };

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

  function buildOverallRows(participants) {
    return rankList(participants);
  }

  function buildGroupedRows(participants, keyFn, titleFn) {
    const groups = new Map();
    participants.forEach((p) => {
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

  function renderRanking(container, participants, rankingView) {
    if (rankingView === "overall") {
      container.innerHTML = tableHtml(buildOverallRows(participants));
      return;
    }

    if (rankingView === "gender") {
      const groups = buildGroupedRows(participants, (p) => p.gender, genderTitle);
      container.innerHTML = groups
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

    const groups = buildGroupedRows(participants, (p) => p.category, (key) => key);
    container.innerHTML = groups
      .map(
        (group) => `
        <div class="ranking-group">
          <h3>${escapeHtml(group.title)}</h3>
          ${tableHtml(group.rows, { showGender: true, showCategory: false })}
        </div>`
      )
      .join("");
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

  function exportExcel(participants, raceName) {
    if (typeof XLSX === "undefined") {
      throw new Error("Excel-Bibliothek nicht geladen.");
    }

    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sheetRowsFromRanked(buildOverallRows(participants))),
      uniqueSheetName(usedNames, "Gesamt")
    );

    buildGroupedRows(participants, (p) => p.gender, genderTitle).forEach((group) => {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sheetRowsFromRanked(group.rows)),
        uniqueSheetName(usedNames, group.title)
      );
    });

    buildGroupedRows(participants, (p) => p.category, (key) => `Kat ${key}`).forEach(
      (group) => {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(sheetRowsFromRanked(group.rows)),
          uniqueSheetName(usedNames, group.title)
        );
      }
    );

    const stamp = new Date();
    const safe = String(raceName || "rangliste")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const fileName = `${safe || "rangliste"}-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  return {
    escapeHtml,
    formatElapsed,
    renderRanking,
    exportExcel,
  };
})();
