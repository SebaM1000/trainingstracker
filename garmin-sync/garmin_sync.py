"""Garmin-Sync: holt Workouts und Erholungswerte aus Garmin Connect und legt sie lokal ab.

Nur lesend. Es wird nie etwas in das Garmin-Konto geschrieben.

Aufrufe (immer mit dem Python der virtuellen Umgebung):
    python garmin_sync.py login                  einmaliger Login, nur im echten Terminal
    python garmin_sync.py sync --days 3 --dry-run  Test: abrufen, nichts schreiben
    python garmin_sync.py sync --days 3          abrufen und Dateien schreiben
    python garmin_sync.py sync --days 3 --dashboard  zusätzlich Dashboard neu bauen
"""

from __future__ import annotations

import argparse
import datetime as dt
import getpass
import json
import logging
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable

# ---------------------------------------------------------------- Pfade
PROJECT_DIR = Path(__file__).resolve().parent
TOKEN_DIR = PROJECT_DIR / ".garminconnect"          # privat, nie in einen Cloud-Ordner legen
LOG_DIR = PROJECT_DIR / "logs"
CONFIG_FILE = PROJECT_DIR / "config.json"
# Ziel für Daten, Notizen und Dashboard. Überschreibbar über config.json ("output_dir").
# macOS: iCloud Drive (auf dem iPhone in der Dateien-App sichtbar), Windows: OneDrive.
if sys.platform == "darwin":
    DEFAULT_OUTPUT = Path.home() / "Library" / "Mobile Documents" / "com~apple~CloudDocs" / "GARMIN"
else:
    DEFAULT_OUTPUT = Path.home() / "OneDrive" / "GARMIN"

NO_DATA = None  # fehlender Wert = None (in Notizen: "keine Daten"), nie 0

# Bibliotheks-Logging leise halten, damit nie Anfragen oder Tokens im Log landen
logging.getLogger("garminconnect").setLevel(logging.WARNING)
log = logging.getLogger("garmin_sync")


