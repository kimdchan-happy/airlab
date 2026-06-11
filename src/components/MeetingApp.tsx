"use client";

import { useState, useCallback } from "react";
import { Cpu } from "lucide-react";
import type {
  TranscriptEntry,
  ActionItem,
  RecordingState,
  GeneratingState,
} from "@/lib/types";
import RecorderPanel from "./RecorderPanel";
import TranscriptPanel from "./TranscriptPanel";
import MinutesPanel from "./MinutesPanel";
import MeetingHeader from "./MeetingHeader";

export default function MeetingApp() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("반도체 공정 기술 검토 회의");
  const [attendees, setAttendees] = useState("");
  const [minutes, setMinutes] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [generatingState, setGeneratingState] = useState<GeneratingState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const addFinalEntry = useCallback((text: string) => {
    setTranscriptEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        timestamp: new Date(),
        isFinal: true,
      },
    ]);
    setInterimText("");
  }, []);

  const getFullTranscript = useCallback(() => {
    return transcriptEntries.map((e) => e.text).join(" ");
  }, [transcriptEntries]);

  const handleGenerateMinutes = useCallback(async () => {
    const transcript = getFullTranscript();
    if (!transcript.trim()) {
      setErrorMessage("회의 내용이 없습니다. 먼저 녹음을 시작해주세요.");
      return;
    }

    setGeneratingState("generating");
    setMinutes("");
    setActionItems([]);
    setErrorMessage("");

    try {
      const response = await fetch("/api/generate-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          meetingTitle,
          attendees: attendees
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          date: new Date().toLocaleDateString("ko-KR"),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "회의록 생성 실패");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("스트림을 읽을 수 없습니다.");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          if (data === "[ACTION_ITEMS_START]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "minutes_chunk") {
              setMinutes((prev) => prev + parsed.content);
            } else if (parsed.type === "action_items") {
              setActionItems(parsed.items);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      setGeneratingState("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setGeneratingState("error");
    }
  }, [getFullTranscript, meetingTitle, attendees]);

  const handleExportPPT = useCallback(async () => {
    if (!minutes) return;

    try {
      const response = await fetch("/api/export-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingTitle,
          date: new Date().toLocaleDateString("ko-KR"),
          attendees: attendees
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          minutes,
          actionItems,
          transcript: getFullTranscript(),
        }),
      });

      if (!response.ok) throw new Error("PPT 생성 실패");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meetingTitle}_회의록_${new Date().toLocaleDateString("ko-KR").replace(/\./g, "").replace(/ /g, "")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "PPT 내보내기 실패");
    }
  }, [minutes, meetingTitle, attendees, actionItems, getFullTranscript]);

  const handleReset = useCallback(() => {
    setTranscriptEntries([]);
    setInterimText("");
    setMinutes("");
    setActionItems([]);
    setGeneratingState("idle");
    setErrorMessage("");
    setRecordingState("idle");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-semiconductor-blue">
            <Cpu className="w-7 h-7 text-teal-600" />
            <span className="font-bold text-xl text-slate-800">반도체 회의 AI 어시스턴트</span>
          </div>
          <span className="ml-auto text-sm text-slate-500">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </span>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Meeting metadata */}
        <MeetingHeader
          meetingTitle={meetingTitle}
          setMeetingTitle={setMeetingTitle}
          attendees={attendees}
          setAttendees={setAttendees}
        />

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Recorder controls */}
        <RecorderPanel
          recordingState={recordingState}
          setRecordingState={setRecordingState}
          onFinalTranscript={addFinalEntry}
          onInterimTranscript={setInterimText}
          onGenerateMinutes={handleGenerateMinutes}
          onReset={handleReset}
          hasTranscript={transcriptEntries.length > 0}
          generatingState={generatingState}
        />

        {/* Two-column layout: transcript | minutes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TranscriptPanel
            entries={transcriptEntries}
            interimText={interimText}
            isRecording={recordingState === "recording"}
          />
          <MinutesPanel
            minutes={minutes}
            actionItems={actionItems}
            generatingState={generatingState}
            onExportPPT={handleExportPPT}
          />
        </div>
      </main>
    </div>
  );
}
