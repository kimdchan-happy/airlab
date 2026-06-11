"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Clock } from "lucide-react";
import type { TranscriptEntry } from "@/lib/types";

interface Props {
  entries: TranscriptEntry[];
  interimText: string;
  isRecording: boolean;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function TranscriptPanel({ entries, interimText, isRecording }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, interimText]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-slate-700 text-sm">실시간 전사 내용</span>
        </div>
        <span className="text-xs text-slate-400">{entries.length}개 발화</span>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto custom-scroll px-5 py-4 space-y-3">
        {entries.length === 0 && !interimText ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">녹음을 시작하면 회의 내용이 여기에 실시간으로 표시됩니다.</p>
          </div>
        ) : (
          <>
            {entries.map((entry) => (
              <div key={entry.id} className="transcript-fade-in">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Clock className="w-3 h-3 text-slate-300" />
                  <span className="text-xs text-slate-400">{formatTime(entry.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
                  {entry.text}
                </p>
              </div>
            ))}
            {interimText && (
              <div className="transcript-fade-in">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-xs text-teal-500">인식 중...</span>
                </div>
                <p className="text-sm text-slate-400 italic bg-teal-50 rounded-lg px-3 py-2 border border-teal-100">
                  {interimText}
                </p>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {isRecording && (
        <div className="px-5 py-2 border-t border-slate-100 bg-red-50 rounded-b-xl">
          <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            LIVE · 녹음 중
          </p>
        </div>
      )}
    </div>
  );
}