def setup_logging() -> None:
    LOG_DIR.mkdir(exist_ok=True)
    handler = logging.FileHandler(LOG_DIR / "sync.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)


def output_dir() -> Path:
    try:
        cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        return Path(cfg["output_dir"])
    except Exception:
        return DEFAULT_OUTPUT


# ---------------------------------------------------------------- Rechte
def secure_token_dir() -> None:
    """Token-Ordner nur für den eigenen Benutzer lesbar machen.

    Unter macOS/Linux: Ordner 700, Dateien 600.
    Unter Windows gibt es diese Rechte-Bits nicht wirklich. Das Gegenstück ist eine
    Zugriffsliste (ACL): Vererbung entfernen, nur der eigene Benutzer erhält Zugriff.
    """
    if not TOKEN_DIR.exists():
        return
    if os.name == "nt":
        user = getpass.getuser()
        subprocess.run(["icacls", str(TOKEN_DIR), "/inheritance:r", "/grant:r", f"{user}:(OI)(CI)F"],
                       capture_output=True, check=False)
        for f in TOKEN_DIR.iterdir():
            subprocess.run(["icacls", str(f), "/inheritance:r", "/grant:r", f"{user}:F"],
                           capture_output=True, check=False)
    else:
        os.chmod(TOKEN_DIR, 0o700)
        for f in TOKEN_DIR.iterdir():
            os.chmod(f, 0o600)


# ---------------------------------------------------------------- Login
def cmd_login() -> int:
    if not (sys.stdin.isatty() and sys.stdout.isatty()):
        print("Abbruch: Der Login muss in einem echten Terminalfenster laufen, "
              "damit das Passwort verdeckt eingegeben werden kann.")
        return 2
    from garminconnect import (Garmin, GarminConnectAuthenticationError,
                               GarminConnectTooManyRequestsError)

    print("Garmin-Login (einmalig). Das Passwort wird nicht angezeigt und nicht gespeichert.\n")
    email = input("E-Mail-Adresse: ").strip()
    password = getpass.getpass("Passwort (unsichtbare Eingabe): ")

    def prompt_mfa() -> str:
        return input("Bestätigungscode (2FA) aus E-Mail oder App: ").strip()

    try:
        api = Garmin(email=email, password=password, prompt_mfa=prompt_mfa)
        del password  # Passwort sofort aus dem Speicher dieses Scripts entfernen
        TOKEN_DIR.mkdir(exist_ok=True)
        secure_token_dir()
        api.login(str(TOKEN_DIR))  # speichert das Token selbst im Token-Ordner
        secure_token_dir()
    except GarminConnectAuthenticationError:
        print("\nLogin fehlgeschlagen: E-Mail, Passwort oder Code stimmen nicht.")
        return 1
    except GarminConnectTooManyRequestsError:
        print("\nZu viele Login-Versuche. Bitte einige Minuten warten und erneut versuchen.")
        return 1
    except Exception as e:  # keine Details ausgeben, sie könnten Anmeldedaten enthalten
        print(f"\nLogin fehlgeschlagen ({type(e).__name__}). Bitte später erneut versuchen.")
        return 1

    token_file = TOKEN_DIR / "garmin_tokens.json"
    if not token_file.exists():
        print("\nLogin lief durch, aber es wurde kein Token gespeichert.")
        return 1
    name = None
    try:
        name = api.get_full_name()
    except Exception:
        pass
    print(f"\nErfolgreich angemeldet{f' als {name}' if name else ''}.")
    print("Das Login-Token ist gespeichert. Dieses Fenster kann geschlossen werden.")
    return 0


def connect():
    from garminconnect import Garmin
    if not (TOKEN_DIR / "garmin_tokens.json").exists():
        raise SystemExit("Kein Login-Token gefunden. Bitte zuerst den Login ausführen.")
    api = Garmin()
    api.login(str(TOKEN_DIR))  # nutzt nur das gespeicherte Token, kein Passwort
    secure_token_dir()
    return api


# ---------------------------------------------------------------- Abruf-Helfer
def safe(label: str, fn: Callable[[], Any]) -> Any:
    """Jeder einzelne Abruf ist abgesichert: Fehler -> None, Lauf geht weiter."""
    from garminconnect import GarminConnectTooManyRequestsError
    for attempt in range(2):
        try:
            return fn()
        except GarminConnectTooManyRequestsError:
            if attempt == 0:
                log.warning("%s: Ratenlimit, warte 60 s", label)
                time.sleep(60)
                continue
            log.warning("%s: Ratenlimit, übersprungen", label)
            return None
        except Exception as e:
            log.info("%s: keine Daten (%s)", label, type(e).__name__)
            return None
    return None


def dig(obj: Any, *path: Any) -> Any:
    for p in path:
        if obj is None:
            return None
        try:
            obj = obj[p]
        except (KeyError, IndexError, TypeError):
            return None
    return obj


def num(v: Any, negative_is_missing: bool = True) -> float | None:
    """Zahl oder None. Garmin nutzt -1/-2 als Platzhalter für 'nicht gemessen'."""
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if negative_is_missing and f < 0:
        return None
    return f


def as_int(v: Any) -> int | None:
    f = num(v)
    return None if f is None else int(round(f))


# ---------------------------------------------------------------- Tageswerte
def fetch_day(api, day: str) -> dict[str, Any]:
    summary = safe(f"{day} Tageszusammenfassung", lambda: api.get_user_summary(day)) or {}
    sleep = safe(f"{day} Schlaf", lambda: api.get_sleep_data(day)) or {}
    hrv = safe(f"{day} HRV", lambda: api.get_hrv_data(day)) or {}
    readiness = safe(f"{day} Training Readiness", lambda: api.get_training_readiness(day)) or []
    bb = None
    if summary.get("bodyBatteryHighestValue") is None:
        bb = safe(f"{day} Body Battery", lambda: api.get_body_battery(day))
    rhr_fallback = None
    if summary.get("restingHeartRate") is None:
        rhr_fallback = safe(f"{day} Ruhepuls", lambda: api.get_rhr_day(day))

    # Schlaf
    dto = sleep.get("dailySleepDTO") or {}
    sleep_s = num(dto.get("sleepTimeSeconds"))
    sleep_block = {
        "dauer_h": round(sleep_s / 3600, 2) if sleep_s else None,
        "score": as_int(dig(dto, "sleepScores", "overall", "value")),
        "tief_h": _h(dto.get("deepSleepSeconds")),
        "leicht_h": _h(dto.get("lightSleepSeconds")),
        "rem_h": _h(dto.get("remSleepSeconds")),
        "wach_h": _h(dto.get("awakeSleepSeconds")),
    }

    # HRV
    hs = (hrv or {}).get("hrvSummary") or {}
    hrv_block = {
        "nacht_ms": as_int(hs.get("lastNightAvg")),
        "woche_ms": as_int(hs.get("weeklyAvg")),
        "status": hs.get("status"),
        "baseline_low": as_int(dig(hs, "baseline", "balancedLow")),
        "baseline_high": as_int(dig(hs, "baseline", "balancedUpper")),
    }

    # Ruhepuls
    rhr = as_int(summary.get("restingHeartRate"))
    if rhr is None and rhr_fallback:
        rhr = as_int(dig(rhr_fallback, "allMetrics", "metricsMap", "WELLNESS_RESTING_HEART_RATE", 0, "value"))

    # Body Battery
    bb_high = as_int(summary.get("bodyBatteryHighestValue"))
    bb_low = as_int(summary.get("bodyBatteryLowestValue"))
    if bb_high is None and bb:
        vals = [num(v[1]) for d in bb for v in (d.get("bodyBatteryValuesArray") or []) if len(v) > 1]
        vals = [v for v in vals if v is not None]
        if vals:
            bb_high, bb_low = int(max(vals)), int(min(vals))

    # Training Readiness: bevorzugt der Morgenwert nach dem Aufwachen
    tr = None
    if isinstance(readiness, list) and readiness:
        morning = [r for r in readiness if r.get("inputContext") == "AFTER_WAKEUP_RESET"]
        pool = morning or readiness
        tr = sorted(pool, key=lambda r: str(r.get("timestamp") or ""))[-1]
    elif isinstance(readiness, dict):
        tr = readiness
    tr = tr or {}

    return {
        "datum": day,
        "schlaf": sleep_block,
        "hrv": hrv_block,
        "ruhepuls": rhr,
        "body_battery": {"hoch": bb_high, "tief": bb_low},
        "stress": as_int(summary.get("averageStressLevel")),
        "schritte": as_int(summary.get("totalSteps")),
        "distanz_km_alltag": _km(summary.get("totalDistanceMeters")),
        "training_readiness": {
            "score": as_int(tr.get("score")),
            "stufe": tr.get("level"),
            "hinweis": tr.get("feedbackShort"),
        },
    }


def _h(sec: Any) -> float | None:
    s = num(sec)
    return round(s / 3600, 2) if s is not None else None


def _km(m: Any) -> float | None:
    v = num(m)
    return round(v / 1000, 2) if v is not None else None


# ---------------------------------------------------------------- Workouts
FEEL = {0: "sehr schwach", 25: "schwach", 50: "normal", 75: "stark", 100: "sehr stark"}


def self_evaluation(api, a: dict[str, Any]) -> tuple[float | None, str | None]:
    """Die zwei Angaben, die du nach dem Training auf der Uhr machst:
    'Wie hast du dich gefühlt?' (Gefühl) und 'Wahrgenommene Anstrengung' (RPE 1–10).
    Garmin speichert RPE × 10 und das Gefühl als 0/25/50/75/100. Fehlen die Werte in der
    Aktivitätsliste, werden sie aus den Aktivitätsdetails gelesen."""
    rpe, feel = num(a.get("directWorkoutRpe")), num(a.get("directWorkoutFeel"))
    if rpe is None and feel is None:
        detail = safe(f"Details {a.get('activityId')}", lambda: api.get_activity(a.get("activityId"))) or {}
        rpe = num(dig(detail, "summaryDTO", "directWorkoutRpe"))
        feel = num(dig(detail, "summaryDTO", "directWorkoutFeel"))
    if rpe is not None:
        rpe = round(rpe / 10, 1) if rpe > 10 else rpe
    feel_txt = None
    if feel is not None:
        feel_txt = FEEL.get(int(round(feel / 25) * 25))
    return rpe, feel_txt


def activity_zones(api, a: dict[str, Any]) -> list[float | None] | None:
    """Minuten in den Herzfrequenzzonen 1 bis 5 (falls die Aktivität Pulsdaten hat)."""
    if num(a.get("averageHR")) is None:
        return None
    raw = safe(f"Zonen {a.get('activityId')}", lambda: api.get_activity_hr_in_timezones(a.get("activityId")))
    if not isinstance(raw, list) or not raw:
        return None
    mins: list[float | None] = [None] * 5
    for z in raw:
        n = as_int(z.get("zoneNumber"))
        sec = num(z.get("secsInZone"))
        if n and 1 <= n <= 5 and sec is not None:
            mins[n - 1] = round(sec / 60, 1)
    return mins if any(m is not None for m in mins) else None


SKIP_ZONES = ("strength", "meditation", "breathwork", "yoga")


def fetch_activities(api, start: str, end: str) -> list[dict[str, Any]]:
    raw = safe("Aktivitäten", lambda: api.get_activities_by_date(start, end)) or []
    out = []
    for a in raw:
        typ = dig(a, "activityType", "typeKey") or ""
        zones = None if any(t in typ for t in SKIP_ZONES) else activity_zones(api, a)
        rpe, feel = (None, None) if any(t in typ for t in ("meditation", "breathwork")) else self_evaluation(api, a)
        try:
            out.append({
                "id": str(a.get("activityId")),
                "name": a.get("activityName") or "Aktivität",
                "typ": dig(a, "activityType", "typeKey"),
                "start": a.get("startTimeLocal"),
                "datum": str(a.get("startTimeLocal") or "")[:10],
                "distanz_km": _km(a.get("distance")),
                "dauer_min": round(num(a.get("duration")) / 60, 1) if num(a.get("duration")) else None,
                "puls_avg": as_int(a.get("averageHR")),
                "puls_max": as_int(a.get("maxHR")),
                "te_aerob": num(a.get("aerobicTrainingEffect")),
                "te_anaerob": num(a.get("anaerobicTrainingEffect")),
                "trainingslast": as_int(a.get("activityTrainingLoad")),
                "kalorien": as_int(a.get("calories")),
                "hoehenmeter": as_int(a.get("elevationGain")),
                "leistung_avg": as_int(a.get("avgPower")),
                "rpe": rpe,
                "gefuehl": feel,
                "zonen_min": zones,
            })
        except Exception as e:
            log.info("Aktivität übersprungen (%s)", type(e).__name__)
    return out


def pace(a: dict[str, Any]) -> str | None:
    if not a.get("distanz_km") or not a.get("dauer_min"):
        return None
    sec = a["dauer_min"] * 60 / a["distanz_km"]
    return f"{int(sec // 60)}:{int(round(sec % 60)):02d} min/km"


# ---------------------------------------------------------------- Ausgabe
WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]


