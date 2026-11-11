"""
Backend API — AI Baby Monitor (FastAPI)
Sesuai PRD Bagian 7.3 & 8.1:
  - GET  /health
  - GET  /v1/status
  - POST /ingest/heartbeat
  - POST /ingest/frame
  - POST /v1/notify
  - POST /v1/test-alarm
"""
import os
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

INGEST_TOKEN = os.getenv("INGEST_TOKEN", "aibm-secret-token-2026")

app = FastAPI(
    title="AI Baby Monitor Cloud API",
    version="1.0.0",
    description="Backend API pemantauan bayi berbasis AI sesuai PRD.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# State in-memory untuk prototipe
STATE: Dict[str, Any] = {
    "started_at": time.time(),
    "cameras": {},
    "latest_frame": None,
    "events": [],
    "last_alarm": None,
}


def verify_token(x_ingest_token: Optional[str]):
    if INGEST_TOKEN and x_ingest_token and x_ingest_token != INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid X-Ingest-Token")


class HeartbeatPayload(BaseModel):
    camera_id: str = "cam-01"
    status: str = "sleep"
    db: int = 34
    motion: int = 4
    rpm: int = 32


class FramePayload(BaseModel):
    camera_id: str = "cam-01"
    image_b64: str
    db: Optional[int] = 34
    motion: Optional[int] = 4


class NotifyPayload(BaseModel):
    type: str
    level: str = "warning"
    latency: float = 1.0
    metrics: Optional[Dict[str, Any]] = None


class TestAlarmPayload(BaseModel):
    speaker_id: Optional[str] = "spk-01"
    sound: str = "siren"
    volume: int = 80


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-baby-monitor-api",
        "uptime_sec": round(time.time() - STATE["started_at"], 1),
        "cameras_online": len(STATE["cameras"]),
    }


@app.get("/v1/status")
def v1_status():
    return {
        "status": "ok",
        "cameras": STATE["cameras"],
        "events_count": len(STATE["events"]),
        "recent_events": STATE["events"][:20],
        "last_alarm": STATE["last_alarm"],
    }


@app.post("/ingest/heartbeat")
def ingest_heartbeat(
    payload: HeartbeatPayload,
    x_ingest_token: Optional[str] = Header(default=None),
):
    verify_token(x_ingest_token)
    STATE["cameras"][payload.camera_id] = {
        "camera_id": payload.camera_id,
        "status": payload.status,
        "db": payload.db,
        "motion": payload.motion,
        "rpm": payload.rpm,
        "updated_at": time.time(),
    }
    return {"ok": True, "camera": STATE["cameras"][payload.camera_id]}


@app.post("/ingest/frame")
def ingest_frame(
    payload: FramePayload,
    x_ingest_token: Optional[str] = Header(default=None),
):
    verify_token(x_ingest_token)
    STATE["latest_frame"] = {
        "camera_id": payload.camera_id,
        "image_b64": payload.image_b64,
        "ts": time.time(),
    }
    # Analisis heuristik sederhana pada frame/sensor
    anomaly = None
    if (payload.db or 0) >= 65:
        anomaly = {"type": "cry", "level": "warning"}
    elif (payload.motion or 0) >= 60:
        anomaly = {"type": "motion", "level": "warning"}
    return {"ok": True, "anomaly": anomaly}


@app.post("/v1/notify")
def v1_notify(
    payload: NotifyPayload,
    x_ingest_token: Optional[str] = Header(default=None),
):
    verify_token(x_ingest_token)
    ev = {
        "id": f"ev-{int(time.time() * 1000)}",
        "type": payload.type,
        "level": payload.level,
        "latency": payload.latency,
        "metrics": payload.metrics or {},
        "ts": int(time.time() * 1000),
    }
    STATE["events"].insert(0, ev)
    STATE["events"] = STATE["events"][:100]
    STATE["last_alarm"] = ev
    return {"ok": True, "event": ev}


@app.post("/v1/test-alarm")
def v1_test_alarm(payload: TestAlarmPayload):
    alarm = {
        "speaker_id": payload.speaker_id,
        "sound": payload.sound,
        "volume": payload.volume,
        "triggered_at": int(time.time() * 1000),
    }
    STATE["last_alarm"] = alarm
    return {"ok": True, "message": "Perintah alarm dikirim ke speaker", "alarm": alarm}
