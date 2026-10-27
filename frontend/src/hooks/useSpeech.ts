import { useCallback, useEffect, useRef, useState } from "react";
import { synthesizeSpeech } from "../api/client";

function chooseVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const vietnamese = voices.filter((voice) => voice.lang.toLowerCase().startsWith("vi"));
  const femaleName = /female|woman|hoai\s?my|mai|linh|thuy|ngoc/i;
  return vietnamese.find((voice) => femaleName.test(voice.name))
    // Prefer a recognizable Vietnamese feminine voice when the browser has no gender metadata.
    ?? vietnamese.find((voice) => /google/i.test(voice.name))
    ?? vietnamese[0];
}
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speakRequestRef = useRef(0);

  useEffect(() => {
    setTtsSupported(true);
    setSttSupported(!!getRecognitionCtor());
  }, []);

  const speak = useCallback(
    async (text: string, lang = "vi-VN"): Promise<void> => {
      const requestId = ++speakRequestRef.current;
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioRef.current = null;
      audioUrlRef.current = null;
      setIsSpeaking(false);

      try {
        const audioBlob = await synthesizeSpeech(text);
        if (requestId !== speakRequestRef.current) return;
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = audioUrl;
        audio.onended = () => {
          if (requestId !== speakRequestRef.current) return;
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
          audioRef.current = null;
        };
        audio.onerror = () => {
          if (requestId === speakRequestRef.current) setIsSpeaking(false);
        };
        setIsSpeaking(true);
        await audio.play();
        return await new Promise<void>((resolve) => {
          audio.onended = () => {
            if (requestId === speakRequestRef.current) setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            if (audioUrlRef.current === audioUrl) audioUrlRef.current = null;
            if (audioRef.current === audio) audioRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            if (requestId === speakRequestRef.current) setIsSpeaking(false);
            resolve();
          };
        });
      } catch {
        if (requestId !== speakRequestRef.current) return;
        if (!("speechSynthesis" in window)) throw new Error("Không thể phát giọng đọc trên trình duyệt này.");
        await new Promise<void>((resolve) => {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = lang;
          utter.rate = 0.92;
          const vi = chooseVietnameseVoice(window.speechSynthesis.getVoices());
          if (vi) utter.voice = vi;
          utter.onstart = () => setIsSpeaking(true);
          utter.onend = () => { setIsSpeaking(false); resolve(); };
          utter.onerror = () => { setIsSpeaking(false); resolve(); };
          window.speechSynthesis.speak(utter);
        });
      }
    },
    []
  );

  const stopSpeaking = useCallback(() => {
    speakRequestRef.current += 1;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
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



