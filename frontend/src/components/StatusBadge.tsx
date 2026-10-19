import type { InterviewPhase } from "../types";

const LABELS: Record<InterviewPhase, string> = {
  idle: "Sẵn sàng",
  AI_ASKING: "AI đang hỏi",
  WAITING_ANSWER: "Chờ bạn trả lời",
  RECORDING: "Đang ghi âm",
  TRANSCRIBING: "Đang chuyển giọng nói thành văn bản",
  REVIEW_TRANSCRIPT: "Kiểm tra câu trả lời",
  EVALUATING: "Đang đánh giá",
  AI_FEEDBACK_SPEAKING: "AI đang đọc nhận xét",
  FINAL_REPORT: "Báo cáo tổng hợp",
};

export function StatusBadge({ phase }: { phase: InterviewPhase }) {
  return <span className="status-badge">{LABELS[phase]}</span>;
}
