import { useEffect, useRef, useState } from "react";

type Props = {
  statusLabel?: string;
  recordingActive?: boolean;
  canRecord?: boolean;
  onToggleRecording?: () => void;
};

export function UserCamera({
  statusLabel = "Candidate",
  recordingActive = false,
  canRecord = false,
  onToggleRecording,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEnabled(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 540, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setEnabled(true);
    } catch {
      setError("Không thể mở camera. Hãy cấp quyền camera cho trình duyệt.");
      setEnabled(false);
    }
  };

  const stopMicPermission = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    setMicEnabled(false);
  };

  const startMicPermission = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      setMicEnabled(true);
      return true;
    } catch {
      setMicError("Không thể mở micro. Hãy cấp quyền micro cho trình duyệt.");
      setMicEnabled(false);
      return false;
    }
  };

  const toggleMic = async () => {
    if (onToggleRecording && canRecord) {
      if (!recordingActive) {
        const ok = micEnabled || await startMicPermission();
        if (!ok) return;
      }
      onToggleRecording();
      return;
    }

    if (micEnabled) stopMicPermission();
    else await startMicPermission();
  };

  useEffect(() => () => {
    stopCamera();
    stopMicPermission();
  }, []);

  useEffect(() => {
    if (recordingActive) setMicEnabled(true);
  }, [recordingActive]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [enabled]);

  const micLabel = recordingActive ? "Đang ghi âm" : micEnabled ? "Micro bật" : "Bật micro";
  const micTitle = recordingActive
    ? "Dừng ghi âm và kiểm tra transcript"
    : canRecord
      ? "Bắt đầu chuyển giọng nói thành text"
      : micEnabled ? "Tắt micro" : "Bật micro";

  return (
    <section className={`call-card call-card--camera${enabled ? " call-card--camera-on" : ""}`}>
      <span className={`pill ${enabled ? "pill--green" : "pill--muted"}`}>
        {enabled ? "ĐANG BẬT" : "TẮT"}
      </span>

      <div className="media-controls">
        <button
          type="button"
          className={`media-toggle ${enabled ? "media-toggle--on" : ""}`}
          onClick={enabled ? stopCamera : startCamera}
          aria-label={enabled ? "Tắt camera" : "Bật camera"}
          title={enabled ? "Tắt camera" : "Bật camera"}
        >
          {enabled ? "Tắt camera" : "Bật camera"}
        </button>
        <button
          type="button"
          className={`media-toggle ${micEnabled || recordingActive ? "media-toggle--on" : ""}`}
          onClick={toggleMic}
          aria-label={micTitle}
          title={micTitle}
        >
          {micLabel}
        </button>
      </div>

      {enabled ? (
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
      ) : (
        <div className="camera-placeholder">
          <span className="camera-icon" aria-hidden>□</span>
          <p>{error ?? "Camera đang tắt"}</p>
          {micError && <small>{micError}</small>}
        </div>
      )}

      <div className="participant-label">
        <strong>Bạn</strong>
        <small>{recordingActive ? "Đang chuyển giọng nói thành text" : enabled ? statusLabel : micEnabled ? "Mic ready" : "Camera off"}</small>
      </div>
    </section>
  );
}
