import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  createSession,
  fetchMe,
  evaluateAnswer,
  fetchPositions,
  fetchQuestion,
  fetchQuestionBank,
  fetchReport,
  fetchSessions,
  fetchStatistics,
  fetchUsers,
  googleLogin,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  finalizeSession,
} from "./api/client";
import { Avatar } from "./components/Avatar";
import { FinalReportView } from "./components/FinalReportView";
import { StatusBadge } from "./components/StatusBadge";
import { UserCamera } from "./components/UserCamera";
import { useSpeech } from "./hooks/useSpeech";
import type {
  DashboardStatistics,
  FinalReport,
  InterviewPhase,
  Question,
  QuestionBank,
  Session,
  User,
} from "./types";

const LEVELS = ["Intern", "Junior", "Middle", "Senior"];
const SIDEBAR_ITEMS = [
  "Overview",
  "Mock Interview",
  "Interview Records",
  "Resumes",
  "Job Descriptions",
  "Prepared Answers",
  "Reports",
  "Account",
] as const;

type Page = (typeof SIDEBAR_ITEMS)[number];

type AppShellProps = {
  activePage: Page;
  children: ReactNode;
  onNavigate: (page: Page) => void;
  title?: string;
};

function AppShell({ activePage, children, onNavigate, title = "Mock Interview" }: AppShellProps) {
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <span>InterviewAI</span>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onNavigate(item)}
              className={`side-nav__item${item === activePage ? " side-nav__item--active" : ""}`}
            >
              <span className="side-nav__icon" aria-hidden>
                {item.slice(0, 1)}
              </span>
              {item}
            </button>
          ))}
        </nav>

        <div className="user-card">
          <div className="user-avatar">U</div>
          <div>
            <strong>{title === "Mock Interview" ? "Ứng viên" : title}</strong>
            <small>student@demo.local</small>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <h1>{activePage}</h1>
          <div className="topbar-actions">
            <span className="language-dot" aria-hidden />
            <span>VI</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleString("vi-VN");
}

function scoreText(value: number | null | undefined) {
  return value == null ? "--" : `${Math.round(value)}/100`;
}

