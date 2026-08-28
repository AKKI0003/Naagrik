"""
Nagrik AI service — the pipeline from the pitch, now three stages:
  1. Safety filter (opennsfw2)      — runs first, on every upload.
  2. Relevance + category (OpenCLIP zero-shot) — scores the photo
     against civic categories AND an explicit "not a civic issue"
     bucket, with confidence-gap thresholding for uncertain calls.
  3. Description (BLIP image captioning) — a short, free-text caption
     of what's actually in the photo ("a pothole in the middle of a
     paved road"), so a report carries more than a bare category
     label. Only runs when stage 1 passes and stage 2 didn't land on
     not_an_issue — no point captioning a photo that's about to be
     rejected or that isn't a civic issue at all.

This is a real, runnable implementation (not a mocked response) —
but it has NOT been run end-to-end in the environment this was written
in, since that would require downloading multi-hundred-MB model
weights (torch + open_clip + opennsfw2 + BLIP) with no way to verify
the result here. The classify/embed endpoints' *logic* (safety-filter
branching, confidence-gap thresholding, embedding normalization) has
been separately verified with mocked model weights — see the test
notes in the repo — but the actual model outputs (real category
accuracy, real caption quality) still need a real smoke test with the
true weights before a hackathon demo.

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
import opennsfw2 as n2
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from transformers import BlipForConditionalGeneration, BlipProcessor

from prompts import CATEGORY_PROMPTS, CONFIDENCE_GAP_THRESHOLD

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

_category_names = list(CATEGORY_PROMPTS.keys())
_category_text_tokens = _tokenizer([CATEGORY_PROMPTS[c] for c in _category_names]).to(_device)
with torch.no_grad():
    _category_text_features = _clip_model.encode_text(_category_text_tokens)
    _category_text_features /= _category_text_features.norm(dim=-1, keepdim=True)

# BLIP-base — picked over BLIP-large or a full VLM specifically to stay
# CPU-runnable: ~450MB, a few seconds per image on CPU, no GPU needed.
# It captions *what's visually in the photo*, not "what civic category
# is this" — that's still CLIP's job above. Keeping the two models
# separate (rather than one big VLM doing both) is deliberate: it's
# what keeps this whole service small enough for a free-tier instance.
_blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
_blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
_blip_model.to(_device).eval()

# A short, neutral prefix steers BLIP toward describing the *problem*
# rather than the whole scene ("a street with cars and a pothole" vs
# "a pothole in the road, partially filled with water") — conditional
# captioning with a civic-report-flavored prompt, not free captioning.
_CAPTION_PROMPT = "a photo showing"


class ClassificationResult(BaseModel):
    passedSafetyFilter: bool
    predictedCategory: str
    confidence: float
    needsManualReview: bool
    # None when safety-rejected or classified as not_an_issue — no
    # point captioning a photo that's about to be discarded.
    description: Optional[str] = None


def _generate_caption(image: Image.Image) -> str:
    inputs = _blip_processor(image, _CAPTION_PROMPT, return_tensors="pt").to(_device)
    with torch.no_grad():
        out = _blip_model.generate(**inputs, max_new_tokens=30)
    caption = _blip_processor.decode(out[0], skip_special_tokens=True)
    # BLIP echoes the conditioning prompt back at the start of its
    # output — strip it so the frontend gets a clean standalone
    # sentence instead of "a photo showing a photo showing a pothole".
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

    # --- Stage 1: safety filter, runs before anything else ------------
    nsfw_probability = n2.predict_image(image)
    if nsfw_probability >= 0.8:
        return ClassificationResult(
            passedSafetyFilter=False,
            predictedCategory="not_an_issue",
            confidence=0.0,
            needsManualReview=False,
            description=None,
        )

    # --- Stage 2: zero-shot relevance + category scoring ---------------
    image_input = _clip_preprocess(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        image_features = _clip_model.encode_image(image_input)
        image_features /= image_features.norm(dim=-1, keepdim=True)
        similarities = (100.0 * image_features @ _category_text_features.T).softmax(dim=-1)
        scores = similarities.cpu().numpy()[0]

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
            # A captioning failure shouldn't fail the whole request —
            # the category/confidence result is still usable without
            # a description; the frontend treats description as optional.
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

