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

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${BASE}/tts`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("Speech synthesis unavailable");
  return response.blob();
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
    const body = await res.text();
    throw new Error(formatApiError(body, res.status));
  }
  return res.json() as Promise<T>;
}

const fieldLabels: Record<string, string> = {
  name: "Họ tên", candidate_name: "Họ tên ứng viên", email: "Email", password: "Mật khẩu",
  transcript: "Câu trả lời", question_index: "Câu hỏi", position: "Vị trí luyện tập", level: "Trình độ",
  credential: "Thông tin đăng nhập Google",
};

function validationMessage(item: { type?: string; loc?: unknown[]; ctx?: Record<string, unknown> }): string {
  const field = [...(item.loc ?? [])].reverse().find((part) => typeof part === "string");
  const label = (typeof field === "string" && fieldLabels[field]) || "Thông tin";
  const minimum = item.ctx?.min_length;
  const maximum = item.ctx?.max_length;
  switch (item.type) {
    case "missing": return `Vui lòng nhập ${label.toLowerCase()}.`;
    case "string_too_short":
      if (["Họ tên", "Họ tên ứng viên", "Câu trả lời"].includes(label)) return `Vui lòng nhập ${label.toLowerCase()}.`;
      return typeof minimum === "number" ? `${label} cần có ít nhất ${minimum} ký tự.` : `${label} chưa hợp lệ.`;
    case "string_too_long": return typeof maximum === "number" ? `${label} không được vượt quá ${maximum} ký tự.` : `${label} quá dài.`;
    case "email":
    case "value_error": return label === "Email" ? "Vui lòng nhập địa chỉ email hợp lệ." : `${label} chưa hợp lệ.`;
    case "int_parsing":
    case "float_parsing":
    case "literal_error": return `${label} không hợp lệ.`;
    default: return `${label} chưa hợp lệ.`;
  }
}

function formatApiError(body: string, status: number): string {
  let detail: unknown;
  try { detail = (JSON.parse(body) as { detail?: unknown })?.detail; } catch { /* body is not JSON */ }
  if (Array.isArray(detail)) return detail.map((item) => validationMessage(item)).join(" ");
  if (typeof detail === "string") {
    const known: Record<string, string> = {
      "Email already registered": "Email này đã được đăng ký.",
      "Invalid email or password": "Email hoặc mật khẩu không đúng.",
      "User is inactive": "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      "Session not found": "Không tìm thấy buổi phỏng vấn.", "Not allowed": "Bạn không có quyền thực hiện thao tác này.",
      "Question not found": "Không tìm thấy câu hỏi.", "Session already completed": "Buổi phỏng vấn đã hoàn tất.",
      "Invalid question index": "Câu hỏi không hợp lệ.", "Report not ready": "Báo cáo chưa sẵn sàng.",
      "Missing token": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      "Invalid token": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      "Invalid export format": "Định dạng xuất báo cáo không hợp lệ.",
      "Gemini API đang tạm thời không khả dụng hoặc phản hồi quá chậm. Vui lòng thử lại sau; nếu vẫn lỗi, kiểm tra Render Logs.": "Gemini hiện không phản hồi được. Hãy thử lại sau; nếu lỗi tiếp diễn, kiểm tra Render Logs.",
    };
    if (known[detail]) return known[detail];
  }
  if (status === 401) return "Email hoặc mật khẩu không đúng, hoặc phiên đăng nhập đã hết hạn.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy dữ liệu được yêu cầu.";
  if (status >= 500) return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
  return "Yêu cầu chưa hợp lệ. Vui lòng kiểm tra lại thông tin và thử lại.";
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
