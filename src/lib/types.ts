export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface ActionItem {
  id: string;
  assignee: string;
  task: string;
  deadline: string;
  priority: "high" | "medium" | "low";
}

export interface MeetingData {
  title: string;
  date: string;
  attendees: string[];
  minutes: string;
  actionItems: ActionItem[];
  transcript: string;
}

export type RecordingState = "idle" | "recording" | "paused";
export type GeneratingState = "idle" | "generating" | "done" | "error";
