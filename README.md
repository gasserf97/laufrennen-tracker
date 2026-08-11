# Laufrennen Tracker

Mobiles Web-Tool zur Zeitstempelung bei Hobby-Laufrennen.

## Funktionen

- Rennen erstellen; **alle Rennen** sind auf der Startseite für jeden sichtbar
- Rennen-Link zum Mitmachen: `/r/<id>`
- Teilnehmer per **CSV** oder **Excel** importieren
- Zeitnahme über Startnummern-Kacheln
- Ranglisten: Gesamt, Geschlecht, Kategorie + Excel-Export
- Ergebnis-Link für Läufer: `/e/<id>` (nur Ergebnisse)
- Alte Rennen löschen

## Lokal starten

```bash
npm install
npm start
```

Öffne danach http://localhost:5173

## Speicherung

Lokal: Datei `data/races.json`.

Auf Render: persistenter Speicher über GitHub Gist (`RACES_GIST_ID` + `GITHUB_TOKEN`), damit Rennen Redeploys überleben.
