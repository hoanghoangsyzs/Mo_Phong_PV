import json
from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import InterviewAnswer, InterviewSession, SessionSkillAnalysis
from app.services.evaluation import grade_from_score
from app.services.gemini import summarize_final_report_with_gemini


SKILL_GROUPS = [
    "Kiến thức chuyên môn",
    "Tư duy giải quyết vấn đề",
    "Khả năng trình bày",
    "Mạch lạc cảm xúc",
    "Độ trôi chảy",
    "Đúng trọng tâm",
    "Giọng nói / thời lượng",
]


def _map_question_group_to_skills(group: str) -> list[str]:
    g = group.lower()
    if "kiến thức" in g or "cơ sở" in g or "bảo mật" in g:
        return ["Kiến thức chuyên môn", "Đúng trọng tâm"]
    if "tư duy" in g or "star" in g:
        return ["Tư duy giải quyết vấn đề", "Khả năng trình bày"]
    if "xử lý" in g or "chất lượng" in g:
        return ["Kiến thức chuyên môn", "Khả năng trình bày"]
    return ["Khả năng trình bày", "Đúng trọng tâm"]


def _avg(values: list[float], fallback: float = 0) -> float:
    return round(sum(values) / len(values), 1) if values else round(fallback, 1)


def build_final_report(session: InterviewSession, answers: list[InterviewAnswer]) -> dict:
    total = round(sum(a.question_score for a in answers) / len(answers), 1) if answers else 0.0
    grade = grade_from_score(total)

    skill_scores: dict[str, list[float]] = defaultdict(list)
    all_missing: list[str] = []
    strengths: list[tuple[str, float]] = []
    weaknesses: list[tuple[str, float]] = []

    for a in answers:
        for skill in _map_question_group_to_skills(a.question_group):
            skill_scores[skill].append(a.question_score)
        skill_scores["Mạch lạc cảm xúc"].append((a.coherence_score + a.emotional_clarity_score) / 2 * 5)
        skill_scores["Độ trôi chảy"].append(a.fluency_score * 5)
        skill_scores["Đúng trọng tâm"].append(a.focus_score * 5)

        if a.missing_keywords_json:
            all_missing.extend(json.loads(a.missing_keywords_json))
        strengths.append((a.question_group, a.question_score))
        if a.question_score < 65:
            weaknesses.append((a.question_text[:60], a.question_score))

        if a.audio_duration and a.audio_duration > 0:
            skill_scores["Giọng nói / thời lượng"].append(min(100, 50 + (a.word_count or 0)))

    skill_analysis = []
    for skill_group in SKILL_GROUPS:
        scores = skill_scores.get(skill_group, [total if answers else 0])
        notes = ""
        if skill_group == "Mạch lạc cảm xúc":
            notes = "Tổng hợp độ mạch lạc trong lập luận và khả năng diễn đạt rõ ràng, ít ngập ngừng."
        skill_analysis.append({"skill_group": skill_group, "score": _avg(scores), "notes": notes})

    strengths.sort(key=lambda x: -x[1])
    weaknesses.sort(key=lambda x: x[1])

    top_strengths = list(dict.fromkeys([s[0] for s in strengths[:5]]))[:3]
    top_weak = list(dict.fromkeys([w[0] for w in weaknesses[:5]]))[:3]
    missing_unique = list(dict.fromkeys(all_missing))[:10]

    overview_comment = (
        f"Ứng viên đạt {total}/100, xếp loại {grade}. "
        f"Hoàn thành {len(answers)}/{session.total_questions} câu hỏi."
    )

    closing = (
        f"Cảm ơn bạn đã tham gia buổi luyện phỏng vấn vị trí {session.position}. "
        f"Điểm tổng {total}, xếp loại {grade}. Hãy xem báo cáo chi tiết và lộ trình cải thiện bên dưới."
    )

    report = {
        "session_info": {
            "candidate_name": session.candidate_name,
            "position": session.position,
            "level": session.level,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "total_questions": session.total_questions,
        },
        "overview": {
            "total_score": total,
            "grade_label": grade,
            "overall_comment": overview_comment,
        },
        "per_question": [
            {
                "stt": i + 1,
                "group": a.question_group,
                "question": a.question_text,
                "answer_summary": a.answer_summary,
                "content_score": a.content_score,
                "keyword_score": a.keyword_score,
                "structure_score": a.structure_score,
                "star_score": a.star_score,
                "coherence_score": a.coherence_score,
                "fluency_score": a.fluency_score,
                "focus_score": a.focus_score,
                "emotional_clarity_score": a.emotional_clarity_score,
                "question_score": a.question_score,
                "short_feedback": a.short_feedback,
            }
            for i, a in enumerate(sorted(answers, key=lambda x: x.question_index))
        ],
        "skill_analysis": skill_analysis,
        "strengths_top3": top_strengths,
        "weaknesses_top3": top_weak,
        "missing_keywords": missing_unique,
        "improvement_roadmap": {
            "topics_to_review": missing_unique[:5] or ["REST API", "SQL Index", "Authentication"],
            "answer_structure": "Luyện trả lời theo STAR hoặc Khái niệm -> Ví dụ -> Kết quả.",
            "project_examples": "Chuẩn bị 2-3 dự án cá nhân có số liệu cụ thể.",
            "clarity_tips": "Rút gọn phần mở đầu, đi thẳng vào định nghĩa, ví dụ và kết quả đo được.",
        },
        "closing_remarks": closing,
    }
    gemini_summary = summarize_final_report_with_gemini(report)
    if gemini_summary:
        if gemini_summary.get("overall_comment"):
            report["overview"]["overall_comment"] = gemini_summary["overall_comment"]
        if gemini_summary.get("closing_remarks"):
            report["closing_remarks"] = gemini_summary["closing_remarks"]
    return report


def persist_skill_analysis(db: Session, session_id: int, skill_analysis: list[dict]) -> None:
    db.query(SessionSkillAnalysis).filter(SessionSkillAnalysis.session_id == session_id).delete()
    for row in skill_analysis:
        db.add(
            SessionSkillAnalysis(
                session_id=session_id,
                skill_group=row["skill_group"],
                score=row["score"],
                notes=row.get("notes") or "",
            )
        )


def finalize_session(db: Session, session: InterviewSession) -> dict:
    answers = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.session_id == session.id)
        .order_by(InterviewAnswer.question_index)
        .all()
    )
    report = build_final_report(session, answers)
    session.ended_at = datetime.utcnow()
    session.total_score = report["overview"]["total_score"]
    session.grade_label = report["overview"]["grade_label"]
    session.overall_comment = report["overview"]["overall_comment"]
    session.closing_remarks = report["closing_remarks"]
    session.final_report_json = json.dumps(report, ensure_ascii=False)
    session.status = "completed"
    persist_skill_analysis(db, session.id, report["skill_analysis"])
    db.commit()
    db.refresh(session)
    return report
