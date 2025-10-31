"""Flask backend for FFGZ data management."""
from __future__ import annotations

import math
import os
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# --------------------------------------------------------------------------- #
# App & database setup
# --------------------------------------------------------------------------- #
FRONT_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(FRONT_DIR, "ffgz.db")

app = Flask(__name__, static_folder=FRONT_DIR, static_url_path="/")
CORS(app, resources={r"/*": {"origins": "*"}})

app.config.update(
    SQLALCHEMY_DATABASE_URI=f"sqlite:///{DB_PATH}",
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
)

db = SQLAlchemy(app)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class TypeItem(db.Model):
    __tablename__ = "type_items"

    id = db.Column(db.Integer, primary_key=True)
    model = db.Column(db.String(64), index=True, nullable=False)
    load = db.Column(db.Float)
    damp = db.Column(db.Float)
    kx = db.Column(db.Float)
    ky = db.Column(db.Float)
    kz = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class DataItem(db.Model):
    __tablename__ = "data_items"

    id = db.Column(db.Integer, primary_key=True)
    upper_model = db.Column(db.String(64), index=True, nullable=False)
    lower_model = db.Column(db.String(64), index=True, nullable=False)
    freq_min = db.Column(db.Integer)
    freq_max = db.Column(db.Integer)
    max_excit = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class LogItem(db.Model):
    __tablename__ = "log_items"

    id = db.Column(db.Integer, primary_key=True)
    ts = db.Column(db.DateTime, default=datetime.utcnow)
    action = db.Column(db.String(256))


with app.app_context():
    db.create_all()


# --------------------------------------------------------------------------- #
# Utilities
# --------------------------------------------------------------------------- #
def log_action(message: str) -> None:
    db.session.add(LogItem(action=message))
    db.session.commit()