def fmt(v: Any, unit: str = "", digits: int = 0) -> str:
    if v is None:
        return "keine Daten"
    if isinstance(v, float) and digits:
        s = f"{v:.{digits}f}".replace(".", ",")
    elif isinstance(v, float):
        s = f"{v:.0f}"
    else:
        s = str(v)
    return f"{s} {unit}".strip()


def day_note(d: dict[str, Any], acts: list[dict[str, Any]]) -> str:
    date = dt.date.fromisoformat(d["datum"])
    s, h, tr = d["schlaf"], d["hrv"], d["training_readiness"]
    lines = [
        f"# {WD[date.weekday()]}, {date:%d.%m.%Y}", "",
        "## Erholung", "",
        "| Wert | Heute |", "|---|---|",
        f"| Training Readiness | {fmt(tr['score'])}{f' ({tr['stufe']})' if tr['stufe'] else ''} |",
        f"| Schlaf | {fmt(s['dauer_h'], 'h', 1)}{f', Score {s['score']}' if s['score'] is not None else ''} |",
        f"| HRV (Nacht) | {fmt(h['nacht_ms'], 'ms')}{f', Status {h['status']}' if h['status'] else ''} |",
        f"| Ruhepuls | {fmt(d['ruhepuls'], 'bpm')} |",
        f"| Body Battery | {fmt(d['body_battery']['tief'])} bis {fmt(d['body_battery']['hoch'])} |"
        if d['body_battery']['hoch'] is not None else "| Body Battery | keine Daten |",
        f"| Stress (Ø) | {fmt(d['stress'])} |",
        f"| Schritte | {fmt(d['schritte'])} |",
        "",
    ]
    if s["dauer_h"] is not None:
        lines += ["## Schlafphasen", "",
                  f"Tief {fmt(s['tief_h'], 'h', 1)}, leicht {fmt(s['leicht_h'], 'h', 1)}, "
                  f"REM {fmt(s['rem_h'], 'h', 1)}, wach {fmt(s['wach_h'], 'h', 1)}.", ""]
    if tr.get("hinweis"):
        lines += [f"Garmin-Hinweis zur Readiness: `{tr['hinweis']}`", ""]
    lines += ["## Workouts", ""]
    lines += [f"- [[{workout_filename(a)[:-3]}|{a['name']}]]: {fmt(a['distanz_km'], 'km', 2)}, "
              f"{fmt(a['dauer_min'], 'min')}" for a in acts] or ["Keine Workouts an diesem Tag."]
    return "\n".join(lines) + "\n"


