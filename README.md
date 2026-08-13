# Sport Tracker

Mobiles Web-Tool für **Laufrennen** und **Tennis-Turniere**.

## Start

- Portal: `/`
- Laufrennen: `/laufen`
- Tennis: `/tennis`

## Laufrennen

- Rennen erstellen, Zeitnahme, Ranglisten, Ergebnis-Links
- Lauflisten lokal speichern

## Tennis (aktuell)

- Einzel- oder Doppelturnier
- Excel/CSV-Import (Doppel: Spalte 1 + 2 = Mannschaft)
- Gruppenanzahl wählen
- Spielplan: jeder gegen jeden, max. 2 Felder gleichzeitig
- Ergebnis pro Spiel (0–13): Sieger 3 Punkte; bei **13:11** Sieger 2 / Verlierer 1
- Nach allen Gruppenspielen: K.O. mit 8 / 16 / 32
- Öffentliche Anzeige `/t/<id>`: nächste Spiele ↔ Tabellen (30s), in der K.O. nur Baum
- Turniere bleiben serverseitig gespeichert und können jederzeit fortgesetzt oder gelöscht werden

## Lokal starten

```bash
npm install
npm start
```

## Speicherung (Laufrennen)

Lokal: `data/races.json`  
Auf Render: GitHub Gist (`RACES_GIST_ID` + `GITHUB_TOKEN`)
