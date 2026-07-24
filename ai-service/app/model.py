"""
Multi-task complaint classifier.

Shared DistilBERT encoder + three classification heads:
  - Category (17 classes)
  - Priority (4 classes)
  - Sentiment (3 classes)

Department is derived from category via a rule map (see labels.py) so
that the department output is always consistent with an existing set
of organisational departments, while the ML model handles the language
understanding tasks.
"""
from __future__ import annotations
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

from .labels import (
    CATEGORIES, PRIORITIES, SENTIMENTS,
    MODEL_BACKBONE,
)


class MultiTaskComplaintModel(nn.Module):
    def __init__(self, backbone_name: str = MODEL_BACKBONE, dropout: float = 0.2):
        super().__init__()
        self.backbone = AutoModel.from_pretrained(backbone_name)
        hidden = self.backbone.config.hidden_size

        self.dropout = nn.Dropout(dropout)
        # Task-specific heads on top of the pooled [CLS] representation.
        self.category_head  = nn.Linear(hidden, len(CATEGORIES))
        self.priority_head  = nn.Linear(hidden, len(PRIORITIES))
        self.sentiment_head = nn.Linear(hidden, len(SENTIMENTS))

    def forward(self, input_ids, attention_mask):
        out = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        # [CLS] token representation (first token of last hidden state)
        cls = out.last_hidden_state[:, 0]
        cls = self.dropout(cls)
        return {
            "category":  self.category_head(cls),
            "priority":  self.priority_head(cls),
            "sentiment": self.sentiment_head(cls),
        }


def load_tokenizer(backbone_name: str = MODEL_BACKBONE):
    return AutoTokenizer.from_pretrained(backbone_name)