function OverviewPage({ stats, sessions, onOpenReport, onStart }: {
  stats: DashboardStatistics | null;
  sessions: Session[];
  onOpenReport: (session: Session) => void;
  onStart: () => void;
}) {
  const recent = stats?.recent_sessions ?? sessions.slice(0, 5);
  return (
    <section className="mock-page">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">AI interview coach</p>
          <h2>Luyện phỏng vấn lập trình viên bằng giọng nói</h2>
          <p>Theo dõi tiến độ, điểm số, ngân hàng câu hỏi và báo cáo luyện tập trong một dashboard.</p>
        </div>
        <button type="button" className="btn primary" onClick={onStart}>Bắt đầu luyện tập</button>
      </div>

      <div className="metric-grid">
        <Metric label="Tổng phiên" value={stats?.total_sessions ?? sessions.length} />
        <Metric label="Đã hoàn thành" value={stats?.completed_sessions ?? sessions.filter((s) => s.status === "completed").length} />
        <Metric label="Điểm trung bình" value={scoreText(stats?.average_score)} />
        <Metric label="Điểm cao nhất" value={scoreText(stats?.best_score)} />
      </div>

      <div className="grid-2 dashboard-section">
        <div className="card">
          <h3>Phiên gần đây</h3>
          <div className="record-list">
            {recent.length === 0 && <p className="muted">Chưa có phiên phỏng vấn nào.</p>}
            {recent.map((item) => (
              <button key={item.id} type="button" className="record-row" onClick={() => onOpenReport(item)}>
                <span>
                  <strong>{item.candidate_name}</strong>
                  <small>{item.position} · {formatDate(item.started_at)}</small>
                </span>
                <em>{item.grade_label ?? item.status}</em>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Phân bố vị trí luyện tập</h3>
          <div className="bar-list">
            {(stats?.by_position ?? []).length === 0 && <p className="muted">Chưa có dữ liệu thống kê.</p>}
            {(stats?.by_position ?? []).map((row) => (
              <div key={row.position} className="bar-row">
                <span>{row.position}</span>
                <div><i style={{ width: `${Math.min(100, row.count * 18)}%` }} /></div>
                <b>{row.count}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordsPage({ sessions, onOpenReport }: { sessions: Session[]; onOpenReport: (session: Session) => void }) {
  return (
    <section className="mock-page">
      <div className="section-title"><h2>Lịch sử phỏng vấn</h2><p>Xem trạng thái, điểm số và mở báo cáo của từng phiên.</p></div>
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Ứng viên</th><th>Vị trí</th><th>Trình độ</th><th>Ngày tạo</th><th>Trạng thái</th><th>Điểm</th><th></th></tr></thead>
            <tbody>
              {sessions.map((item) => (
                <tr key={item.id}>
                  <td>#{item.id}</td><td>{item.candidate_name}</td><td>{item.position}</td><td>{item.level}</td>
                  <td>{formatDate(item.started_at)}</td><td>{item.status}</td><td>{scoreText(item.total_score)}</td>
                  <td><button type="button" className="btn secondary compact" onClick={() => onOpenReport(item)}>Mở</button></td>
                </tr>
              ))}
              {sessions.length === 0 && <tr><td colSpan={8}>Chưa có dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ResumePage() {
  return (
    <section className="mock-page">
      <div className="section-title"><h2>Hồ sơ ứng viên</h2><p>Chuẩn bị profile để phỏng vấn đúng định hướng lập trình viên.</p></div>
      <div className="grid-2">
        <div className="card form-card">
          <label>Họ tên<input placeholder="Nguyễn Văn A" /></label>
          <label>Vị trí mục tiêu<input placeholder="Backend Developer Intern" /></label>
          <label>Kỹ năng chính<textarea placeholder="Java, Spring Boot, SQL, REST API, Git" /></label>
          <button className="btn primary" type="button">Lưu hồ sơ demo</button>
        </div>
        <div className="card checklist-card">
          <h3>Checklist CV lập trình viên</h3>
          <ul>
            <li>Có dự án cá nhân hoặc đồ án nổi bật.</li>
            <li>Mô tả công nghệ, vai trò và kết quả đo được.</li>
            <li>Nêu rõ GitHub, demo, kỹ năng database/API/testing.</li>
            <li>Chuẩn bị ví dụ STAR cho các câu hỏi hành vi.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function QuestionBankPage({ bank }: { bank: QuestionBank }) {
  const roles = Object.keys(bank);
  const [selectedRole, setSelectedRole] = useState(roles[0] ?? "Backend Developer");
  const questions = bank[selectedRole] ?? [];
  useEffect(() => {
    if (!bank[selectedRole] && roles[0]) setSelectedRole(roles[0]);
  }, [bank, roles, selectedRole]);
  return (
    <section className="mock-page">
      <div className="section-title"><h2>Job Descriptions & Question Bank</h2><p>Ngân hàng câu hỏi theo vị trí và nhóm kỹ năng CNTT.</p></div>
      <div className="start-panel compact-panel">
        <label>Vị trí<select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
      </div>
      <div className="question-list">
        {questions.map((q, idx) => (
          <article key={`${q.text}-${idx}`} className="question-item">
            <div className="question-item__meta">
              <span className="pill pill--blue">{q.group}</span>
              <span className="pill pill--muted">Độ khó: {q.difficulty ?? "Trung bình"}</span>
            </div>
            <h3>{q.text}</h3>
            <p><b>Từ khóa:</b> {q.keywords.join(" · ")}</p>
            {q.answer_tips && q.answer_tips.length > 0 && (
              <ul className="tips-list">
                {q.answer_tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            )}
            {q.sample_answer && (
              <details className="sample-answer">
                <summary>Cách trả lời mẫu</summary>
                <p>{q.sample_answer}</p>
              </details>
            )}
          </article>
        ))}
        {questions.length === 0 && <div className="card">Chưa tải được ngân hàng câu hỏi.</div>}
      </div>
    </section>
  );
}

function PreparedAnswersPage({ bank }: { bank: QuestionBank }) {
  const firstRole = Object.keys(bank)[0];
  const samples = firstRole ? bank[firstRole].slice(0, 4) : [];
  return (
    <section className="mock-page">
      <div className="section-title"><h2>Prepared Answers</h2><p>Gợi ý cấu trúc trả lời trước khi vào phiên phỏng vấn.</p></div>
      <div className="grid-2">
        {samples.map((q, idx) => (
          <div key={q.text} className="card answer-card">
            <span className="pill pill--blue">Mẫu {idx + 1}</span>
            <h3>{q.text}</h3>
            {q.answer_tips && q.answer_tips.length > 0 ? (
              <ul className="tips-list">
                {q.answer_tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            ) : (
              <>
                <p><b>Mở ý:</b> định nghĩa ngắn gọn khái niệm chính.</p>
                <p><b>Thân ý:</b> nêu kinh nghiệm dự án, công nghệ và trade-off.</p>
                <p><b>Kết:</b> liên hệ với kết quả hoặc bài học.</p>
              </>
            )}
            {q.sample_answer && <p><b>Mẫu:</b> {q.sample_answer}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportsPage({ sessions, selectedReport, selectedReportId, onOpenReport }: {
  sessions: Session[];
  selectedReport: FinalReport | null;
  selectedReportId: number | null;
  onOpenReport: (session: Session) => void;
}) {
  const completed = sessions.filter((s) => s.status === "completed" || s.total_score != null);
  return (
    <section className="mock-page">
      <div className="section-title"><h2>Báo cáo đánh giá</h2><p>Tổng hợp điểm, nhận xét và file xuất báo cáo.</p></div>
      {!selectedReport && (
        <div className="card">
          <h3>Chọn phiên đã hoàn thành</h3>
          <div className="record-list">
            {completed.map((item) => (
              <button key={item.id} type="button" className="record-row" onClick={() => onOpenReport(item)}>
                <span><strong>{item.candidate_name}</strong><small>{item.position} · {formatDate(item.ended_at ?? item.started_at)}</small></span>
                <em>{scoreText(item.total_score)}</em>
              </button>
            ))}
            {completed.length === 0 && <p className="muted">Chưa có báo cáo hoàn thành.</p>}
          </div>
        </div>
      )}
      {selectedReport && selectedReportId && <FinalReportView sessionId={selectedReportId} report={selectedReport} />}
    </section>
  );
}

function AccountPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== "admin") return;
    fetchUsers().then(setUsers).catch((e) => setAdminError(errorText(e, "Không tải được danh sách người dùng.")));
  }, [user.role]);

  return (
    <section className="mock-page">
      <div className="section-title"><h2>Tài khoản & cài đặt</h2><p>Cấu hình trải nghiệm luyện phỏng vấn local.</p></div>
      <div className="grid-2">
        <div className="card form-card">
          <h3>{user.name}</h3>
          <p className="muted">{user.email}</p>
          <p><b>Quyền:</b> {user.role}</p>
          <p><b>Provider:</b> {user.provider}</p>
          <label>Ngôn ngữ<select defaultValue="vi"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
          <label>Giọng đọc<select defaultValue="browser"><option value="browser">Trình duyệt mặc định</option></select></label>
          <button type="button" className="btn danger" onClick={onLogout}>Đăng xuất</button>
        </div>
        <div className="card checklist-card">
          <h3>Quyền riêng tư</h3>
          <ul>
            <li>Dữ liệu phiên phỏng vấn lưu local qua backend SQLite.</li>
            <li>User chỉ thấy phiên phỏng vấn của mình.</li>
            <li>Admin xem được thống kê và danh sách phiên của toàn hệ thống.</li>
          </ul>
        </div>
      </div>

      {user.role === "admin" && (
        <div className="card table-card">
          <h3>Quản lý người dùng</h3>
          {adminError && <p className="error">{adminError}</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Tên</th><th>Email</th><th>Role</th><th>Provider</th><th>Active</th></tr></thead>
              <tbody>
                {users.map((item) => <tr key={item.id}><td>#{item.id}</td><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.provider}</td><td>{item.is_active ? "Yes" : "No"}</td></tr>)}
                {users.length === 0 && <tr><td colSpan={6}>Chưa có dữ liệu user.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}


function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && /failed to fetch|networkerror|fetch failed/i.test(error.message)) {
    return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.";
  }
  return error instanceof Error ? error.message : fallback;
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!googleClientId) return;
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    document.body.appendChild(script);
  }, [googleClientId]);

  const submit = async () => {
    setError(null);
    if (mode === "register" && !name.trim()) {
      setError("Vui lòng nhập họ tên.");
      return;
    }
    if (!email.trim()) {
      setError("Vui lòng nhập email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Mật khẩu cần có ít nhất 6 ký tự.");
      return;
    }
    if (password.length > 128) {
      setError("Mật khẩu không được vượt quá 128 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "login"
        ? await loginApi({ email, password })
        : await registerApi({ name: name.trim(), email: email.trim(), password });
      onAuthenticated(result.user);
    } catch (e) {
      setError(errorText(e, "Không thể xác thực."));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    if (!googleClientId) {
      setError("Chưa cấu hình VITE_GOOGLE_CLIENT_ID cho Google login.");
      return;
    }
    const google = (window as unknown as { google?: { accounts?: { id?: { initialize: (config: unknown) => void; prompt: () => void } } } }).google;
    if (!google?.accounts?.id) {
      setError("Google Identity script chưa sẵn sàng, hãy thử lại sau vài giây.");
      return;
    }
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential: string }) => {
        try {
          const result = await googleLogin(response.credential);
          onAuthenticated(result.user);
        } catch (e) {
          setError(errorText(e, "Đăng nhập Google thất bại."));
        }
      },
    });
    google.accounts.id.prompt();
  };

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="brand auth-brand"><div className="brand-mark">AI</div><span>InterviewAI</span></div>
        <p className="eyebrow">Phân quyền user/admin</p>
        <h1>{mode === "login" ? "Đăng nhập hệ thống" : "Tạo tài khoản mới"}</h1>
        <p className="muted">Tài khoản đầu tiên đăng ký sẽ được cấp quyền admin. Các tài khoản sau là user.</p>

        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Đăng nhập</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Đăng ký</button>
        </div>

        <div className="form-card auth-form">
          {mode === "register" && <label>Họ tên<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" /></label>}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Mật khẩu<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" /></label>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn primary" disabled={loading} onClick={submit}>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</button>
          <button type="button" className="btn secondary" onClick={loginWithGoogle}>Đăng nhập bằng Google</button>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const speech = useSpeech();
  const stopListenRef = useRef<(() => void) | null>(null);

  const [activePage, setActivePage] = useState<Page>("Mock Interview");
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [positions, setPositions] = useState<string[]>([]);
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questionBank, setQuestionBank] = useState<QuestionBank>({});
  const [selectedReport, setSelectedReport] = useState<FinalReport | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [position, setPosition] = useState("Backend Developer");
  const [level, setLevel] = useState("Junior");
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<InterviewPhase>("idle");
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [useFallback, setUseFallback] = useState(false);
  const [lastFeedback, setLastFeedback] = useState("");

  const [report, setReport] = useState<FinalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshDashboard = useCallback(async () => {
    const [nextStats, nextSessions, nextBank] = await Promise.allSettled([
      fetchStatistics(),
      fetchSessions(),
      fetchQuestionBank(),
    ]);
    if (nextStats.status === "fulfilled") setStats(nextStats.value);
    if (nextSessions.status === "fulfilled") setSessions(nextSessions.value);
    if (nextBank.status === "fulfilled") setQuestionBank(nextBank.value);
  }, []);

  useEffect(() => {
    fetchMe()
      .then((currentUser) => {
        setUser(currentUser);
        setName(currentUser.name);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    fetchPositions().then(setPositions).catch(() => setPositions(["Backend Developer", "Frontend Developer"]));
    if (user) refreshDashboard();
  }, [refreshDashboard, user]);

  useEffect(() => {
    if (!speech.sttSupported) setUseFallback(true);
  }, [speech.sttSupported]);

  const handleAuthenticated = (nextUser: User) => {
    setError(null);
    setSession(null);
    setReport(null);
    setActivePage("Mock Interview");
    setUser(nextUser);
    setName(nextUser.name);
    refreshDashboard();
  };

  const handleLogout = () => {
    logoutApi();
    setUser(null);
    setSession(null);
    setReport(null);
    setStats(null);
    setSessions([]);
    setActivePage("Mock Interview");
  };

  const loadAndAsk = useCallback(async (sid: number, idx: number) => {
    const q = await fetchQuestion(sid, idx);
    setQuestion(q);
    setQuestionIndex(idx);
    setTranscript("");
    setFallbackText("");
    setPhase("AI_ASKING");
    try { await speech.speak(q.text); } catch { /* TTS fallback */ }
    setPhase("WAITING_ANSWER");
  }, [speech]);
  if (!authChecked) {
    return <div className="auth-page"><section className="auth-card"><h1>Đang kiểm tra phiên đăng nhập...</h1></section></div>;
  }

  if (!user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }
  const navigate = (page: Page) => {
    setActivePage(page);
    if (page !== "Reports") {
      setSelectedReport(null);
      setSelectedReportId(null);
    }
  };

  const openReport = async (item: Session) => {
    setActivePage("Reports");
    setSelectedReportId(item.id);
    setSelectedReport(null);
    try {
      const nextReport = await fetchReport(item.id);
      setSelectedReport(nextReport);
    } catch (e) {
      setError(errorText(e, "Báo cáo chưa sẵn sàng."));
    }
  };

  const avatarMode = (): "speaking" | "listening" | "idle" | "thinking" => {
    if (phase === "AI_ASKING" || phase === "AI_FEEDBACK_SPEAKING") return "speaking";
    if (phase === "RECORDING") return "listening";
    if (phase === "EVALUATING" || phase === "TRANSCRIBING") return "thinking";
    return "idle";
  };


  const startInterview = async () => {
    if (!name.trim()) { setError("Vui lòng nhập họ tên ứng viên"); return; }
    setError(null);
    setLoading(true);
    try {
      const s = await createSession({ candidate_name: name.trim(), position, level });
      setSession(s);
      setReport(null);
      setActivePage("Mock Interview");
      await loadAndAsk(s.id, 0);
      refreshDashboard();
    } catch (e) {
      setError(errorText(e, "Không tạo được phiên."));
    } finally {
      setLoading(false);
    }
  };

  const replayQuestion = async () => {
    if (!question) return;
    setPhase("AI_ASKING");
    try { await speech.speak(question.text); } catch { /* ignore */ }
    setPhase("WAITING_ANSWER");
  };

  const startAnswer = () => {
    if (useFallback) { setPhase("REVIEW_TRANSCRIPT"); return; }
    setTranscript("");
    setPhase("RECORDING");
    stopListenRef.current = speech.startListening(
      (text) => setTranscript(text),
      (err) => {
        setError(`Micro/STT: ${err}. Bạn có thể dùng nhập text bên dưới.`);
        setUseFallback(true);
        setPhase("REVIEW_TRANSCRIPT");
      }
    );
  };

  const stopRecording = () => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    speech.stopListening();
    setPhase("TRANSCRIBING");
    setTimeout(() => setPhase("REVIEW_TRANSCRIPT"), 400);
  };

  const confirmAnswer = async () => {
    if (!session || !question) return;
    const text = (useFallback ? fallbackText : transcript).trim();
    if (!text) { setError("Câu trả lời không được để trống"); return; }
    setError(null);
    setPhase("EVALUATING");
    setLoading(true);
    try {
      const duration = useFallback ? undefined : speech.getRecordingDurationSec();
      const result = await evaluateAnswer(session.id, {
        question_index: questionIndex,
        transcript: text,
        answer_source: useFallback ? "text_fallback" : "voice",
        audio_duration: duration,
      });
      setLastFeedback(result.spoken_feedback);
      setPhase("AI_FEEDBACK_SPEAKING");
      try { await speech.speak(result.spoken_feedback); } catch { /* ignore */ }
      const next = questionIndex + 1;
      if (next >= question.total) {
        const fin = await finalizeSession(session.id);
        setReport(fin.report);
        setPhase("FINAL_REPORT");
        refreshDashboard();
        try { await speech.speak(fin.closing_remarks); } catch { /* ignore */ }
      } else {
        await loadAndAsk(session.id, next);
      }
    } catch (e) {
      setError(errorText(e, "Lỗi đánh giá."));
      setPhase("REVIEW_TRANSCRIPT");
    } finally {
      setLoading(false);
    }
  };

  const reRecord = () => {
    setTranscript("");
    setFallbackText("");
    setPhase("WAITING_ANSWER");
  };

  const renderMockInterview = () => (
    <section className="mock-page">
      {!session && (
        <>
          <div className="hero-card">
            <div className="hero-card__icon" aria-hidden>□</div>
            <div><strong>Sẵn sàng luyện phỏng vấn lập trình viên?</strong><p>AI interviewer đọc câu hỏi bằng giọng nói, ghi nhận câu trả lời và tạo bảng đánh giá chi tiết.</p></div>
            <button className="btn hero-btn" type="button" onClick={startInterview} disabled={loading}>Voice interview mode</button>
          </div>
          <div className="video-grid">
            <section className="call-card"><span className="pill pill--blue">AI HOST</span><Avatar mode="idle" /><div className="participant-label"><strong>AI Interviewer</strong><small>Technical interviewer</small></div></section>
            <UserCamera statusLabel="Candidate" />
          </div>
          <p className="privacy-note">Camera chỉ dùng cho tín hiệu tác phong cơ bản. Hệ thống không đánh giá cảm xúc hay danh tính.</p>
          <div className="start-panel">
            <div className="setup-grid">
              <label>Họ tên ứng viên<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" /></label>
              <label>Vị trí luyện tập<select value={position} onChange={(e) => setPosition(e.target.value)}>{positions.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
              <label>Trình độ<select value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn primary start-btn" type="button" disabled={loading} onClick={startInterview}>Bắt đầu mock interview</button>
          </div>
          <section className="question-stage question-stage--empty"><div className="panel-heading"><span className="pill pill--blue">Interviewer</span></div><p>Các câu hỏi của interviewer sẽ xuất hiện tại đây</p></section>
        </>
      )}

      {session && (
        <>
          <div className="session-header"><div><p className="eyebrow">Mock Interview</p><h2>{session.position}</h2><p>{session.candidate_name} · {session.level}</p></div><StatusBadge phase={phase} /></div>
          {phase !== "FINAL_REPORT" && <><div className="video-grid"><section className="call-card"><span className="pill pill--blue">AI HOST</span><Avatar mode={avatarMode()} /><div className="participant-label"><strong>AI Interviewer</strong><small>{phase === "AI_ASKING" ? "Speaking" : "Technical interviewer"}</small></div></section><UserCamera statusLabel={phase === "RECORDING" ? "Recording answer" : "Candidate"} recordingActive={phase === "RECORDING"} canRecord={phase === "WAITING_ANSWER" || phase === "RECORDING"} onToggleRecording={phase === "RECORDING" ? stopRecording : startAnswer} /></div><p className="privacy-note">Micro/STT hoạt động tốt nhất trên Chrome hoặc Edge khi dùng HTTPS hoặc localhost.</p></>}
          <div className="interview-main">
            {phase !== "FINAL_REPORT" && question && <><p className="meta">Câu {questionIndex + 1}/{question.total} · {question.group}</p><div className="question-stage"><div className="panel-heading"><span className="pill pill--blue">Interviewer</span><div className="panel-actions" aria-hidden><span /><span /></div></div><h2>{question.text}</h2></div></>}
            {phase === "RECORDING" && <div className="card transcript-card"><h3>Đang chuyển giọng nói thành text</h3><p className="transcript transcript--live">{transcript || "Hãy bắt đầu nói, nội dung sẽ xuất hiện tại đây..."}</p></div>}
            {phase === "REVIEW_TRANSCRIPT" && <div className="card transcript-card"><h3>Transcript — kiểm tra trước khi gửi</h3>{useFallback ? <textarea rows={5} value={fallbackText} onChange={(e) => setFallbackText(e.target.value)} placeholder="Nhập câu trả lời nếu micro/STT không hoạt động" /> : <p className="transcript">{transcript || "(Chưa có nội dung — hãy ghi âm lại)"}</p>}<label className="checkbox"><input type="checkbox" checked={useFallback} onChange={(e) => setUseFallback(e.target.checked)} />Dùng nhập text (fallback)</label></div>}
            {lastFeedback && phase !== "FINAL_REPORT" && phase !== "AI_ASKING" && <p className="feedback-hint"><small>Nhận xét vừa rồi: {lastFeedback}</small></p>}
            {error && <p className="error">{error}</p>}
            {phase !== "FINAL_REPORT" && <div className="control-panel">{phase === "WAITING_ANSWER" && <><button type="button" className="btn primary" onClick={startAnswer} disabled={loading}>Bắt đầu trả lời</button><button type="button" className="btn secondary" onClick={replayQuestion}>Nghe lại câu hỏi</button></>}{phase === "REVIEW_TRANSCRIPT" && <button type="button" className="btn secondary" onClick={replayQuestion}>Nghe lại câu hỏi</button>}{phase === "RECORDING" && <button type="button" className="btn danger" onClick={stopRecording}>Dừng ghi âm</button>}{phase === "REVIEW_TRANSCRIPT" && <><button type="button" className="btn secondary" onClick={reRecord}>Ghi âm lại</button><button type="button" className="btn primary" onClick={confirmAnswer} disabled={loading}>Xác nhận câu trả lời</button></>}</div>}
            {phase === "FINAL_REPORT" && report && <FinalReportView sessionId={session.id} report={report} />}
          </div>
          {!speech.ttsSupported && <p className="warn">Trình duyệt không hỗ trợ Text-to-Speech — chỉ hiển thị chữ.</p>}
        </>
      )}
    </section>
  );

  let content: ReactNode = renderMockInterview();
  if (activePage === "Overview") content = <OverviewPage stats={stats} sessions={sessions} onOpenReport={openReport} onStart={() => setActivePage("Mock Interview")} />;
  if (activePage === "Interview Records") content = <RecordsPage sessions={sessions} onOpenReport={openReport} />;
  if (activePage === "Resumes") content = <ResumePage />;
  if (activePage === "Job Descriptions") content = <QuestionBankPage bank={questionBank} />;
  if (activePage === "Prepared Answers") content = <PreparedAnswersPage bank={questionBank} />;
  if (activePage === "Reports") content = <ReportsPage sessions={sessions} selectedReport={selectedReport} selectedReportId={selectedReportId} onOpenReport={openReport} />;
  if (activePage === "Account") content = <AccountPage user={user} onLogout={handleLogout} />;

  return <AppShell activePage={activePage} onNavigate={navigate} title={session?.candidate_name ?? "Mock Interview"}>{content}</AppShell>;
}
















