# Laufrennen Tracker

Mobiles Web-Tool zur Zeitstempelung bei Hobby-Laufrennen.

## Funktionen (aktuell)

- Teilnehmer per **CSV** oder **Excel** importieren
- Spalten: Startnummer | Name | Geschlecht (M/W) | Kategorie
- Rennen starten und laufende Zeit anzeigen
- Startnummern als Kacheln – Tippen = Zieleinlauf
- Automatisches Ende, wenn alle im Ziel sind
- Manuelles Beenden mit Bestätigung (Rest = **nicht angetreten**)
- Ranglisten: **Gesamt**, nach **Geschlecht**, nach **Kategorie**
- Export als Excel (`.xlsx`) mit mehreren Blättern

## Starten

Im Projektordner einen lokalen Server starten, z. B.:

```bash
npx --yes serve .
```

Danach die angezeigte URL auf dem Handy öffnen (gleiches WLAN) oder im Browser öffnen.

## Dateiformat

Beispiel siehe `beispiel-teilnehmer.csv`.
