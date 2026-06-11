"use client";

import { useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Square, RefreshCw, FileText, Loader2 } from "lucide-react";
import type { RecordingState, GeneratingState } from "@/lib/types";

interface Props {
  recordingState: RecordingState;
  setRecordingState: (s: RecordingState) => void;
  onFinalTranscript: (text: string) => void;
  onInterimTranscript: (text: string) => void;
  onGenerateMinutes: () => void;
  onReset: () => void;
  hasTranscript: boolean;
  generatingState: GeneratingState;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function RecorderPanel({
  recordingState,
  setRecordingState,
  onFinalTranscript,
  onInterimTranscript,
  onGenerateMinutes,
  onReset,
  hasTranscript,
  generatingState,
}: Props) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRecording = recordingState === "recording";

  const startRecognition = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      alert(
        "이 브라우저는 음성 인식을 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요."
      );
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onFinalTranscript(text);
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      onInterimTranscript(interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return;
      if (event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still in recording state
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [onFinalTranscript, onInterimTranscript]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      r.stop();
    }
    onInterimTranscript("");
  }, [onInterimTranscript]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecognition();
      setRecordingState("idle");
    } else {
      startRecognition();
      setRecordingState("recording");
    }
  }, [isRecording, stopRecognition, startRecognition, setRecordingState]);

  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  const isGenerating = generatingState === "generating";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Record / Stop */}
        <button
          onClick={handleToggleRecording}
          disabled={isGenerating}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm
            ${isRecording
              ? "bg-red-500 hover:bg-red-600 text-white recording-pulse"
              : "bg-teal-600 hover:bg-teal-700 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRecording ? (
            <>
              <Square className="w-4 h-4" />
              녹음 중지
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              녹음 시작
            </>
          )}
        </button>

        {isRecording && (
          <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            실시간 녹음 중...
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Generate minutes */}
          <button
            onClick={onGenerateMinutes}
            disabled={!hasTranscript || isGenerating || isRecording}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                회의록 생성 중...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                회의록 생성
              </>
            )}
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            disabled={isRecording || isGenerating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            초기화
          </button>
        </div>
      </div>

      {!isRecording && recordingState === "idle" && (
        <p className="mt-3 text-xs text-slate-400">
          Chrome 또는 Edge 브라우저에서 마이크 권한을 허용한 후 녹음을 시작하세요.
          한국어(ko-KR)로 인식됩니다.
        </p>
      )}
    </div>
  );
}