def slug(text: str) -> str:
    t = re.sub(r"[^\w\-]+", "-", text.lower(), flags=re.UNICODE).strip("-")
    return t[:40] or "aktivitaet"


def workout_filename(a: dict[str, Any]) -> str:
    return f"{a['datum']}_{slug(a['name'])}_{a['id']}.md"


def workout_note(a: dict[str, Any]) -> str:
    return "\n".join([
        f"# {a['name']}", "",
        f"Datum: {a['start'] or a['datum']}  ", f"Typ: {a['typ'] or 'keine Daten'}", "",
        "| Wert | |", "|---|---|",
        f"| Distanz | {fmt(a['distanz_km'], 'km', 2)} |",
        f"| Dauer | {fmt(a['dauer_min'], 'min')} |",
        f"| Pace | {pace(a) or 'keine Daten'} |",
        f"| Puls Ø / max | {fmt(a['puls_avg'])} / {fmt(a['puls_max'], 'bpm')} |",
        f"| Aerober Trainingseffekt | {fmt(a['te_aerob'], '', 1)} |",
        f"| Anaerober Trainingseffekt | {fmt(a['te_anaerob'], '', 1)} |",
        f"| Trainingslast | {fmt(a['trainingslast'])} |",
        f"| Leistung Ø | {fmt(a['leistung_avg'], 'W')} |",
        f"| Anstrengung (RPE) | {fmt(a.get('rpe'), '', 1)} |",
        f"| Gefühl | {a.get('gefuehl') or 'keine Daten'} |",
        f"| Höhenmeter | {fmt(a['hoehenmeter'], 'm')} |",
        f"| Kalorien | {fmt(a['kalorien'], 'kcal')} |",
        "", f"[[{a['datum']}|Zum Tag]]", "",
    ])


