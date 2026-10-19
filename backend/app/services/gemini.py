import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "12"))


@dataclass
class GeminiEvaluation:
    short_feedback: str | None = None
    answer_summary: str | None = None
    strengths: list[str] | None = None
    improvements: list[str] | None = None


def gemini_enabled() -> bool:
    return bool(GEMINI_API_KEY and GEMINI_MODEL)


def _extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()


def _json_from_text(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        return {}
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _generate_json(prompt: str) -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.35,
            "responseMimeType": "application/json",
        },
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=GEMINI_TIMEOUT_SECONDS) as response:
        raw = response.read().decode("utf-8")
    return _json_from_text(_extract_text(json.loads(raw)))


def evaluate_answer_with_gemini(
    *,
    position: str,
    level: str,
    question_group: str,
    question_text: str,
    expected_keywords: list[str],
    transcript: str,
    rule_score: float,
    rule_feedback: str,
    missing_keywords: list[str],
) -> GeminiEvaluation | None:
    if not gemini_enabled():
        return None

    prompt = f"""
Bạn là chuyên gia tuyển dụng và mentor phỏng vấn kỹ thuật.
Hãy đánh giá câu trả lời của ứng viên bằng tiếng Việt, ngắn gọn, công bằng, có tính hướng dẫn.

Thông tin:
- Vị trí: {position}
- Level: {level}
- Nhóm câu hỏi: {question_group}
- Câu hỏi: {question_text}
- Từ khóa kỳ vọng: {", ".join(expected_keywords) or "Không có"}
- Transcript của ứng viên: {transcript}
- Điểm rule-based hiện tại: {rule_score}/100
- Nhận xét rule-based hiện tại: {rule_feedback}
- Từ khóa còn thiếu: {", ".join(missing_keywords) or "Không có"}

Trả về đúng JSON object với schema:
{{
  "answer_summary": "Tóm tắt câu trả lời trong 1 câu.",
  "short_feedback": "Nhận xét 2-3 câu, nêu điểm tốt và cách cải thiện cụ thể.",
  "strengths": ["tối đa 2 ý mạnh"],
  "improvements": ["tối đa 2 ý cần cải thiện"]
}}
Không bịa kinh nghiệm ngoài transcript. Không dùng markdown.
""".strip()

    try:
        data = _generate_json(prompt)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None

    return GeminiEvaluation(
        short_feedback=str(data.get("short_feedback") or "").strip() or None,
        answer_summary=str(data.get("answer_summary") or "").strip() or None,
        strengths=[str(v).strip() for v in data.get("strengths", []) if str(v).strip()][:2]
        if isinstance(data.get("strengths"), list)
        else None,
        improvements=[str(v).strip() for v in data.get("improvements", []) if str(v).strip()][:2]
        if isinstance(data.get("improvements"), list)
        else None,
    )


def summarize_final_report_with_gemini(report: dict[str, Any]) -> dict[str, str] | None:
    if not gemini_enabled():
        return None

    overview = report.get("overview", {})
    session_info = report.get("session_info", {})
    per_question = report.get("per_question", [])
    compact_questions = [
        {
            "group": row.get("group"),
            "question_score": row.get("question_score"),
            "short_feedback": row.get("short_feedback"),
        }
        for row in per_question[:8]
    ]
    prompt = f"""
Bạn là mentor phỏng vấn kỹ thuật. Hãy viết nhận xét cuối buổi bằng tiếng Việt,
ngắn gọn, tích cực nhưng không tâng bốc.

Thông tin phiên:
- Ứng viên: {session_info.get("candidate_name")}
- Vị trí: {session_info.get("position")}
- Level: {session_info.get("level")}
- Điểm tổng: {overview.get("total_score")}/100
- Xếp loại: {overview.get("grade_label")}
- Điểm mạnh top 3: {", ".join(report.get("strengths_top3", [])) or "Không có"}
- Điểm yếu top 3: {", ".join(report.get("weaknesses_top3", [])) or "Không có"}
- Từ khóa còn thiếu: {", ".join(report.get("missing_keywords", [])) or "Không có"}
- Tóm tắt từng câu: {json.dumps(compact_questions, ensure_ascii=False)}

Trả về đúng JSON object:
{{
  "overall_comment": "2 câu nhận xét tổng quan, có điểm số và hướng cải thiện chính.",
  "closing_remarks": "1-2 câu lời kết để đọc bằng giọng nói cho ứng viên."
}}
Không dùng markdown.
""".strip()

    try:
        data = _generate_json(prompt)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None

    overall_comment = str(data.get("overall_comment") or "").strip()
    closing_remarks = str(data.get("closing_remarks") or "").strip()
    if not overall_comment and not closing_remarks:
        return None
    return {
        "overall_comment": overall_comment,
        "closing_remarks": closing_remarks,
    }

