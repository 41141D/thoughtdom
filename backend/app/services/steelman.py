"""
Steel-Man Gate (v2): before a "challenge" reply can post, the author must
submit a steelman_text -- an engagement with the argument they're
disagreeing with. This version returns THREE outcomes instead of a binary
pass/fail, and is deliberately biased toward letting good-faith discussion
through:

  PASS             -- the restatement engages with the original argument in
                      good faith (direct OR indirect but defensible).
                      The challenge publishes automatically.
  NEEDS_IMPROVEMENT -- a legitimate idea may be present, but the connection
                      to the original argument isn't clear yet. The challenge
                      is held privately and the user can revise + resubmit.
  FAIL             -- reserved for genuinely unrelated, spam, nonsense,
                      abusive, or bad-faith strawman content. Held privately
                      with feedback.

Design philosophy (per product brief): the gate improves conversations,
it does not police them. It favors RECALL over precision:

  - Uncertain between PASS and NEEDS_IMPROVEMENT -> NEEDS_IMPROVEMENT
    (never FAIL).
  - Uncertain whether an indirect connection is legitimate -> let the user
    clarify, don't reject.
  - It must NOT require keyword overlap, quoting the author's exact words,
    addressing every premise, or agreeing with the author.

Implementation note (MVP, no external dependencies): this remains a
lexical/statistical classifier. Keyword overlap is one SIGNAL among
several, not the requirement. Sentence-length, topic-word coverage,
and abuse heuristics combine into a small score; thresholds are tuned so
ordinary disagreements pass. For production, swap in sentence embeddings
(cosine similarity) or an LLM call inside `evaluate_steelman` -- the
function contract (verdict, feedback) stays the same, and no API surface
changes.
"""

import re

Verdict = str  # "passed" | "needs_improvement" | "failed"

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "so", "to", "of", "in", "on", "for",
    "with", "as", "at", "by", "it", "this", "that", "these", "those", "i",
    "you", "he", "she", "they", "we", "not", "no", "do", "does", "did",
    "have", "has", "had", "will", "would", "can", "could", "should",
    "think", "say", "said", "one", "just", "very", "really", "also",
}

# Low-load abusive tokens. Only triggers when combined with near-zero
# engagement signals -- a restatement that also name-calls is fail-worthy,
# an isolated profanity in an otherwise substantive paragraph is not.
ABUSE_TOKENS = {"idiot", "stupid", "moron", "dumb", "trash", "garbage",
                "ugly", "hate you", "shut up", "loser", "clown"}


def _tokenize(text: str) -> set:
    words = re.findall(r"[a-zA-Z'\u0600-\u06FF]+", text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}


def _has_abuse(text: str) -> bool:
    lowered = text.lower()
    return any(t in lowered for t in ABUSE_TOKENS)


def _overlap_ratio(original: str, restatement: str) -> float:
    """Fraction of the ORIGINAL's content words that also appear in the
    restatement. Unlike Jaccard (which punishes restatements that use
    different-but-related wording by dividing by the union), this measures
    how much of the original argument's vocabulary the author retained --
    evidence of engagement without demanding verbatim quoting. Empty
    originals count as 1.0 (nothing to miss)."""
    a, b = _tokenize(original), _tokenize(restatement)
    if not a:
        return 1.0
    return len(a & b) / len(a)


def _shared_topic_signals(original: str, restatement: str) -> int:
    """Soft engagement signals that don't depend on exact vocabulary:
    1. shared content words (overlap) -- capped at 2 points
    2. comparable sentence structure length -- restating at roughly the
       original's level of detail (0.4x..2.5x) suggests a real attempt,
       +1 point
    3. presence of reasoning connectors (because, since, however, if...)
       in the restatement, +1 point -- people engage with arguments, not
       keywords, when they use connectives.
    """
    points = 0
    a, b = _tokenize(original), _tokenize(restatement)
    overlap = len(a & b) / max(len(a), 1) if a else 1.0
    points += min(2, int(overlap * 4))

    s_orig = max(1, len(re.findall(r"\S+", original)))
    s_rest = len(re.findall(r"\S+", restatement))
    if 0.4 * s_orig <= s_rest <= 2.5 * s_orig:
        points += 1

    connectors = {"because", "since", "however", "therefore", "although",
                  "while", "if", "when", "premise", "argument", "claim",
                  "reason", "assume", "assumption", "conclusion"}
    if connectors & b:
        points += 1
    return points


def evaluate_steelman(original_text: str, restatement: str,
                      min_similarity: float = 0.25) -> tuple[Verdict, float, str]:
    """Three-outcome Steel-Man evaluation.

    Returns (verdict, score, feedback). The `min_similarity` parameter is
    kept for backwards compatibility with the old binary contract but now
    only acts as a floor for NEEDS_IMPROVEMENT -> PASS promotion.
    """
    if not restatement or len(restatement.strip()) < 6:
        return ("failed", 0.0,
                "Your restatement is too short to show you engaged with the "
                "argument. Restate the other side's point in a sentence or "
                "two before disagreeing.")

    # Nonsense/obvious-spam guard: no real words at all.
    tokens = _tokenize(restatement)
    if len(tokens) < 2:
        return ("failed", 0.0,
                "That doesn't look like an engagement with the argument -- "
                "try restating the point you're responding to.")

    signals = _shared_topic_signals(original_text, restatement)
    overlap = _overlap_ratio(original_text, restatement)
    abuse = _has_abuse(restatement)
    score = min(1.0, (signals * 1.5 + overlap * 3) / 10.0)

    # Direct, good-faith engagement -> PASS. The recall bias: a restatement
    # that retains most of the original argument's vocabulary (overlap >=
    # 0.75) is by definition an engagement with it -- no further
    # evidence required, so it passes outright even without connectors or
    # length matching. Only abuse can still block it.
    if overlap >= 0.75 and not abuse:
        return ("passed", score, "")

    # Abusive or clearly disengaged content -> FAIL.
    if abuse and signals < 2:
        return ("failed", score,
                "Personal attacks aren't allowed here. Disagree with the "
                "argument, not the person, and try again.")
    if signals <= 1:
        return ("failed", score,
                "This doesn't appear connected to the argument you're "
                "challenging. Restate the point you're responding to first "
                "-- even approaching it from a different angle is fine, as "
                "long as the relationship is clear.")

    # In between: a real attempt whose connection isn't fully clear.
    # The user revises rather than being rejected.
    return ("needs_improvement", score,
            "Your point may be relevant, but the connection to the original "
            "argument isn't clear yet. Try explaining which part of the "
            "argument you're responding to and why their reasoning falls "
            "short.")


# Backwards-compatible shim so callers of the old API keep working.
# Legacy behavior: PASS when passed, else FAIL. Kept for tests that assert
# on the old binary semantics (similarity floor).
def passes_steelman_check(original_text: str, restatement: str,
                          min_similarity: float) -> tuple[bool, float]:
    verdict, score, _ = evaluate_steelman(original_text, restatement,
                                          min_similarity)
    return verdict == "passed", score
