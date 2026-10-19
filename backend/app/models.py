import json
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user")
    provider: Mapped[str] = mapped_column(String(32), default="local")
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["InterviewSession"]] = relationship(back_populates="user")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    candidate_name: Mapped[str] = mapped_column(String(255))
    position: Mapped[str] = mapped_column(String(255))
    level: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    total_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    grade_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    overall_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    closing_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_report_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")

    user: Mapped["User | None"] = relationship(back_populates="sessions")
    answers: Mapped[list["InterviewAnswer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    skills: Mapped[list["SessionSkillAnalysis"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("interview_sessions.id"))
    question_index: Mapped[int] = mapped_column(Integer)
    question_group: Mapped[str] = mapped_column(String(128))
    question_text: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str] = mapped_column(Text)
    answer_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_source: Mapped[str] = mapped_column(String(32), default="voice")
    audio_duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    speech_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    question_score: Mapped[float] = mapped_column(Float, default=0)
    content_score: Mapped[float] = mapped_column(Float, default=0)
    keyword_score: Mapped[float] = mapped_column(Float, default=0)
    structure_score: Mapped[float] = mapped_column(Float, default=0)
    star_score: Mapped[float] = mapped_column(Float, default=0)
    coherence_score: Mapped[float] = mapped_column(Float, default=0)
    fluency_score: Mapped[float] = mapped_column(Float, default=0)
    focus_score: Mapped[float] = mapped_column(Float, default=0)
    emotional_clarity_score: Mapped[float] = mapped_column(Float, default=0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0)
    confusion_score: Mapped[float] = mapped_column(Float, default=0)
    camera_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    face_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    behavior_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    missing_keywords_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["InterviewSession"] = relationship(back_populates="answers")

    @property
    def missing_keywords(self) -> list[str]:
        if not self.missing_keywords_json:
            return []
        return json.loads(self.missing_keywords_json)


class SessionSkillAnalysis(Base):
    __tablename__ = "session_skill_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("interview_sessions.id"))
    skill_group: Mapped[str] = mapped_column(String(128))
    score: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped["InterviewSession"] = relationship(back_populates="skills")
