"""
Nagrik AI service — three stages, all running on ONE model (OpenCLIP)
loaded ONCE, deliberately:
  1. Safety filter — zero-shot CLIP comparison against safe/unsafe
     text prompts (see prompts.py). Originally this stage used
     opennsfw2, a dedicated NSFW classifier — but opennsfw2 pulls in
     TensorFlow + Keras as a second full ML framework alongside
     PyTorch, and loading two entire frameworks simultaneously caused
     repeated out-of-memory crashes on a free-tier host (visible as an
     endless restart loop with TensorFlow's init logs repeating, never
     reaching a clean Python traceback — the process was being
     SIGKILLed by the host, not failing at the application level).
     Reusing the already-loaded CLIP model for this instead of a
     second framework is a deliberate memory-vs-accuracy tradeoff for
     a resource-constrained deploy, not an oversight.
  2. Relevance + category (OpenCLIP zero-shot) — scores the photo
     against civic categories AND an explicit "not a civic issue"
     bucket, with confidence-gap thresholding for uncertain calls.
  3. Description (BLIP image captioning) — a short, free-text caption
     of what's actually in the photo. Only runs when stage 1 passes
     and stage 2 didn't land on not_an_issue.

This is a real, runnable implementation (not a mocked response) —
the classify/embed endpoints' *logic* (safety-filter branching,
confidence-gap thresholding, embedding normalization) has been
separately verified with mocked model weights, but the actual model
outputs (real category accuracy, real caption quality, real safety-
prompt separation) still need a smoke test with the true weights on a
real deploy before relying on it for a demo.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Wire the frontend to it by setting, in ai-service's deployed URL, the
Node backend's CLASSIFICATION_SERVICE_URL (see server/README notes) or
by pointing HttpClassificationService directly at this service's
/classify endpoint for a simpler setup without routing through Node.
"""

import io
from typing import Optional

import numpy as np
import open_clip
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from transformers import BlipForConditionalGeneration, BlipProcessor

from prompts import (
    CATEGORY_PROMPTS,
    CONFIDENCE_GAP_THRESHOLD,
    SAFETY_PROMPTS,
    SAFETY_REJECT_THRESHOLD,
)

app = FastAPI(title="Nagrik AI Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the deployed frontend origin before a real launch
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Model loading (once, at startup) ---------------------------------
# ViT-B-32 is the smallest common OpenCLIP checkpoint — chosen
# specifically to keep this runnable on a free-tier CPU instance rather
# than needing a GPU box.
_device = "cuda" if torch.cuda.is_available() else "cpu"
_clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms(
    "ViT-B-32", pretrained="laion2b_s34b_b79k"
)
_clip_model.to(_device).eval()
_tokenizer = open_clip.get_tokenizer("ViT-B-32")


def _encode_text_prompts(prompts: dict[str, str]):
    names = list(prompts.keys())
    tokens = _tokenizer([prompts[k] for k in names]).to(_device)
    with torch.no_grad():
        features = _clip_model.encode_text(tokens)
        features /= features.norm(dim=-1, keepdim=True)
    return names, features


_safety_names, _safety_text_features = _encode_text_prompts(SAFETY_PROMPTS)
_category_names, _category_text_features = _encode_text_prompts(CATEGORY_PROMPTS)

# BLIP-base — picked over BLIP-large or a full VLM specifically to stay
# CPU-runnable: ~450MB, a few seconds per image on CPU, no GPU needed.
_blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
_blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
_blip_model.to(_device).eval()

_CAPTION_PROMPT = "a photo showing"


class ClassificationResult(BaseModel):
    passedSafetyFilter: bool
    predictedCategory: str
    confidence: float
    needsManualReview: bool
    description: Optional[str] = None


def _generate_caption(image: Image.Image) -> str:
    inputs = _blip_processor(image, _CAPTION_PROMPT, return_tensors="pt").to(_device)
    with torch.no_grad():
        out = _blip_model.generate(**inputs, max_new_tokens=30)
    caption = _blip_processor.decode(out[0], skip_special_tokens=True)
    if caption.lower().startswith(_CAPTION_PROMPT.lower()):
        caption = caption[len(_CAPTION_PROMPT):].strip()
    return caption[:1].upper() + caption[1:] if caption else caption


@app.get("/health")
def health():
    return {"ok": True, "device": _device}


@app.post("/classify", response_model=ClassificationResult)
async def classify(photo: UploadFile = File(...)):
    raw = await photo.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Could not read image")

    image_input = _clip_preprocess(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        image_features = _clip_model.encode_image(image_input)
        image_features /= image_features.norm(dim=-1, keepdim=True)

        # --- Stage 1: safety filter (CLIP zero-shot, see module docstring) --
        safety_scores = (100.0 * image_features @ _safety_text_features.T).softmax(dim=-1)
        safety_scores = safety_scores.cpu().numpy()[0]
        unsafe_score = float(safety_scores[_safety_names.index("unsafe")])
        if unsafe_score >= SAFETY_REJECT_THRESHOLD:
            return ClassificationResult(
                passedSafetyFilter=False,
                predictedCategory="not_an_issue",
                confidence=0.0,
                needsManualReview=False,
                description=None,
            )

        # --- Stage 2: zero-shot relevance + category scoring ---------------
        category_scores = (100.0 * image_features @ _category_text_features.T).softmax(dim=-1)
        scores = category_scores.cpu().numpy()[0]

    ranked_idx = np.argsort(scores)[::-1]
    top_idx, second_idx = ranked_idx[0], ranked_idx[1]
    top_category = _category_names[top_idx]
    top_score = float(scores[top_idx])
    confidence_gap = float(scores[top_idx] - scores[second_idx])
    needs_review = confidence_gap < CONFIDENCE_GAP_THRESHOLD

    # --- Stage 3: caption, only when there's a real issue to describe --
    description = None
    if top_category != "not_an_issue":
        try:
            description = _generate_caption(image)
        except Exception:
            description = None

    return ClassificationResult(
        passedSafetyFilter=True,
        predictedCategory=top_category,
        confidence=top_score,
        needsManualReview=needs_review,
        description=description,
    )


@app.post("/embed")
async def embed(photo: UploadFile = File(...)):
    """
    Returns a CLIP image embedding for the visual-similarity half of
    duplicate detection (paired with the GPS proximity check already
    implemented in server/routes/reports.js).
    """
    raw = await photo.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Could not read image")

    image_input = _clip_preprocess(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        features = _clip_model.encode_image(image_input)
        features /= features.norm(dim=-1, keepdim=True)

    return {"embedding": features.cpu().numpy()[0].tolist()}


