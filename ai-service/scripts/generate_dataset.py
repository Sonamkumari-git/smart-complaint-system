"""
Generates a synthetic complaint dataset for fine-tuning the multi-task
DistilBERT model. Each row has:
    text, category, priority, sentiment

Produces ~4000-6000 rows depending on templates & seeds. The dataset is
diverse enough to teach the model per-category vocabulary, urgency signals
and sentiment cues (including Hinglish tokens). For a real production system
this would be replaced with (or augmented by) real historical complaints.

Usage:
    python -m scripts.generate_dataset --out data/complaints.csv
"""
from __future__ import annotations
import argparse
import csv
import os
import random
from itertools import product

random.seed(42)

# --------------------------------------------------------------------
# Templates by category. Each template uses placeholders {issue}, {loc}, {time}
# --------------------------------------------------------------------
TEMPLATES = {
    "Water Supply": {
        "issues": ["no water supply", "water not coming", "very low water pressure",
                   "dirty water is coming", "water tap is leaking", "water supply cut off",
                   "पानी नहीं आ रहा", "no drinking water"],
        "locations": ["Hostel Block A", "Hostel Block B", "Hostel Block C", "Girls Hostel",
                      "Boys Hostel", "canteen", "washrooms on 2nd floor", "Room 201", "Room 305"],
        "sentiment_bias": "Negative",
    },
    "Electricity": {
        "issues": ["power cut", "no electricity", "fan not working", "bulb is fused",
                   "electric socket sparking", "no power in whole floor", "bijli nahi hai",
                   "current fluctuation is damaging appliances"],
        "locations": ["Room 101", "Library", "Lab 2", "Hostel Block D", "study hall",
                      "auditorium", "mess hall"],
        "sentiment_bias": "Negative",
    },
    "Plumbing": {
        "issues": ["toilet is clogged", "washbasin is leaking", "drainage is blocked",
                   "sewage smell", "flush not working", "shower head broken"],
        "locations": ["ground floor washroom", "hostel bathroom", "staff toilet"],
        "sentiment_bias": "Negative",
    },
    "Internet/Wifi": {
        "issues": ["wifi not working", "internet is very slow", "router is offline",
                   "cannot connect to campus network", "wifi disconnects every 5 minutes"],
        "locations": ["library", "hostel room", "classroom", "computer lab"],
        "sentiment_bias": "Negative",
    },
    "Computer/Hardware": {
        "issues": ["computer is not turning on", "keyboard keys not working",
                   "printer paper jam", "monitor is blank", "system is very slow"],
        "locations": ["computer lab", "office", "admin block", "faculty room"],
        "sentiment_bias": "Neutral",
    },
    "Hostel Room": {
        "issues": ["broken bed", "bed sheet not changed", "roommate issue",
                   "warden not responding", "room lock broken", "no proper cleaning"],
        "locations": ["hostel room 202", "block C", "warden office"],
        "sentiment_bias": "Negative",
    },
    "Mess/Food": {
        "issues": ["food quality is very poor", "found insect in food",
                   "mess timing is wrong", "same menu every day",
                   "khana ekdum tasteless hai", "cold food served"],
        "locations": ["mess hall", "canteen", "dining area"],
        "sentiment_bias": "Negative",
    },
    "Academic Issue": {
        "issues": ["exam schedule clash", "results not published", "wrong marks in result",
                   "attendance shortage marked wrongly", "syllabus not covered before exam"],
        "locations": ["academic office", "portal", "notice board"],
        "sentiment_bias": "Negative",
    },
    "Faculty Issue": {
        "issues": ["teacher not coming to class regularly", "faculty is rude",
                   "professor not clearing doubts", "lecture is too fast"],
        "locations": ["class 3B", "lecture hall", "department"],
        "sentiment_bias": "Negative",
    },
    "Security/Safety": {
        "issues": ["bike is stolen from parking", "wallet stolen from library",
                   "strangers entering hostel", "no guard at gate at night",
                   "cctv not working", "fire hazard in lab"],
        "locations": ["parking lot", "main gate", "hostel gate", "library"],
        "sentiment_bias": "Negative",
    },
    "Harassment": {
        "issues": ["ragging by seniors", "verbal abuse from staff",
                   "harassment in hostel", "bullying in class"],
        "locations": ["hostel corridor", "sports ground", "canteen"],
        "sentiment_bias": "Negative",
    },
    "Cleanliness": {
        "issues": ["room not cleaned for days", "washroom is very dirty",
                   "corridor is filthy", "cobwebs everywhere"],
        "locations": ["ground floor", "washroom", "corridor"],
        "sentiment_bias": "Negative",
    },
    "Garbage": {
        "issues": ["garbage not collected", "dustbin overflowing", "waste dumped near hostel"],
        "locations": ["hostel back side", "canteen area", "main road"],
        "sentiment_bias": "Negative",
    },
    "Transport": {
        "issues": ["college bus is always late", "bus did not come today", "bus driver is rude"],
        "locations": ["bus stop", "route 5", "campus gate"],
        "sentiment_bias": "Negative",
    },
    "Parking": {
        "issues": ["no parking space", "someone blocked my vehicle", "parking is chaotic"],
        "locations": ["parking lot", "faculty parking"],
        "sentiment_bias": "Negative",
    },
    "Administrative": {
        "issues": ["fee receipt not generated", "certificate not issued",
                   "office staff not responding", "admission form not accepted"],
        "locations": ["accounts office", "admin block", "registrar office"],
        "sentiment_bias": "Neutral",
    },
    "Other": {
        "issues": ["suggestion for improvement", "general complaint", "misc issue"],
        "locations": ["campus", "college"],
        "sentiment_bias": "Neutral",
    },
}