def write_all(base: Path, days: list[dict], acts: list[dict]) -> Path:
    root = base / "garmin"
    (root / "tage").mkdir(parents=True, exist_ok=True)
    (root / "workouts").mkdir(parents=True, exist_ok=True)
    data_file = root / "data.json"
    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
    except Exception:
        data = {"tage": {}, "workouts": {}}
    for d in days:
        old = data["tage"].get(d["datum"])
        data["tage"][d["datum"]] = merge_keep(old, d)
    for a in acts:
        data["workouts"][a["id"]] = a
    data["aktualisiert"] = dt.datetime.now().isoformat(timespec="seconds")
    data["tage"] = dict(sorted(data["tage"].items()))
    tmp = data_file.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(data_file)

    by_day: dict[str, list] = {}
    for a in data["workouts"].values():
        by_day.setdefault(a["datum"], []).append(a)
    for d in days:
        merged = data["tage"][d["datum"]]
        (root / "tage" / f"{d['datum']}.md").write_text(
            day_note(merged, sorted(by_day.get(d["datum"], []), key=lambda x: x["start"] or "")), encoding="utf-8")
    for a in acts:
        (root / "workouts" / workout_filename(a)).write_text(workout_note(a), encoding="utf-8")
    return root


def merge_keep(old: dict | None, new: dict) -> dict:
    """Neue Werte gewinnen, aber ein fehlender neuer Wert löscht keinen alten."""
    if not old:
        return new
    out = {}
    for k, v in new.items():
        if isinstance(v, dict):
            out[k] = merge_keep(old.get(k) if isinstance(old.get(k), dict) else None, v)
        else:
            out[k] = v if v is not None else old.get(k)
    return out


