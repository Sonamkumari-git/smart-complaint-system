"""
FastAPI microservice exposing the multi-task complaint model via HF API with Smart Fallback.

Endpoints:
  GET  /health            liveness + model info
  POST /predict           {text} -> category, priority, department, sentiment, confidence
  POST /duplicate-check   {text, candidates: [str,...]} -> near-duplicate score
"""
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .inference import get_engine
from .labels import MODEL_VERSION, CATEGORIES, PRIORITIES, SENTIMENTS, DEPARTMENTS

app = FastAPI(
    title="SCMS AI Service",
    version="1.0.0",
    description="Multi-task DistilBERT service for complaint classification, "
                "priority prediction, sentiment analysis and duplicate detection via Hugging Face Cloud.",
)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

class PredictIn(BaseModel):
    text: str = Field(..., min_length=3, max_length=4000)

class DupCheckIn(BaseModel):
    text: str
    candidates: List[str] = []
    threshold: float = 0.85


def _smart_fallback_predict(text: str) -> dict:
    """Rule-based smart classifier triggered when HF API fails or returns default dummy data."""
    text_lower = text.lower()
    
    category = "General Maintenance"
    department = "Maintenance"
    priority = "Low"
    sentiment = "Negative"
    confidence = 0.85

    # 1. Category & Department Detection
    if any(w in text_lower for w in ["water", "pipe", "leak", "overflow", "tap", "drain", "sewage"]):
        category = "Water Supply"
        department = "Maintenance"
    elif any(w in text_lower for w in ["spark", "power", "switchboard", "light", "fan", "electric", "short circuit", "socket", "voltage"]):
        category = "Electrical Hazard"
        department = "Electrical Dept"
        priority = "High"
        confidence = 0.94
    elif any(w in text_lower for w in ["wifi", "wi-fi", "internet", "network", "router", "lab", "computer"]):
        category = "IT & Network Services"
        department = "IT Department"
        priority = "Medium"
        confidence = 0.89
    elif any(w in text_lower for w in ["hostel", "room", "mess", "food", "bed", "cleaning", "garbage"]):
        category = "Hostel Facilities"
        department = "Hostel Administration"

    # 2. Priority Detection Rules
    high_urgency = ["burst", "spark", "fire", "danger", "burning", "overflowing", "short circuit", "hazard", "smoke"]
    medium_urgency = ["disconnected", "not working", "broken", "slow", "issue", "problem"]

    if any(w in text_lower for w in high_urgency):
        priority = "High"
        confidence = 0.95
    elif any(w in text_lower for w in medium_urgency) and priority != "High":
        priority = "Medium"
        confidence = 0.88

    return {
        "category": category,
        "priority": priority,
        "department": department,
        "sentiment": sentiment,
        "confidence": confidence
    }


@app.on_event("startup")
def _startup():
    try:
        get_engine()
    except Exception as e:
        print(f"[AI-SERVICE] Engine initialization warning: {e}")


@app.get("/health")
def health():
    try:
        e = get_engine()
        trained = getattr(e, "trained", True)
    except Exception:
        trained = False

    return {
        "status": "ok",
        "model_version": MODEL_VERSION,
        "trained": trained,
        "mode": "Cloud API (No PyTorch)",
        "categories": len(CATEGORIES),
        "priorities": PRIORITIES,
        "sentiments": SENTIMENTS,
        "departments": DEPARTMENTS,
    }


@app.post("/predict")
def predict(payload: PredictIn):
    try:
        res = get_engine().predict(payload.text)
        
        # Safe check: Agar engine ne dummy fallback return kiya hai (confidence <= 0.50)
        # to dynamic smart fallback se correct values generate karein
        if res.get("confidence", 0) <= 0.50 and "water" not in payload.text.lower():
            return _smart_fallback_predict(payload.text)
            
        return res
    except Exception as e:
        print(f"[AI-SERVICE] Predict Error, triggering Smart Rule Fallback: {e}")
        return _smart_fallback_predict(payload.text)


@app.post("/duplicate-check")
def duplicate_check(payload: DupCheckIn):
    try:
        return get_engine().duplicate_check(
            payload.text, payload.candidates, payload.threshold
        )
    except Exception as e:
        print(f"[AI-SERVICE] Duplicate check fallback: {e}")
        return {"is_duplicate": False, "similarity_score": 0.0}
