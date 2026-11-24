# Garmin-Sync für den Trainingstracker

Holt Workouts und Erholungswerte (Schlaf, HRV, Ruhepuls, Body Battery, Stress, Schritte,
Training Readiness) aus dem eigenen Garmin-Connect-Konto und legt sie lokal ab:
`garmin/data.json`, eine Markdown-Notiz pro Tag und pro Workout sowie `dashboard.html`.
Die `data.json` importiert man in der Trainingstracker-App unter Profil → Garmin-Import.

Nur lesend: Es wird nie etwas ins Garmin-Konto geschrieben.

## Dateien

| Datei | Zweck |
|---|---|
| `garmin_sync.py` | Login (einmalig, nur im Terminal) und Abruf |
| `build_dashboard.py` | Baut `dashboard.html` aus `data.json` |
| `dashboard_template.html` | Aussehen des Dashboards |
| `requirements.txt` | Abhängigkeit (`garminconnect`), nur in eine `.venv` installieren |

## Einrichtung (Kurzfassung)

1. Projektordner außerhalb jeder Cloud anlegen, z. B. `~/garmin-ai`, diese Dateien hineinkopieren.
2. Python ab 3.11, dann `python3 -m venv .venv` und `.venv/bin/pip install -r requirements.txt`.
3. Login im echten Terminal: `.venv/bin/python garmin_sync.py login`
   (E-Mail, verdecktes Passwort, ggf. 2FA-Code; gespeichert wird nur ein Token in `.garminconnect/`).
4. Test ohne Schreiben: `.venv/bin/python garmin_sync.py sync --days 3 --dry-run`
5. Historie: `.venv/bin/python garmin_sync.py sync --days 60 --dashboard`
6. Täglich automatisch: `sync --days 3 --dashboard`, auf dem Mac als LaunchAgent, der direkt
   `.venv/bin/python` aufruft (kein Shell-Script aus Dokumente/Schreibtisch, sonst
   „Operation not permitted“). Einmal manuell auslösen und Exit-Code sowie Dateien prüfen.

## Speicherort

Standard: macOS → iCloud Drive/GARMIN, Windows → OneDrive/GARMIN.
Anderer Ort: `config.json` neben dem Script mit `{"output_dir": "/pfad/zum/ordner"}`.
Das Login-Token bleibt immer im Projektordner und gehört nie in einen Cloud-Ordner.

## Automatische Übergabe an die App (optional, empfohlen)

Statt die `data.json` jeden Morgen in der Dateien-App auszuwählen, kann der PC sie zusätzlich
in ein **privates** GitHub-Repository legen. Die Trainings-App holt sie dort beim Öffnen selbst ab.

1. Auf GitHub ein **privates** Repository anlegen, z. B. `garmin-daten` (leer, ohne README).
2. Zwei Fine-grained-Schlüssel anlegen (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens),
   jeweils nur für dieses eine Repository:
   - **PC:** Repository permissions → Contents: *Read and write*
   - **iPhone:** Repository permissions → Contents: *Read-only*
3. Am PC `github_login.bat` per Doppelklick starten, Repository (`Besitzer/garmin-daten`) und den PC-Schlüssel
   eingeben. Die Eingabe ist unsichtbar, der Schlüssel liegt danach nur im geschützten Ordner `.garminconnect`.
   Das Script verweigert öffentliche Repositories.
4. In der App: Profil → Garmin → „Automatischer Abruf einrichten“, Repository und iPhone-Schlüssel eintragen.

Ab dann lädt jeder Sync die Datei hoch, und die App übernimmt sie beim Öffnen automatisch.
