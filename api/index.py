"""
Vercel serverless entry point for the TrainSense Flask backend.

Vercel's Python runtime detects the module-level `app` (a WSGI app) and serves
it. Incoming `/api/*` requests are routed here via the rewrite in vercel.json;
the Flask blueprint is mounted at `/api`, so the original paths match directly.
"""
import os
import sys
import shutil

# Make the backend package importable (it lives at <root>/backend).
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

# SQLite is read-only on Vercel's bundled filesystem; copy the prebuilt DB to
# /tmp (the only writable location) so SQLAlchemy can open it cleanly.
SRC_DB = os.path.join(BACKEND, "instance", "mta_subway_app.db")
TMP_DB = "/tmp/mta_subway_app.db"
try:
    if os.path.exists(SRC_DB) and not os.path.exists(TMP_DB):
        shutil.copyfile(SRC_DB, TMP_DB)
    if os.path.exists(TMP_DB):
        os.environ.setdefault("DATABASE_URL", f"sqlite:///{TMP_DB}")
except Exception as exc:  # pragma: no cover - defensive; falls back to config default
    print(f"[api] DB setup warning: {exc}")

from app import create_app  # noqa: E402  (import after sys.path setup)

app = create_app()
