import csv
import io
import json
import os
import urllib.error
import urllib.request

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from app.auth import (
    admin_user,
    create_access_token,
    decode_access_token,
    current_user,
    hash_password,
    verify_google_id_token,
    verify_password,
)
from app.database import Base, engine, get_db
from app.models import InterviewAnswer, InterviewSession, User
from app.questions import get_questions_for_position
from app.schemas import (
    AnswerEvaluateOut,
    AnswerSubmit,
    AuthOut,
    FinalReportOut,
    GoogleLoginIn,
    LoginIn,
    QuestionOut,
    RegisterIn,
    SessionCreate,
    SessionOut,
    UserOut,
)
from app.services.evaluation import evaluate_answer
from app.services.gemini import (
    GeminiQuestionGenerationError,
    evaluate_answer_with_gemini,
    generate_interview_questions_with_gemini,
    gemini_enabled,
)
from app.services.report import finalize_session


def ensure_schema():
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "interview_sessions" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("interview_sessions")}
        additions = {
            "user_id": "INTEGER",
            "questions_json": "TEXT",
            "question_source": "VARCHAR(32) DEFAULT 'question_bank'",
        }
        with engine.begin() as conn:
            for name, ddl in additions.items():
                if name not in columns:
                    conn.execute(text(f"ALTER TABLE interview_sessions ADD COLUMN {name} {ddl}"))

    if "interview_answers" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("interview_answers")}
        additions = {
            "coherence_score": "FLOAT DEFAULT 0",
            "fluency_score": "FLOAT DEFAULT 0",
            "focus_score": "FLOAT DEFAULT 0",
            "emotional_clarity_score": "FLOAT DEFAULT 0",
            "confidence_score": "FLOAT DEFAULT 0",
            "confusion_score": "FLOAT DEFAULT 0",
            "camera_enabled": "BOOLEAN DEFAULT 0",
            "face_detected": "BOOLEAN DEFAULT 0",
            "behavior_note": "TEXT",
        }
        with engine.begin() as conn:
            for name, ddl in additions.items():
                if name not in columns:
                    conn.execute(text(f"ALTER TABLE interview_answers ADD COLUMN {name} {ddl}"))


ensure_schema()

app = FastAPI(title="He Thong Mo Phong Phong Van", version="1.0.0")
class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/tts")
def synthesize_speech(body: SpeechRequest, _user: User = Depends(current_user)):
    """Proxy speech synthesis through the backend so the provider key stays private."""
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    if not api_key or not voice_id:
        raise HTTPException(status_code=503, detail="ElevenLabs TTS is not configured")

    payload = json.dumps({
        "text": body.text,
        "model_id": os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5"),
        "language_code": "vi",
    }).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=payload,
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as upstream:
            audio = upstream.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise HTTPException(status_code=502, detail="ElevenLabs rejected the API key") from exc
        if exc.code == 429:
            raise HTTPException(status_code=429, detail="ElevenLabs usage limit reached") from exc
        raise HTTPException(status_code=502, detail="ElevenLabs speech synthesis failed") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail="Could not reach ElevenLabs") from exc
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


