# Trainingstracker

Modulare Web-App (PWA) für Kraft- und Ausdauertraining nach trainingswissenschaftlichen Prinzipien.
Läuft im Browser und lässt sich auf iPhone, iPad und Mac wie eine App installieren. Alle Daten bleiben lokal auf dem Gerät.

## Funktionen (Version 1.0)

- **Profile mit eigenen Zielen**: Muskelaufbau, Maximalkraft, Körperkomposition, Ausdauerleistung, Hybrid, Gesundheit. Jedes Ziel setzt Startwerte, jeder Wert ist einzeln änderbar.
- **Krafttraining**: Vorlagen (Push/Pull/Beine, Ganzkörper A/B oder eigene), Sätze mit kg, Wiederholungen und RIR, Pausentimer, Progressionsvorschlag (doppelte Progression mit RIR-Steuerung), eigene Übungen.
- **Ausdauer & weitere Sportarten**: Laufen, Rad, Indoor-Rad, Rudern, Stepper, Schwimmen, Kampfsport u. a. mit Dauer, Distanz, Puls, Leistung, Session-RPE und optional Zeit in Zonen (z. B. aus Garmin).
- **Auswertung**: Sätze pro Muskel und Woche mit Zielbereich, Intensitätsverteilung (80/20), Wochenlast, Ausdauerminuten, Belastungstrend (akut : chronisch), Monotonie, e1RM-Verlauf.
- **Hinweise**: regelbasierte Tipps aus den Wochendaten, jeweils mit Quelle.
- **Backup**: Export/Import als JSON-Datei.

## Aufbau

```
index.html              Hülle der App
css/app.css             Gestaltung (Farben als Variablen oben)
js/app.js               Start, Navigation, Modulliste
js/core/                Speicher, UI-Bausteine, Diagramme, Datum, Icons, Modul-Registry
js/science/             Trainingswissenschaft: Ziele, Kraft, Ausdauer, Belastung, Hinweise, Quellen
js/data/exercises.js    Übungsbibliothek mit Muskelzuordnung
js/modules/             Ein Modul pro Bereich (heute, kraft, ausdauer, fortschritt, profil, wissen)
sw.js                   Offline-Speicher (Service Worker)
```

## Typische Änderungen

| Was | Wo |
|---|---|
| Neues Ziel oder andere Startwerte | `js/science/goals.js` |
| Übungen ergänzen | `js/data/exercises.js` (oder in der App „Eigene Übung“) |
| Progressionslogik | `suggestNext()` in `js/science/strength.js` |
| Neue Hinweis-Regel | `RULES` in `js/science/coach.js` |
| Neues Modul | Datei in `js/modules/` anlegen, in `js/app.js` importieren und registrieren |
| Datenstruktur ändern | `SCHEMA_VERSION` und `MIGRATIONS` in `js/core/store.js` |

Nach Änderungen in `sw.js` die `VERSION` erhöhen, damit installierte Apps die neue Fassung laden.

## Auf dem iPhone installieren (GitHub Pages, kostenlos)

1. Kostenloses Konto auf github.com anlegen, neues öffentliches Repository erstellen (z. B. `trainingstracker`).
2. Alle Dateien dieses Ordners hochladen („Add file“ → „Upload files“).
3. Unter „Settings“ → „Pages“: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
4. Nach ca. einer Minute ist die App unter `https://<name>.github.io/trainingstracker/` erreichbar.
5. Auf dem iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

Jede Person installiert die App auf ihrem eigenen Handy und legt dort ihr Profil an. Die Daten werden nicht geteilt.

## Lokal testen

```
python3 -m http.server 8000
```
Dann `http://localhost:8000` öffnen.
