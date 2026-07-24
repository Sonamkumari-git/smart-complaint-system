import os
import time
import requests
from .labels import (
    CATEGORIES,
    PRIORITIES,
    SENTIMENTS,
    CATEGORY_TO_DEPARTMENT,
    MODEL_VERSION
)

class InferenceEngine:
    def __init__(self):
        # API Mode - No Torch/Transformers needed!
        self.repo_id = os.environ.get("HF_REPO_ID", "Sonam9091/ai-smart-complaint-model")
        self.api_url = f"https://api-inference.huggingface.co/models/{self.repo_id}"
        
        self.hf_token = os.environ.get("HF_TOKEN")
        self.headers = {}
        if self.hf_token:
            self.headers["Authorization"] = f"Bearer {self.hf_token}"
        else:
            print("[AI-SERVICE] WARNING: HF_TOKEN environment variable is not set!")
            
        self.trained = True
        print(f"[AI-SERVICE] Initialized Light Engine (API Mode: {self.repo_id})")

    def predict(self, text: str):
        """Predict category, priority, sentiment, and department via Cloud API."""
        payload = {"inputs": text}
        
        for attempt in range(4):
            try:
                response = requests.post(
                    self.api_url, 
                    headers=self.headers, 
                    json=payload, 
                    timeout=25
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Flatten array if nested
                    predictions = data[0] if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list) else data
                    
                    category = "Other"
                    priority = "Medium"
                    sentiment = "Neutral"
                    max_confidence = 0.5
                    
                    if isinstance(predictions, list):
                        for item in predictions:
                            lbl = item.get("label")
                            score = item.get("score", 0.0)
                            
                            if score > max_confidence:
                                max_confidence = score
                                
                            if lbl in PRIORITIES:
                                priority = lbl
                            elif lbl in SENTIMENTS:
                                sentiment = lbl
                            elif lbl in CATEGORIES:
                                category = lbl
                                
                    department = CATEGORY_TO_DEPARTMENT.get(category, "HR / Administration")
                    
                    return {
                        "category": category,
                        "priority": priority,
                        "sentiment": sentiment,
                        "department": department,
                        "confidence": round(float(max_confidence), 2),
                        "model_version": MODEL_VERSION
                    }
                    
                elif response.status_code == 503 or "currently loading" in response.text.lower():
                    print(f"[AI-SERVICE] Model loading on HF... Retrying in 10s (Attempt {attempt + 1}/4)")
                    time.sleep(10)
                else:
                    print(f"[AI-SERVICE] HF API Error ({response.status_code}): {response.text}")
                    break
                    
            except Exception as e:
                print(f"[AI-SERVICE] Request exception: {e}")
                break
                
        # Fallback output agar model HF par available na ho
        fallback_cat = CATEGORIES[0] if CATEGORIES else "Other"
        fallback_prio = PRIORITIES[0] if PRIORITIES else "Medium"
        fallback_sent = SENTIMENTS[0] if SENTIMENTS else "Neutral"
        fallback_dept = CATEGORY_TO_DEPARTMENT.get(fallback_cat, "HR / Administration")
        
        return {
            "category": fallback_cat,
            "priority": fallback_prio,
            "sentiment": fallback_sent,
            "department": fallback_dept,
            "confidence": 0.5,
            "model_version": "fallback-v1"
        }

    def duplicate_check(self, text: str, candidates: list, threshold: float = 0.85):
        """Lightweight string overlap check for candidate complaints."""
        matches = []
        text_words = set(text.lower().split())
        
        for cand in candidates:
            cand_str = str(cand)
            cand_words = set(cand_str.lower().split())
            
            intersection = text_words.intersection(cand_words)
            union = text_words.union(cand_words)
            similarity = len(intersection) / len(union) if union else 0.0
            
            matches.append({
                "candidate": cand_str,
                "similarity": round(similarity, 2),
                "is_duplicate": similarity >= threshold
            })
            
        return {"text": text, "matches": matches}

# Global Singleton Instance
_engine_instance = None

def get_engine():
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = InferenceEngine()
    return _engine_instance
