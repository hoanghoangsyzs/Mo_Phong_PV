from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    candidate_name: str = Field(min_length=1, max_length=255)
    position: str = Field(default="Backend Developer")
    level: str = Field(default="Junior")


class SessionOut(BaseModel):
    id: int
    candidate_name: str
    position: str
    level: str
    question_source: str = "question_bank"
    started_at: datetime
    ended_at: datetime | None
    total_questions: int
    total_score: float | None
    grade_label: str | None
    status: str

    model_config = {"from_attributes": True}


class QuestionOut(BaseModel):
    index: int
    group: str
    text: str
    total: int


class AnswerSubmit(BaseModel):
    question_index: int
    transcript: str = Field(min_length=1)
    answer_source: Literal["voice", "text_fallback"] = "voice"
    audio_duration: float | None = None


class AnswerEvaluateOut(BaseModel):
    question_index: int
    question_score: float
    content_score: float
    keyword_score: float
    structure_score: float
    star_score: float
    coherence_score: float
    fluency_score: float
    focus_score: float
    emotional_clarity_score: float
    short_feedback: str
    answer_summary: str
    missing_keywords: list[str]
    spoken_feedback: str


class FinalReportOut(BaseModel):
    report: dict
    closing_remarks: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    provider: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class GoogleLoginIn(BaseModel):
    credential: str = Field(min_length=10)


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
