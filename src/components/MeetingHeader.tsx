"use client";

import { Users, FileText } from "lucide-react";

interface Props {
  meetingTitle: string;
  setMeetingTitle: (v: string) => void;
  attendees: string;
  setAttendees: (v: string) => void;
}

export default function MeetingHeader({
  meetingTitle,
  setMeetingTitle,
  attendees,
  setAttendees,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
        회의 정보
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
            <FileText className="w-4 h-4 text-teal-600" />
            회의 제목
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="예: Q3 DRAM 공정 개선 회의"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
            <Users className="w-4 h-4 text-teal-600" />
            참석자 <span className="text-slate-400 font-normal">(쉼표로 구분)</span>
          </label>
          <input
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder="예: 김철수 팀장, 이영희 선임, 박민준 책임"
          />
        </div>
      </div>
    </div>
  );
}
