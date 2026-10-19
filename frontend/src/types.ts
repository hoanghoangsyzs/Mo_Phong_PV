export type InterviewPhase =
  | "idle"
  | "AI_ASKING"
  | "WAITING_ANSWER"
  | "RECORDING"
  | "TRANSCRIBING"
  | "REVIEW_TRANSCRIPT"
  | "EVALUATING"
  | "AI_FEEDBACK_SPEAKING"
  | "FINAL_REPORT";

export interface Session {
  id: number;
  candidate_name: string;
  position: string;
  level: string;
  started_at: string;
  ended_at: string | null;
  total_questions: number;
  total_score: number | null;
  grade_label: string | null;
  status: string;
}

export interface Question {
  index: number;
  group: string;
  text: string;
  total: number;
}

export interface EvaluateResult {
  question_index: number;
  question_score: number;
  content_score: number;
  keyword_score: number;
  structure_score: number;
  star_score: number;
  coherence_score: number;
  fluency_score: number;
  focus_score: number;
  emotional_clarity_score: number;
  short_feedback: string;
  answer_summary: string;
  missing_keywords: string[];
  spoken_feedback: string;
}

export interface FinalReport {
  session_info: Record<string, unknown>;
  overview: {
    total_score: number;
    grade_label: string;
    overall_comment: string;
  };
  per_question: Array<Record<string, unknown>>;
  skill_analysis: Array<{ skill_group: string; score: number; notes: string }>;
  strengths_top3: string[];
  weaknesses_top3: string[];
  missing_keywords: string[];
  improvement_roadmap: Record<string, string | string[]>;
  closing_remarks: string;
}

export interface DashboardStatistics {
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  average_score: number | null;
  best_score: number | null;
  by_position: Array<{ position: string; count: number }>;
  recent_sessions: Session[];
}

export interface QuestionBankItem {
  group: string;
  text: string;
  keywords: string[];
  difficulty?: "Dễ" | "Trung bình" | "Khó" | string;
  answer_tips?: string[];
  sample_answer?: string;
}

export type QuestionBank = Record<string, QuestionBankItem[]>;

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin" | string;
  provider: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