def configured_cors_origins() -> list[str]:
    raw_origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )
    return [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def assert_session_access(session: InterviewSession | None, user: User):
    if not session:
        raise HTTPException(404, "Session not found")
    if user.role != "admin" and session.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")


def questions_for_session(session: InterviewSession) -> list[dict]:
    if session.questions_json:
        try:
            questions = json.loads(session.questions_json)
            if isinstance(questions, list) and questions:
                return questions
        except (TypeError, json.JSONDecodeError):
            pass
    return get_questions_for_position(session.position)


@app.get("/api/health")
def health():
    return {"status": "ok", "gemini_enabled": gemini_enabled()}


@app.post("/api/auth/register", response_model=AuthOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    is_first_user = (db.query(func.count(User.id)).scalar() or 0) == 0
    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role="admin" if is_first_user else "user",
        provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthOut(access_token=create_access_token(user), user=user)


@app.post("/api/auth/login", response_model=AuthOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User is inactive")
    return AuthOut(access_token=create_access_token(user), user=user)


@app.post("/api/auth/google", response_model=AuthOut)
def google_login(body: GoogleLoginIn, db: Session = Depends(get_db)):
    profile = verify_google_id_token(body.credential)
    email = profile["email"].strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        is_first_user = (db.query(func.count(User.id)).scalar() or 0) == 0
        user = User(
            name=profile.get("name") or email.split("@", 1)[0],
            email=email,
            password_hash=None,
            role="admin" if is_first_user else "user",
            provider="google",
            google_sub=profile.get("sub"),
        )
        db.add(user)
    else:
        user.google_sub = user.google_sub or profile.get("sub")
    db.commit()
    db.refresh(user)
    return AuthOut(access_token=create_access_token(user), user=user)


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@app.get("/api/admin/users", response_model=list[UserOut])
def list_users(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()


@app.get("/api/positions")
def list_positions():
    from app.questions import QUESTION_BANK

    return {"positions": list(QUESTION_BANK.keys())}


@app.get("/api/questions")
def list_question_bank():
    from app.questions import QUESTION_BANK

    return {"question_bank": QUESTION_BANK}


@app.get("/api/sessions")
def list_sessions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(InterviewSession)
    if user.role != "admin":
        query = query.filter(InterviewSession.user_id == user.id)
    sessions = query.order_by(InterviewSession.started_at.desc(), InterviewSession.id.desc()).all()
    return {"sessions": [SessionOut.model_validate(session).model_dump(mode="json") for session in sessions]}


@app.get("/api/statistics")
def get_statistics(user: User = Depends(current_user), db: Session = Depends(get_db)):
    base_query = db.query(InterviewSession)
    if user.role != "admin":
        base_query = base_query.filter(InterviewSession.user_id == user.id)
    total = base_query.count()
    completed = base_query.filter(InterviewSession.status == "completed").count()
    active = base_query.filter(InterviewSession.status == "active").count()
    avg_score = (
        base_query.with_entities(func.avg(InterviewSession.total_score))
        .filter(InterviewSession.total_score.isnot(None))
        .scalar()
    )
    best_score = (
        base_query.with_entities(func.max(InterviewSession.total_score))
        .filter(InterviewSession.total_score.isnot(None))
        .scalar()
    )
    by_position_rows = (
        base_query.with_entities(InterviewSession.position, func.count(InterviewSession.id))
        .group_by(InterviewSession.position)
        .order_by(func.count(InterviewSession.id).desc())
        .all()
    )
    recent = base_query.order_by(InterviewSession.started_at.desc(), InterviewSession.id.desc()).limit(5).all()
    return {
        "total_sessions": total,
        "completed_sessions": completed,
        "active_sessions": active,
        "average_score": round(float(avg_score), 1) if avg_score is not None else None,
        "best_score": round(float(best_score), 1) if best_score is not None else None,
        "by_position": [
            {"position": position, "count": count} for position, count in by_position_rows
        ],
        "recent_sessions": [
            SessionOut.model_validate(session).model_dump(mode="json") for session in recent
        ],
    }


@app.post("/api/sessions", response_model=SessionOut)
def create_session(body: SessionCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        questions = generate_interview_questions_with_gemini(body.position, body.level)
    except GeminiQuestionGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API đang tạm thời không khả dụng hoặc phản hồi quá chậm. Vui lòng thử lại sau; nếu vẫn lỗi, kiểm tra Render Logs.",
        ) from exc
    question_source = "gemini" if questions else "question_bank"
    if questions is None:
        questions = get_questions_for_position(body.position)
    session = InterviewSession(
        user_id=user.id,
        candidate_name=body.candidate_name,
        position=body.position,
        level=body.level,
        questions_json=json.dumps(questions, ensure_ascii=False),
        question_source=question_source,
        total_questions=len(questions),
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@app.get("/api/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    assert_session_access(session, user)
    return session


@app.get("/api/sessions/{session_id}/questions/{index}", response_model=QuestionOut)
def get_question(session_id: int, index: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    assert_session_access(session, user)
    questions = questions_for_session(session)
    if index < 0 or index >= len(questions):
        raise HTTPException(404, "Question not found")
    q = questions[index]
    return QuestionOut(index=index, group=q["group"], text=q["text"], total=len(questions))


@app.post("/api/sessions/{session_id}/answers/evaluate", response_model=AnswerEvaluateOut)
def submit_and_evaluate(session_id: int, body: AnswerSubmit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    assert_session_access(session, user)
    if session.status != "active":
        raise HTTPException(400, "Session already completed")

    questions = questions_for_session(session)
    if body.question_index < 0 or body.question_index >= len(questions):
        raise HTTPException(400, "Invalid question index")

    q = questions[body.question_index]
    result = evaluate_answer(body.transcript, q.get("keywords", []), q["group"], body.audio_duration)
    gemini_result = evaluate_answer_with_gemini(
        position=session.position,
        level=session.level,
        question_group=q["group"],
        question_text=q["text"],
        expected_keywords=q.get("keywords", []),
        transcript=body.transcript,
        rule_score=result.question_score,
        rule_feedback=result.short_feedback,
        missing_keywords=result.missing_keywords,
    )
    answer_summary = gemini_result.answer_summary if gemini_result and gemini_result.answer_summary else result.answer_summary
    short_feedback = gemini_result.short_feedback if gemini_result and gemini_result.short_feedback else result.short_feedback

    wc = len(body.transcript.split())
    duration = body.audio_duration or 0
    speech_rate = round(wc / (duration / 60), 1) if duration and duration > 0 else None

    existing = (
        db.query(InterviewAnswer)
        .filter(
            InterviewAnswer.session_id == session_id,
            InterviewAnswer.question_index == body.question_index,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    answer = InterviewAnswer(
        session_id=session_id,
        question_index=body.question_index,
        question_group=q["group"],
        question_text=q["text"],
        transcript=body.transcript.strip(),
        answer_summary=answer_summary,
        answer_source=body.answer_source,
        audio_duration=body.audio_duration,
        word_count=wc,
        speech_rate=speech_rate,
        question_score=result.question_score,
        content_score=result.content_score,
        keyword_score=result.keyword_score,
        structure_score=result.structure_score,
        star_score=result.star_score,
        coherence_score=result.coherence_score,
        fluency_score=result.fluency_score,
        focus_score=result.focus_score,
        emotional_clarity_score=result.emotional_clarity_score,
        short_feedback=short_feedback,
        missing_keywords_json=json.dumps(result.missing_keywords, ensure_ascii=False),
    )
    db.add(answer)
    db.commit()

    return AnswerEvaluateOut(
        question_index=body.question_index,
        question_score=result.question_score,
        content_score=result.content_score,
        keyword_score=result.keyword_score,
        structure_score=result.structure_score,
        star_score=result.star_score,
        coherence_score=result.coherence_score,
        fluency_score=result.fluency_score,
        focus_score=result.focus_score,
        emotional_clarity_score=result.emotional_clarity_score,
        short_feedback=short_feedback,
        answer_summary=answer_summary,
        missing_keywords=result.missing_keywords,
        spoken_feedback=short_feedback,
    )


@app.post("/api/sessions/{session_id}/finalize", response_model=FinalReportOut)
def finalize(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    assert_session_access(session, user)
    report = finalize_session(db, session)
    return FinalReportOut(report=report, closing_remarks=report["closing_remarks"])


@app.get("/api/sessions/{session_id}/report")
def get_report(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    assert_session_access(session, user)
    if not session.final_report_json:
        raise HTTPException(404, "Report not ready")
    return json.loads(session.final_report_json)


@app.get("/api/sessions/{session_id}/export")
def export_report(session_id: int, format: str = "json", token: str | None = None, db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    payload = decode_access_token(token)
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    session = db.get(InterviewSession, session_id)
    assert_session_access(session, user)
    if not session.final_report_json:
        raise HTTPException(404, "Report not ready")
    report = json.loads(session.final_report_json)

    if format == "json":
        return Response(
            content=json.dumps(report, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="report-{session_id}.json"'},
        )

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "STT", "Nhom", "Cau hoi", "Tom tat tra loi", "Diem noi dung", "Diem tu khoa",
            "Diem cau truc", "Diem STAR", "Mach lac", "Troi chay", "Trong tam", "Cam xuc", "Diem cau", "Nhan xet",
        ])
        for row in report.get("per_question", []):
            writer.writerow([
                row["stt"], row["group"], row["question"], row["answer_summary"],
                row["content_score"], row["keyword_score"], row["structure_score"],
                row["star_score"], row.get("coherence_score", 0), row.get("fluency_score", 0), row.get("focus_score", 0), row.get("emotional_clarity_score", 0), row["question_score"], row["short_feedback"],
            ])
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="report-{session_id}.csv"'},
        )

    if format == "html":
        html = _render_html_report(report, session_id)
        return HTMLResponse(
            content=html,
            headers={"Content-Disposition": f'attachment; filename="report-{session_id}.html"'},
        )

    raise HTTPException(400, "format must be json, csv, or html")


def _render_html_report(report: dict, session_id: int) -> str:
    info = report["session_info"]
    ov = report["overview"]
    rows = ""
    for r in report.get("per_question", []):
        rows += f"""<tr>
          <td>{r['stt']}</td><td>{r['group']}</td><td>{r['question']}</td>
          <td>{r['answer_summary']}</td><td>{r['content_score']}</td><td>{r['keyword_score']}</td>
          <td>{r['structure_score']}</td><td>{r['star_score']}</td><td>{r['question_score']}</td>
          <td>{r['short_feedback']}</td></tr>"""
    return f"""<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
    <title>Bao cao phong van #{session_id}</title>
    <style>body{{font-family:Segoe UI,sans-serif;margin:2rem}}table{{border-collapse:collapse;width:100%}}
    th,td{{border:1px solid #ccc;padding:8px;font-size:14px}}th{{background:#f0f4f8}}</style></head>
    <body><h1>Báo cáo phỏng vấn</h1>
    <p><b>{info['candidate_name']}</b> — {info['position']} ({info['level']})</p>
    <p>Điểm: <b>{ov['total_score']}/100</b> — {ov['grade_label']}</p>
    <p>{ov['overall_comment']}</p>
    <h2>Chi tiết từng câu</h2><table><tr>
    <th>STT</th><th>Nhóm</th><th>Câu hỏi</th><th>Tóm tắt</th>
    <th>Nội dung</th><th>Từ khóa</th><th>Cấu trúc</th><th>STAR</th><th>Điểm</th><th>Nhận xét</th></tr>{rows}</table></body></html>"""
