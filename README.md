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

## Lokal starten

```bash
npm install
npm start
```

## Speicherung (Laufrennen)

Lokal: `data/races.json`  
Auf Render: GitHub Gist (`RACES_GIST_ID` + `GITHUB_TOKEN`)
