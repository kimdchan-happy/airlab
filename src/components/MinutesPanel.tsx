"use client";

import { Download, Loader2, FileText, CheckSquare, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ActionItem, GeneratingState } from "@/lib/types";

interface Props {
  minutes: string;
  actionItems: ActionItem[];
  generatingState: GeneratingState;
  onExportPPT: () => void;
}

const priorityLabel: Record<ActionItem["priority"], string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const priorityColor: Record<ActionItem["priority"], string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

export default function MinutesPanel({
  minutes,
  actionItems,
  generatingState,
  onExportPPT,
}: Props) {
  const isDone = generatingState === "done";
  const isGenerating = generatingState === "generating";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-slate-700 text-sm">AI 회의록 & 액션 아이템</span>
        </div>
        {isDone && (
          <button
            onClick={onExportPPT}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            PPT 저장
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scroll px-5 py-4">
        {generatingState === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm text-center">
              녹음 후 <strong className="text-slate-500">회의록 생성</strong> 버튼을 누르면
              <br />
              AI가 회의록과 액션 아이템을 자동으로 작성합니다.
            </p>
          </div>
        )}

        {isGenerating && !minutes && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Claude AI가 회의록을 분석하고 있습니다...</p>
          </div>
        )}

        {minutes && (
          <div className="space-y-5">
            {/* Minutes */}
            <div className="meeting-minutes text-sm">
              <ReactMarkdown>{minutes}</ReactMarkdown>
            </div>

            {/* Action Items */}
            {actionItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-slate-700 text-sm">액션 아이템</h3>
                </div>
                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{item.task}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500">담당: {item.assignee}</span>
                          {item.deadline && (
                            <span className="text-xs text-slate-500">기한: {item.deadline}</span>
                          )}
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityColor[item.priority]}`}
                          >
                            {priorityLabel[item.priority]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-indigo-500 pt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                생성 중...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