# ---------------------------------------------------------------- Sync
def cmd_sync(days: int, dry_run: bool, dashboard: bool) -> int:
    started = time.time()
    try:
        api = connect()
    except SystemExit as e:
        print(e)
        return 3
    except Exception as e:
        print(f"Anmeldung mit gespeichertem Token fehlgeschlagen ({type(e).__name__}). "
              "Bitte den Login erneut ausführen.")
        log.error("Token-Login fehlgeschlagen: %s", type(e).__name__)
        return 3

    today = dt.date.today()
    dates = [(today - dt.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    results = []
    for i, day in enumerate(dates, 1):
        results.append(fetch_day(api, day))
        print(f"  {day} abgerufen ({i}/{len(dates)})", flush=True)
        time.sleep(0.3)  # Garmin nicht überlasten
    acts = fetch_activities(api, dates[0], dates[-1])

    with_values = [r for r in results if any(v is not None for v in flat(r) if v != r["datum"])]
    print(f"\n{len(dates)} Tage abgefragt, {len(with_values)} davon mit Werten, {len(acts)} Workouts.")

    if dry_run:
        print("\nTESTLAUF – es wurde nichts geschrieben.\n")
        for r in results:
            s, tr = r["schlaf"], r["training_readiness"]
            print(f"{r['datum']}: Readiness {fmt(tr['score'])}, Schlaf {fmt(s['dauer_h'], 'h', 1)}, "
                  f"HRV {fmt(r['hrv']['nacht_ms'], 'ms')}, Ruhepuls {fmt(r['ruhepuls'], 'bpm')}, "
                  f"Body Battery {fmt(r['body_battery']['tief'])}-{fmt(r['body_battery']['hoch'])}, "
                  f"Stress {fmt(r['stress'])}, Schritte {fmt(r['schritte'])}")
        for a in acts:
            print(f"  Workout {a['datum']}: {a['name']} – {fmt(a['distanz_km'], 'km', 2)}, "
                  f"{fmt(a['dauer_min'], 'min')}, {pace(a) or 'ohne Pace'}, Puls Ø {fmt(a['puls_avg'])}, "
                  f"TE aerob {fmt(a['te_aerob'], '', 1)}")
        return 0

    root = write_all(output_dir(), results, acts)
    log.info("Sync ok: %d Tage, %d mit Werten, %d Workouts, %.0f s",
             len(dates), len(with_values), len(acts), time.time() - started)
    print(f"Geschrieben nach: {root}")

    if dashboard:
        import build_dashboard
        out = build_dashboard.build(root / "data.json", output_dir() / "dashboard.html")
        print(f"Dashboard neu gebaut: {out}")
    return 0


def flat(d: Any):
    if isinstance(d, dict):
        for v in d.values():
            yield from flat(v)
    else:
        yield d


def main() -> int:
    setup_logging()
    p = argparse.ArgumentParser(description="Garmin-Daten lokal synchronisieren (nur lesend).")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login", help="Einmaliger Login im Terminal")
    s = sub.add_parser("sync", help="Daten abrufen")
    s.add_argument("--days", type=int, default=3)
    s.add_argument("--dry-run", action="store_true", help="nur anzeigen, nichts schreiben")
    s.add_argument("--dashboard", action="store_true", help="danach Dashboard neu bauen")
    a = p.parse_args()
    if a.cmd == "login":
        return cmd_login()
    try:
        code = cmd_sync(max(1, a.days), a.dry_run, a.dashboard)
    except Exception as e:  # unerwarteter Fehler: festhalten, ohne Details, die Daten enthalten könnten
        log.error("Sync abgebrochen: %s", type(e).__name__)
        code = 1
    log.info("Exit-Code %d", code)
    return code


if __name__ == "__main__":
    sys.exit(main())
