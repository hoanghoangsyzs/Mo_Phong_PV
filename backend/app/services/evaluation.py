import re
from dataclasses import dataclass


@dataclass
class EvaluationResult:
    content_score: float
    keyword_score: float
    structure_score: float
    star_score: float
    coherence_score: float
    fluency_score: float
    focus_score: float
    emotional_clarity_score: float
    question_score: float
    short_feedback: str
    answer_summary: str
    missing_keywords: list[str]


STAR_MARKERS = ["situation", "task", "action", "result", "tình huống", "nhiệm vụ", "hành động", "kết quả"]
STRUCTURE_MARKERS = ["đầu tiên", "thứ hai", "cuối cùng", "bước", "vì vậy", "tóm lại", "first", "then", "finally"]
FILLER_WORDS = ["ờ", "ừ", "ừm", "umm", "uh", "kiểu", "nói chung là", "thì là", "à", "hmm"]
CONFIDENCE_MARKERS = ["tôi đã", "tôi từng", "trong dự án", "kết quả", "giải pháp", "tôi chọn", "vì", "do đó"]


def _clamp(v: float, lo: float = 0, hi: float = 20) -> float:
    return max(lo, min(hi, v))


def _word_count(text: str) -> int:
    parts = re.findall(r"\w+", text, flags=re.UNICODE)
    return len(parts)


def summarize_answer(transcript: str, max_words: int = 40) -> str:
    words = transcript.strip().split()
    if len(words) <= max_words:
        return transcript.strip()
    return " ".join(words[:max_words]) + "..."


def evaluate_answer(
    transcript: str,
    expected_keywords: list[str],
    question_group: str,
    audio_duration: float | None = None,
) -> EvaluationResult:
    text = transcript.strip()
    lower = text.lower()
    wc = _word_count(text)

    if wc < 15:
        content = 8.0
    elif wc < 40:
        content = 14.0
    elif wc < 120:
        content = 18.0
    else:
        content = 16.0

    if expected_keywords:
        hits = sum(1 for kw in expected_keywords if kw.lower() in lower)
        ratio = hits / len(expected_keywords)
        keyword = _clamp(ratio * 20)
        missing = [kw for kw in expected_keywords if kw.lower() not in lower]
    else:
        ratio = 0.65
        keyword = 14.0
        missing = []

    struct_hits = sum(1 for m in STRUCTURE_MARKERS if m in lower)
    sentence_count = max(1, len([s for s in re.split(r"[.!?。]\s*", text) if s.strip()]))
    structure = _clamp(10 + struct_hits * 2.5)
    coherence = _clamp(8 + struct_hits * 2 + min(sentence_count, 4) * 1.2 + (2 if wc >= 35 else 0))

    if "STAR" in question_group or "ví dụ" in question_group.lower() or "tình huống" in question_group.lower():
        star_hits = sum(1 for m in STAR_MARKERS if m in lower)
        star = _clamp(star_hits * 5)
    else:
        star = _clamp(12 + (2 if wc > 30 else 0))

    filler_hits = sum(lower.count(word) for word in FILLER_WORDS)
    if audio_duration and audio_duration > 0:
        words_per_minute = wc / (audio_duration / 60)
        pace_score = 20 - min(8, abs(words_per_minute - 125) / 18)
    else:
        pace_score = 13 + (3 if 25 <= wc <= 120 else 0)
    fluency = _clamp(pace_score - min(6, filler_hits * 1.5))

    focus = _clamp(keyword * 0.65 + content * 0.35 + (1.5 if wc >= 25 else 0))
    confidence_hits = sum(1 for marker in CONFIDENCE_MARKERS if marker in lower)
    emotional_clarity = _clamp(10 + min(4, confidence_hits) * 1.7 + (fluency - 10) * 0.35 - min(4, filler_hits))

    question_score = round(
        (
            focus * 0.28
            + coherence * 0.22
            + fluency * 0.2
            + keyword * 0.15
            + star * 0.1
            + emotional_clarity * 0.05
        ) * 5,
        1,
    )

    if question_score >= 85:
        tone = "Câu trả lời khá đầy đủ, đúng trọng tâm và diễn đạt tự tin."
    elif question_score >= 70:
        tone = "Bạn nắm được ý chính; nên bổ sung ví dụ cụ thể và nhấn mạnh kết quả hơn."
    elif question_score >= 50:
        tone = "Cần đi sâu thêm vào khái niệm, từ khóa chuyên môn và trình bày mạch lạc hơn."
    else:
        tone = "Câu trả lời còn ngắn hoặc thiếu trọng tâm; hãy ôn lại phần này và luyện nói theo bố cục rõ ràng."

    if missing[:2]:
        tone += f" Gợi ý nhắc thêm: {', '.join(missing[:2])}."

    short_feedback = ". ".join([s.strip() for s in re.split(r"[.!?]", tone) if s.strip()][:3])
    if not short_feedback.endswith("."):
        short_feedback += "."

    return EvaluationResult(
        content_score=round(content, 1),
        keyword_score=round(keyword, 1),
        structure_score=round(structure, 1),
        star_score=round(star, 1),
        coherence_score=round(coherence, 1),
        fluency_score=round(fluency, 1),
        focus_score=round(focus, 1),
        emotional_clarity_score=round(emotional_clarity, 1),
        question_score=round(question_score, 1),
        short_feedback=short_feedback,
        answer_summary=summarize_answer(text),
        missing_keywords=missing,
    )


def grade_from_score(total: float) -> str:
    if total < 50:
        return "Cần cải thiện"
    if total < 65:
        return "Đạt cơ bản"
    if total < 80:
        return "Khá"
    return "Tốt"
