"""
The zero-shot prompt set from the pitch: civic categories scored
alongside an explicit "not a civic issue" bucket, so an off-topic photo
(a selfie, food, a meme) is a legitimate top-scoring outcome instead of
being forced into the nearest real category.

Keeping this as a plain, hand-editable list (not something an LLM
generates at runtime) is a deliberate choice from the original design
discussion: predictable, debuggable, and good enough to demo honestly
for a hackathon MVP. Expanding it later is a one-line addition per
category, not a redesign.
"""

CATEGORY_PROMPTS = {
    "road": "a photo of a damaged road or pothole",
    "waste": "a photo of garbage, trash, or overflowing waste on a street",
    "utility": "a photo of a broken streetlight, exposed wiring, or damaged electrical equipment",
    "water": "a photo of waterlogging, flooding, or a blocked drain",
    "vegetation": "a photo of a fallen tree, overgrown vegetation, or a damaged public sign",
    "other": "a photo of some other kind of public infrastructure problem",
    # The reject bucket — not a category, a legitimate model outcome.
    "not_an_issue": "a photo of a person, a selfie, food, a screenshot, or an unrelated personal photo",
}

# If the top-scoring category's confidence doesn't beat the runner-up by
# at least this much, the result is flagged needsManualReview instead of
# being trusted outright — the "confidence-gap thresholding" from the
# pitch, so a marginal call doesn't quietly auto-publish.
CONFIDENCE_GAP_THRESHOLD = 0.08

# Safety filter, stage 1 — deliberately CLIP-based (zero-shot, reusing
# the same model already loaded for category scoring) rather than a
# dedicated NSFW classifier. The earlier design used opennsfw2, which
# pulls in TensorFlow + Keras as a second full ML framework alongside
# PyTorch — on a memory-constrained free-tier host, loading two entire
# frameworks at once caused repeated OOM crashes at startup. This is
# less accurate than a purpose-trained NSFW model, but it's a real,
# working tradeoff for a resource-constrained deploy — one model,
# loaded once, doing both jobs.
SAFETY_PROMPTS = {
    "safe": "a normal, appropriate photograph suitable for public viewing",
    "unsafe": "an explicit, pornographic, graphic, or violent photograph",
}

# If the "unsafe" prompt's score is at or above this, the photo is
# rejected before category scoring ever runs. Deliberately stricter
# than a coin-flip (0.5) — false rejects (a safe photo blocked) just
# mean the user retakes/reselects a photo; false accepts (something
# actually unsafe getting through) are the worse failure mode, so this
# errs toward rejecting more readily.
SAFETY_REJECT_THRESHOLD = 0.4
