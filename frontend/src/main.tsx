import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-page">
          <section className="auth-card">
            <div className="brand auth-brand"><div className="brand-mark">AI</div><span>InterviewAI</span></div>
            <h1>Giao diện gặp lỗi</h1>
            <p className="muted">React đã bắt được lỗi thay vì để màn hình trống.</p>
            <pre className="error-box">{this.state.error.message}</pre>
            <button className="btn primary" type="button" onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