# Time / urgency phrases that determine priority
URGENCY_PHRASES = {
    "Critical": [
        "immediately", "urgent", "emergency", "fire", "someone is injured",
        "danger to life", "medical emergency", "assault",
    ],
    "High": [
        "since 3 days", "since 4 days", "since last week", "for 2 days",
        "still not fixed", "no response yet", "many students affected",
    ],
    "Medium": [
        "since yesterday", "today morning", "few hours",
        "kindly resolve", "please look into it",
    ],
    "Low": [
        "minor issue", "small problem", "just a suggestion",
        "kabhi kabhi hota hai", "occasionally",
    ],
}

# Sentiment intensifiers
SENTIMENT_TAILS = {
    "Negative": [
        "This is unacceptable.", "Very disappointed.", "Frustrated with this.",
        "Bahut buri service hai.", "Ye kya ho raha hai.",
    ],
    "Neutral": [
        "Please look into it.", "Kindly resolve at earliest.", "Thanks.",
        "Awaiting your response.",
    ],
    "Positive": [
        "Otherwise things are good, just fix this.", "Appreciate quick action.",
        "Thanks in advance.",
    ],
}


def choose_priority():
    r = random.random()
    if r < 0.10: return "Critical"
    if r < 0.40: return "High"
    if r < 0.80: return "Medium"
    return "Low"


def choose_sentiment(bias):
    r = random.random()
    if bias == "Negative":
        return "Negative" if r < 0.70 else ("Neutral" if r < 0.90 else "Positive")
    if bias == "Positive":
        return "Positive" if r < 0.60 else ("Neutral" if r < 0.85 else "Negative")
    return "Neutral" if r < 0.55 else ("Negative" if r < 0.85 else "Positive")


def make_row(category):
    spec = TEMPLATES[category]
    issue = random.choice(spec["issues"])
    loc   = random.choice(spec["locations"])
    priority = choose_priority()
    urgency = random.choice(URGENCY_PHRASES[priority])
    sentiment = choose_sentiment(spec["sentiment_bias"])
    tail = random.choice(SENTIMENT_TAILS[sentiment])
    starters = ["", "Sir, ", "Hello, ", "Complaint: ", "To whom it may concern, ", "Dear admin, "]
    joiners  = [
        f"{issue} at {loc}, {urgency}. {tail}",
        f"There is a problem: {issue} in the {loc}. {urgency}. {tail}",
        f"{loc} me {issue}, {urgency}. {tail}",
        f"{issue}. Location: {loc}. {urgency}. {tail}",
    ]
    text = random.choice(starters) + random.choice(joiners)
    text = text.strip().replace("  ", " ")
    return text, category, priority, sentiment


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/complaints.csv")
    ap.add_argument("--per-category", type=int, default=250)
    args = ap.parse_args()

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    rows = []
    for cat in TEMPLATES.keys():
        for _ in range(args.per_category):
            rows.append(make_row(cat))
    random.shuffle(rows)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "category", "priority", "sentiment"])
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows to {args.out}")

if __name__ == "__main__":
    main()
