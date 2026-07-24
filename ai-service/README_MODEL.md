# SCMS Deep Learning Model

Multi-task DistilBERT for complaint intelligence.

## Architecture

```
                Complaint Text
                       |
                   Tokenizer
                       |
                  DistilBERT
                       |
              Shared Transformer
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
   Category Head  Priority Head  Sentiment Head
        |              |              |
        v              v              v
    Category        Priority       Sentiment
                       |
                       v
               Department Mapping
```

* Backbone: `distilbert-base-uncased` (Hugging Face)
* Shared encoder feeds three linear classification heads.
* Department is derived deterministically from category (business rule).
* Multi-task loss:
  `L = CE(category) + CE(priority) + 0.5 * CE(sentiment)`

## Training pipeline

1. **Generate dataset** (or replace with real data):
   ```
   python -m scripts.generate_dataset --out data/complaints.csv --per-category 250
   ```
   Produces ~4250 labelled complaints (`text, category, priority, sentiment`).

2. **Fine-tune the model**:
   ```
   python -m training.train --data data/complaints.csv --epochs 3 \
       --batch-size 16 --lr 2e-5 --out models/complaint_multitask.pt
   ```
   Reports per-task accuracy and macro-F1. Saves best checkpoint by average F1.

3. **Serve the model**:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   The inference engine auto-loads the checkpoint at
   `models/complaint_multitask.pt` (or `SCMS_MODEL_PATH`). Falls back to a
   keyword heuristic if no checkpoint is present so development is not blocked.

## Duplicate detection

`/duplicate-check` uses `sentence-transformers/all-MiniLM-L6-v2` for embedding
similarity. Falls back to TF-IDF + cosine when sentence-transformers is not
available. The Node.js backend calls this endpoint after AI classification
against recent open complaints to flag near-duplicates.
