"""
Central label definitions for the multi-task complaint model.
Any change here must be reflected in training + inference.
"""

CATEGORIES = [
    "Water Supply", "Electricity", "Plumbing",
    "Internet/Wifi", "Computer/Hardware",
    "Hostel Room", "Mess/Food",
    "Academic Issue", "Faculty Issue",
    "Security/Safety", "Harassment",
    "Cleanliness", "Garbage",
    "Transport", "Parking",
    "Administrative", "Other"
]

PRIORITIES = ["Low", "Medium", "High", "Critical"]

SENTIMENTS = ["Negative", "Neutral", "Positive"]

# Mapping from category -> department
CATEGORY_TO_DEPARTMENT = {
    "Water Supply":       "Maintenance",
    "Electricity":        "Maintenance",
    "Plumbing":           "Maintenance",
    "Internet/Wifi":      "IT Support",
    "Computer/Hardware":  "IT Support",
    "Hostel Room":        "Hostel Administration",
    "Mess/Food":          "Hostel Administration",
    "Academic Issue":     "Academic",
    "Faculty Issue":      "Academic",
    "Security/Safety":    "Security",
    "Harassment":         "Security",
    "Cleanliness":        "Sanitation",
    "Garbage":            "Sanitation",
    "Transport":          "Transport",
    "Parking":            "Transport",
    "Administrative":     "HR / Administration",
    "Other":              "HR / Administration",
}

DEPARTMENTS = sorted(set(CATEGORY_TO_DEPARTMENT.values()))

CAT2ID  = {c: i for i, c in enumerate(CATEGORIES)}
PRIO2ID = {p: i for i, p in enumerate(PRIORITIES)}
SENT2ID = {s: i for i, s in enumerate(SENTIMENTS)}
DEPT2ID = {d: i for i, d in enumerate(DEPARTMENTS)}

ID2CAT  = {i: c for c, i in CAT2ID.items()}
ID2PRIO = {i: p for p, i in PRIO2ID.items()}
ID2SENT = {i: s for s, i in SENT2ID.items()}
ID2DEPT = {i: d for d, i in DEPT2ID.items()}

MODEL_VERSION = "distilbert-multitask-v1"
MODEL_BACKBONE = "distilbert-base-uncased"
