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
