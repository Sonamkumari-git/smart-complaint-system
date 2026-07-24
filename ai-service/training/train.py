"""
Fine-tunes the multi-task DistilBERT model on the complaint dataset.

Usage:
    python -m training.train \
        --data data/complaints.csv \
        --epochs 3 --batch-size 16 --lr 2e-5 \
        --out models/complaint_multitask.pt

The training uses a *multi-task loss*:
    L = CE(category) + CE(priority) + 0.5 * CE(sentiment)

The category loss has weight 1.0 (primary task), priority weight 1.0
(business-critical), sentiment weight 0.5 (auxiliary).
"""
from __future__ import annotations
import argparse
import os
import time
import math
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.model import MultiTaskComplaintModel, load_tokenizer
from app.labels import (
    CAT2ID, PRIO2ID, SENT2ID, ID2CAT, ID2PRIO, ID2SENT,
    CATEGORIES, PRIORITIES, SENTIMENTS
)


class ComplaintDataset(Dataset):
    def __init__(self, df, tokenizer, max_len=128):
        self.texts = df["text"].astype(str).tolist()
        self.cats  = df["category"].map(CAT2ID).astype(int).tolist()
        self.prio  = df["priority"].map(PRIO2ID).astype(int).tolist()
        self.sent  = df["sentiment"].map(SENT2ID).astype(int).tolist()
        self.tok = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, i):
        enc = self.tok(
            self.texts[i], truncation=True, max_length=self.max_len,
            padding="max_length", return_tensors="pt"
        )
        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "category": torch.tensor(self.cats[i]),
            "priority": torch.tensor(self.prio[i]),
            "sentiment": torch.tensor(self.sent[i]),
        }


def evaluate(model, loader, device):
    model.eval()
    all_cat_p, all_cat_t = [], []
    all_pri_p, all_pri_t = [], []
    all_sen_p, all_sen_t = [], []
    with torch.no_grad():
        for batch in loader:
            ids  = batch["input_ids"].to(device)
            mask = batch["attention_mask"].to(device)
            out = model(ids, mask)
            all_cat_p += out["category"].argmax(-1).cpu().tolist()
            all_cat_t += batch["category"].tolist()
            all_pri_p += out["priority"].argmax(-1).cpu().tolist()
            all_pri_t += batch["priority"].tolist()
            all_sen_p += out["sentiment"].argmax(-1).cpu().tolist()
            all_sen_t += batch["sentiment"].tolist()

    return {
        "category_acc":  accuracy_score(all_cat_t, all_cat_p),
        "priority_acc":  accuracy_score(all_pri_t, all_pri_p),
        "sentiment_acc": accuracy_score(all_sen_t, all_sen_p),
        "category_f1":   f1_score(all_cat_t, all_cat_p, average="macro"),
        "priority_f1":   f1_score(all_pri_t, all_pri_p, average="macro"),
        "sentiment_f1":  f1_score(all_sen_t, all_sen_p, average="macro"),
        "reports": {
            "category":  classification_report(all_cat_t, all_cat_p, target_names=CATEGORIES, zero_division=0),
            "priority":  classification_report(all_pri_t, all_pri_p, target_names=PRIORITIES, zero_division=0),
            "sentiment": classification_report(all_sen_t, all_sen_p, target_names=SENTIMENTS, zero_division=0),
        }
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/complaints.csv")
    ap.add_argument("--out",  default="models/complaint_multitask.pt")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--val-split", type=float, default=0.15)
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("[Train] Device:", device)

    df = pd.read_csv(args.data)
    print(f"[Train] Loaded {len(df)} rows")
    train_df, val_df = train_test_split(df, test_size=args.val_split, random_state=42,
                                        stratify=df["category"])

    tok = load_tokenizer()
    train_ds = ComplaintDataset(train_df, tok, args.max_len)
    val_ds   = ComplaintDataset(val_df, tok, args.max_len)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False, num_workers=0)

    model = MultiTaskComplaintModel().to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)

    total_steps = len(train_loader) * args.epochs
    scheduler = torch.optim.lr_scheduler.LinearLR(optim, start_factor=1.0, end_factor=0.1, total_iters=total_steps)
    ce = nn.CrossEntropyLoss()

    W_CAT, W_PRIO, W_SENT = 1.0, 1.0, 0.5

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    best_f1 = -1.0

    for ep in range(1, args.epochs + 1):
        model.train()
        t0 = time.time()
        running = 0.0
        for step, batch in enumerate(train_loader, 1):
            ids  = batch["input_ids"].to(device)
            mask = batch["attention_mask"].to(device)
            cat  = batch["category"].to(device)
            pri  = batch["priority"].to(device)
            sen  = batch["sentiment"].to(device)

            out = model(ids, mask)
            loss = (W_CAT  * ce(out["category"],  cat)
                  + W_PRIO * ce(out["priority"],  pri)
                  + W_SENT * ce(out["sentiment"], sen))

            optim.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optim.step()
            scheduler.step()

            running += loss.item()
            if step % 25 == 0:
                print(f"  ep {ep} step {step}/{len(train_loader)} loss={running/step:.4f}")

        metrics = evaluate(model, val_loader, device)
        avg_f1 = (metrics["category_f1"] + metrics["priority_f1"] + metrics["sentiment_f1"]) / 3
        dt = time.time() - t0
        print(f"[Epoch {ep}] loss={running/len(train_loader):.4f} time={dt:.1f}s")
        print(f"  category  acc={metrics['category_acc']:.3f}  f1={metrics['category_f1']:.3f}")
        print(f"  priority  acc={metrics['priority_acc']:.3f}  f1={metrics['priority_f1']:.3f}")
        print(f"  sentiment acc={metrics['sentiment_acc']:.3f}  f1={metrics['sentiment_f1']:.3f}")

        if avg_f1 > best_f1:
            best_f1 = avg_f1
            torch.save({"model_state": model.state_dict(), "metrics": metrics}, args.out)
            print(f"  ✓ saved best model to {args.out} (avg macro-F1={avg_f1:.3f})")

    print("\n=== FINAL VALIDATION REPORTS ===")
    metrics = evaluate(model, val_loader, device)
    for k, v in metrics["reports"].items():
        print(f"\n--- {k.upper()} ---\n{v}")

if __name__ == "__main__":
    main()
