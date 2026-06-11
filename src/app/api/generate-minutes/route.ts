import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 반도체 산업 전문 회의록 작성 AI입니다.
회의 내용을 분석하여 체계적인 회의록을 한국어로 작성하고, 명확한 액션 아이템을 도출합니다.

전문 용어: DRAM, NAND Flash, 파운드리, 공정 미세화, EUV 리소그래피, CMP, CVD, ALD,
수율(Yield), TAT, OEE, SPC, DOE, 패키징, HBM, TSV, 불량 분석 등.

회의록 형식 (마크다운):
## 회의 개요
- 날짜, 제목, 참석자

## 주요 논의 사항
- 번호 매긴 목록

## 결정 사항
- 번호 매긴 목록

## 리스크 및 이슈
- 목록

## 다음 단계
- 목록`;

const MARKER = "[ACTION_ITEMS_START]";

interface RequestBody {
  transcript: string;
  meetingTitle: string;
  attendees: string[];
  date: string;
}

interface ActionItemRaw {
  assignee: string;
  task: string;
  deadline: string;
  priority: "high" | "medium" | "low";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { transcript, meetingTitle, attendees, date } = body;

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "회의 내용이 없습니다." }, { status: 400 });
    }

    const userMessage = `회의 제목: ${meetingTitle}
날짜: ${date}
참석자: ${attendees.length > 0 ? attendees.join(", ") : "미기재"}

=== 회의 전사 내용 ===
${transcript}
=== 전사 내용 끝 ===

위 내용을 분석하여:
1. 위 형식의 마크다운 회의록을 작성하세요.
2. 회의록 완성 후 "${MARKER}" 태그를 정확히 출력한 다음,
   아래 JSON 형식으로 액션 아이템을 작성하세요:

\`\`\`json
[
  {
    "assignee": "담당자 (미정이면 '미정')",
    "task": "구체적 업무 내용",
    "deadline": "기한 (예: 2주 내, 다음 회의 전, 미정)",
    "priority": "high 또는 medium 또는 low"
  }
]
\`\`\`

액션 아이템이 없으면 빈 배열 []을 반환하세요.`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let minutesBuffer = "";
          let actionItemsBuffer = "";
          let pastMarker = false;

          const anthropicStream = await client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }],
          });

          for await (const event of anthropicStream) {
            if (
              event.type !== "content_block_delta" ||
              event.delta.type !== "text_delta"
            ) {
              continue;
            }

            const chunk = event.delta.text;

            if (!pastMarker) {
              const combined = minutesBuffer + chunk;
              const markerIdx = combined.indexOf(MARKER);

              if (markerIdx !== -1) {
                // Stream everything before the marker
                const beforeMarker = combined.slice(0, markerIdx);
                const newMinutesContent = beforeMarker.slice(minutesBuffer.length);
                if (newMinutesContent) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "minutes_chunk", content: newMinutesContent })}\n\n`
                    )
                  );
                }
                minutesBuffer = beforeMarker;
                actionItemsBuffer = combined.slice(markerIdx + MARKER.length);
                pastMarker = true;
              } else {
                // Stream the chunk as minutes content
                minutesBuffer = combined;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "minutes_chunk", content: chunk })}\n\n`
                  )
                );
              }
            } else {
              actionItemsBuffer += chunk;
            }
          }

          // Parse and emit action items
          const jsonMatch = actionItemsBuffer.match(/```json\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try {
              const items: ActionItemRaw[] = JSON.parse(jsonMatch[1]);
              const itemsWithIds = items.map((item, idx) => ({
                ...item,
                id: `action-${idx}-${Date.now()}`,
                priority: (["high", "medium", "low"].includes(item.priority)
                  ? item.priority
                  : "medium") as ActionItemRaw["priority"],
              }));
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "action_items", items: itemsWithIds })}\n\n`
                )
              );
            } catch (parseErr) {
              console.error("Action items JSON parse error:", parseErr);
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI 처리 오류";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Generate minutes error:", err);
    return NextResponse.json(
      { error: "회의록 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
