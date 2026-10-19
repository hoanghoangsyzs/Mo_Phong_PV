import type { FinalReport } from "../types";
import { exportUrl } from "../api/client";

type Props = {
  sessionId: number;
  report: FinalReport;
};

function value(row: Record<string, unknown>, key: string, fallback = "--") {
  const raw = row[key];
  return raw == null || raw === "" ? fallback : String(raw);
}

export function FinalReportView({ sessionId, report }: Props) {
  const info = report.session_info as {
    candidate_name: string;
    position: string;
    level: string;
    started_at: string;
    ended_at: string;
    total_questions: number;
  };
  const ov = report.overview;

  return (
    <section className="final-report">
      <h2>Bảng đánh giá tổng hợp</h2>

      <div className="card">
        <h3>1. Thông tin phiên phỏng vấn</h3>
        <ul className="info-list">
          <li><b>Họ tên:</b> {info.candidate_name}</li>
          <li><b>Vị trí:</b> {info.position}</li>
          <li><b>Trình độ:</b> {info.level}</li>
          <li><b>Bắt đầu:</b> {info.started_at}</li>
          <li><b>Kết thúc:</b> {info.ended_at}</li>
          <li><b>Tổng câu hỏi:</b> {info.total_questions}</li>
        </ul>
      </div>

      <div className="card highlight">
        <h3>2. Điểm tổng quan</h3>
        <p className="score-big">{ov.total_score}/100 - <em>{ov.grade_label}</em></p>
        <p>{ov.overall_comment}</p>
      </div>

      <div className="card">
        <h3>3. Bảng điểm theo từng câu hỏi</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Nhóm</th>
                <th>Câu hỏi</th>
                <th>Tóm tắt trả lời</th>
                <th>Trọng tâm</th>
                <th>Mạch lạc</th>
                <th>Trôi chảy</th>
                <th>Cảm xúc</th>
                <th>Điểm</th>
                <th>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {report.per_question.map((row) => (
                <tr key={String(row.stt)}>
                  <td>{value(row, "stt")}</td>
                  <td>{value(row, "group")}</td>
                  <td>{value(row, "question")}</td>
                  <td>{value(row, "answer_summary")}</td>
                  <td>{value(row, "focus_score", value(row, "content_score"))}</td>
                  <td>{value(row, "coherence_score", value(row, "structure_score"))}</td>
                  <td>{value(row, "fluency_score")}</td>
                  <td>{value(row, "emotional_clarity_score")}</td>
                  <td>{value(row, "question_score")}</td>
                  <td>{value(row, "short_feedback")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>4. Phân tích kỹ năng</h3>
        <ul>
          {report.skill_analysis.map((s) => (
            <li key={s.skill_group}>
              <b>{s.skill_group}:</b> {s.score}/100 {s.notes ? <small>- {s.notes}</small> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>5. Điểm mạnh (top 3)</h3>
          <ol>{report.strengths_top3.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div className="card">
          <h3>6. Cần cải thiện (top 3)</h3>
          <ol>{report.weaknesses_top3.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      </div>

      <div className="card">
        <h3>7. Từ khóa chuyên môn còn thiếu</h3>
        <p>{report.missing_keywords.join(", ") || "--"}</p>
      </div>

      <div className="card">
        <h3>8. Gợi ý cải thiện</h3>
        <ul>
          <li><b>Ôn kiến thức:</b> {Array.isArray(report.improvement_roadmap.topics_to_review) ? (report.improvement_roadmap.topics_to_review as string[]).join(", ") : report.improvement_roadmap.topics_to_review}</li>
          <li><b>Cấu trúc trả lời:</b> {report.improvement_roadmap.answer_structure}</li>
          <li><b>Ví dụ dự án:</b> {report.improvement_roadmap.project_examples}</li>
          <li><b>Diễn đạt:</b> {report.improvement_roadmap.clarity_tips}</li>
        </ul>
      </div>

      <div className="card">
        <h3>9. Xuất báo cáo</h3>
        <div className="btn-row">
          <a className="btn secondary" href={exportUrl(sessionId, "json")} download>JSON</a>
          <a className="btn secondary" href={exportUrl(sessionId, "csv")} download>CSV</a>
          <a className="btn secondary" href={exportUrl(sessionId, "html")} target="_blank" rel="noreferrer">HTML</a>
        </div>
      </div>
    </section>
  );
}
