import type {
  AuthResponse,
  DashboardStatistics,
  EvaluateResult,
  FinalReport,
  Question,
  QuestionBank,
  Session,
  User,
} from "../types";

const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "interview_ai_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function register(body: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const data = await json<AuthResponse>(
    await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  setToken(data.access_token);
  return data;
}

export async function login(body: { email: string; password: string }): Promise<AuthResponse> {
  const data = await json<AuthResponse>(
    await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  setToken(data.access_token);
  return data;
}

export async function googleLogin(credential: string): Promise<AuthResponse> {
  const data = await json<AuthResponse>(
    await fetch(`${BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    })
  );
  setToken(data.access_token);
  return data;
}

export async function fetchMe(): Promise<User> {
  return json(await fetch(`${BASE}/auth/me`, { headers: authHeaders() }));
}

export async function fetchUsers(): Promise<User[]> {
  return json(await fetch(`${BASE}/admin/users`, { headers: authHeaders() }));
}

export function logout() {
  setToken(null);
}

export async function fetchStatistics(): Promise<DashboardStatistics> {
  return json(await fetch(`${BASE}/statistics`, { headers: authHeaders() }));
}

export async function fetchSessions(): Promise<Session[]> {
  const data = await json<{ sessions: Session[] }>(await fetch(`${BASE}/sessions`, { headers: authHeaders() }));
  return data.sessions;
}

export async function fetchQuestionBank(): Promise<QuestionBank> {
  const data = await json<{ question_bank: QuestionBank }>(await fetch(`${BASE}/questions`));
  return data.question_bank;
}

export async function fetchReport(sessionId: number): Promise<FinalReport> {
  return json(await fetch(`${BASE}/sessions/${sessionId}/report`, { headers: authHeaders() }));
}

export async function fetchPositions(): Promise<string[]> {
  const data = await json<{ positions: string[] }>(await fetch(`${BASE}/positions`));
  return data.positions;
}

export async function createSession(body: {
  candidate_name: string;
  position: string;
  level: string;
}): Promise<Session> {
  return json(
    await fetch(`${BASE}/sessions`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function fetchQuestion(sessionId: number, index: number): Promise<Question> {
  return json(await fetch(`${BASE}/sessions/${sessionId}/questions/${index}`, { headers: authHeaders() }));
}

export async function evaluateAnswer(
  sessionId: number,
  body: {
    question_index: number;
    transcript: string;
    answer_source: "voice" | "text_fallback";
    audio_duration?: number;
  }
): Promise<EvaluateResult> {
  return json(
    await fetch(`${BASE}/sessions/${sessionId}/answers/evaluate`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function finalizeSession(
  sessionId: number
): Promise<{ report: FinalReport; closing_remarks: string }> {
  return json(
    await fetch(`${BASE}/sessions/${sessionId}/finalize`, {
      method: "POST",
      headers: authHeaders(),
    })
  );
}

export function exportUrl(sessionId: number, format: "json" | "csv" | "html"): string {
  const token = getToken();
  return `${BASE}/sessions/${sessionId}/export?format=${format}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
}

