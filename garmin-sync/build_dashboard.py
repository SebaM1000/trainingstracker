"""Baut das Dashboard: schreibt data.json in die Vorlage und erzeugt eine einzelne HTML-Datei.

Die Daten werden eingebettet, weil eine lokal geöffnete HTML-Datei aus
Sicherheitsgründen keine JSON-Datei nachladen darf.

Aufruf:  python build_dashboard.py [pfad/zu/data.json] [pfad/zu/dashboard.html]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "dashboard_template.html"
PATTERN = re.compile(r"/\*__DATA__\*/.*?/\*__END__\*/", re.S)


def build(data_file: Path, out_file: Path) -> Path:
    data = json.loads(Path(data_file).read_text(encoding="utf-8"))
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # Schutz: Text darf das <script>-Element nicht vorzeitig beenden
    payload = payload.replace("</", "<\\/").replace("<!--", "<\\!--")
    html = TEMPLATE.read_text(encoding="utf-8")
    if not PATTERN.search(html):
        raise RuntimeError("Platzhalter für die Daten fehlt in der Vorlage.")
    html = PATTERN.sub(lambda _: f"/*__DATA__*/{payload}/*__END__*/", html, count=1)
    out_file = Path(out_file)
    tmp = out_file.with_suffix(".tmp")
    tmp.write_text(html, encoding="utf-8")
    tmp.replace(out_file)
    return out_file


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    from garmin_sync import output_dir

    base = output_dir()
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else base / "garmin" / "data.json"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else base / "dashboard.html"
    print(f"Dashboard gebaut: {build(src, dst)}")