def coerce_float(value):
    """Convert value to float if possible; otherwise return None."""
    if value in (None, "", "null"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_range(range_text: str | None):
    """Parse `a-b` string into integer pair."""
    if not range_text:
        return None, None
    cleaned = range_text.replace("–", "-").replace("—", "-")
    parts = cleaned.split("-")
    if len(parts) != 2:
        return None, None
    try:
        left = float(parts[0])
        right = float(parts[1])
    except (TypeError, ValueError):
        return None, None
    return int(round(left)), int(round(right))


def freq_range_text(freq_min, freq_max):
    if freq_min is None or freq_max is None:
        return ""
    return f"{freq_min}-{freq_max}"


# --------------------------------------------------------------------------- #
# Static files
# --------------------------------------------------------------------------- #
@app.route("/")
def home():
    index_path = os.path.join(FRONT_DIR, "index.html")
    if not os.path.exists(index_path):
        return f"index.html not found in: {FRONT_DIR}", 404
    return send_from_directory(FRONT_DIR, "index.html")


@app.route("/<path:path>")
def static_proxy(path):
    file_path = os.path.join(FRONT_DIR, path)
    if not os.path.exists(file_path):
        return f"File not found: {file_path}", 404
    return send_from_directory(FRONT_DIR, path)


# --------------------------------------------------------------------------- #
# Type API
# --------------------------------------------------------------------------- #
@app.get("/api/types")
def api_get_types():
    keyword = request.args.get("q", "").strip()
    query = TypeItem.query
    if keyword:
        query = query.filter(TypeItem.model.contains(keyword))
    rows = query.order_by(TypeItem.id.desc()).all()
    return jsonify(
        [
            {
                "id": row.id,
                "model": row.model,
                "load": row.load,
                "damp": row.damp,
                "kx": row.kx,
                "ky": row.ky,
                "kz": row.kz,
            }
            for row in rows
        ]
    )


@app.post("/api/types")
def api_add_type():
    payload = request.get_json() or {}
    item = TypeItem(
        model=payload["model"].strip(),
        load=coerce_float(payload.get("load")),
        damp=coerce_float(payload.get("damp")),
        kx=coerce_float(payload.get("kx")),
        ky=coerce_float(payload.get("ky")),
        kz=coerce_float(payload.get("kz")),
    )
    db.session.add(item)
    db.session.commit()
    log_action(f"create type {item.model}")
    return jsonify({"ok": True, "id": item.id})


@app.put("/api/types/<int:item_id>")
def api_update_type(item_id: int):
    payload = request.get_json() or {}
    item = TypeItem.query.get_or_404(item_id)
    if "model" in payload and payload["model"]:
        item.model = payload["model"].strip()
    for field in ["load", "damp", "kx", "ky", "kz"]:
        if field in payload:
            setattr(item, field, coerce_float(payload[field]))
    db.session.commit()
    log_action(f"update type {item.model}")
    return jsonify({"ok": True})


@app.post("/api/types/bulk_delete")
def api_delete_types():
    ids = request.get_json().get("ids", [])
    if not ids:
        return jsonify({"ok": True, "deleted": 0})
    TypeItem.query.filter(TypeItem.id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()
    log_action(f"delete types count={len(ids)}")
    return jsonify({"ok": True, "deleted": len(ids)})


# --------------------------------------------------------------------------- #
# Data API
# --------------------------------------------------------------------------- #
@app.get("/api/data")
def api_get_data():
    keyword = request.args.get("q", "").strip()
    query = DataItem.query
    if keyword:
        query = query.filter(
            (DataItem.upper_model.contains(keyword))
            | (DataItem.lower_model.contains(keyword))
        )
    rows = query.order_by(DataItem.id.desc()).all()
    return jsonify(
        [
            {
                "id": row.id,
                "upper_model": row.upper_model,
                "lower_model": row.lower_model,
                "freq_range": freq_range_text(row.freq_min, row.freq_max),
                "max_excit": row.max_excit,
            }
            for row in rows
        ]
    )


@app.post("/api/data")
def api_add_data():
    payload = request.get_json() or {}
    freq_min, freq_max = parse_range(payload.get("freq_range"))
    item = DataItem(
        upper_model=payload["upper_model"].strip(),
        lower_model=payload["lower_model"].strip(),
        freq_min=freq_min,
        freq_max=freq_max,
        max_excit=coerce_float(payload.get("max_excit")),
    )
    db.session.add(item)
    db.session.commit()
    log_action(f"create data {item.upper_model}/{item.lower_model}")
    return jsonify({"ok": True, "id": item.id})


@app.put("/api/data/<int:item_id>")
def api_update_data(item_id: int):
    payload = request.get_json() or {}
    item = DataItem.query.get_or_404(item_id)
    if "upper_model" in payload and payload["upper_model"]:
        item.upper_model = payload["upper_model"].strip()
    if "lower_model" in payload and payload["lower_model"]:
        item.lower_model = payload["lower_model"].strip()
    if "freq_range" in payload:
        item.freq_min, item.freq_max = parse_range(payload.get("freq_range"))
    if "max_excit" in payload:
        item.max_excit = coerce_float(payload.get("max_excit"))
    db.session.commit()
    log_action(f"update data {item.upper_model}/{item.lower_model}")
    return jsonify({"ok": True})


@app.post("/api/data/bulk_delete")
def api_delete_data():
    ids = request.get_json().get("ids", [])
    if not ids:
        return jsonify({"ok": True, "deleted": 0})
    DataItem.query.filter(DataItem.id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()
    log_action(f"delete data count={len(ids)}")
    return jsonify({"ok": True, "deleted": len(ids)})


# --------------------------------------------------------------------------- #
# Logs API
# --------------------------------------------------------------------------- #
@app.get("/api/logs")
def api_get_logs():
    rows = LogItem.query.order_by(LogItem.ts.desc()).limit(100).all()
    return jsonify(
        [
            {"ts": row.ts.isoformat(timespec="seconds"), "action": row.action}
            for row in rows
        ]
    )


@app.post("/api/logs")
def api_add_log():
    payload = request.get_json() or {}
    log_action(payload.get("action", ""))
    return jsonify({"ok": True})


# --------------------------------------------------------------------------- #
# Preview placeholder
# --------------------------------------------------------------------------- #
@app.get("/api/preview")
def api_preview():
    freq_min = request.args.get("min", 10, int)
    freq_max = request.args.get("max", 315, int)
    freqs = list(range(freq_min, freq_max + 1))
    response = [60 + 10 * abs(math.sin(idx / 50)) for idx in freqs]
    return jsonify({"freqs": freqs, "response": response})


# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    print("FRONT_DIR:", FRONT_DIR)
    print("Has index.html:", os.path.exists(os.path.join(FRONT_DIR, "index.html")))
    app.run(host="127.0.0.1", port=5000, debug=True)
