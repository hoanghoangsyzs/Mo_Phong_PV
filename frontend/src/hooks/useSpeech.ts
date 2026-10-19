import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech() {
  const [ttsSupported, setTtsSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordStartRef = useRef<number | null>(null);

  useEffect(() => {
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    setSttSupported(!!getRecognitionCtor());
  }, []);

  const speak = useCallback(
    (text: string, lang = "vi-VN"): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!ttsSupported) {
          reject(new Error("TTS không được hỗ trợ"));
          return;
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang;
        utter.rate = 1;
        const voices = window.speechSynthesis.getVoices();
        const vi = voices.find((v) => v.lang.startsWith("vi"));
        if (vi) utter.voice = vi;
        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utter.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };
        window.speechSynthesis.speak(utter);
      });
    },
    [ttsSupported]
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const startListening = useCallback(
    (
      onResult: (transcript: string) => void,
      onError: (msg: string) => void
    ): (() => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        onError("STT không được hỗ trợ trên trình duyệt này. Hãy dùng Chrome hoặc Edge.");
        return () => {};
      }

      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }

      recordStartRef.current = Date.now();
      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = "vi-VN";
      rec.interimResults = true;
      rec.continuous = true;
      let finalText = "";

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript.trim();
          if (!t) continue;
          if (ev.results[i].isFinal) finalText = `${finalText} ${t}`.trim();
          else interim = `${interim} ${t}`.trim();
        }
        onResult(`${finalText} ${interim}`.trim());
      };

      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        if (ev.error === "no-speech") return;
        onError(ev.error || "recognition-error");
      };

      (rec as SpeechRecognition & { onend: (() => void) | null }).onend = () => {
        if (recognitionRef.current === rec) recognitionRef.current = null;
      };

      try {
        rec.start();
      } catch {
        onError("Không thể bắt đầu nhận diện giọng nói. Hãy tắt/bật lại micro và thử lại.");
      }

      return () => {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        if (recognitionRef.current === rec) recognitionRef.current = null;
      };
    },
    []
  );

  const getRecordingDurationSec = useCallback((): number | undefined => {
    if (!recordStartRef.current) return undefined;
    return Math.round((Date.now() - recordStartRef.current) / 100) / 10;
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  return {
    ttsSupported,
    sttSupported,
    isSpeaking,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    getRecordingDurationSec,
  };
}

