import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";

// Color palette
const COLORS = {
  primary: "1a3c6e",
  teal: "00a8b5",
  accent: "e8851a",
  white: "FFFFFF",
  lightGray: "f1f5f9",
  darkText: "1e293b",
  mutedText: "64748b",
  border: "e2e8f0",
};

interface ActionItem {
  id: string;
  assignee: string;
  task: string;
  deadline: string;
  priority: "high" | "medium" | "low";
}

interface RequestBody {
  meetingTitle: string;
  date: string;
  attendees: string[];
  minutes: string;
  actionItems: ActionItem[];
  transcript: string;
}

function extractSection(markdown: string, heading: string): string[] {
  const lines = markdown.split("\n");
  const results: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith("## ") && line.includes(heading)) {
      capturing = true;
      continue;
    }
    if (capturing && line.startsWith("## ")) break;
    if (capturing && line.trim()) {
      const cleaned = line.replace(/^[-*#\d.]+\s*/, "").trim();
      if (cleaned) results.push(cleaned);
    }
  }
  return results.slice(0, 8);
}

function addSlideHeader(
  slide: PptxGenJS.Slide,
  title: string,
  teal = false
) {
  // Background strip
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 1.1,
    fill: { color: teal ? COLORS.teal : COLORS.primary },
  });

  // Accent bar
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0,
    y: 1.05,
    w: "100%",
    h: 0.05,
    fill: { color: COLORS.accent },
  });

  slide.addText(title, {
    x: 0.4,
    y: 0.15,
    w: 8.5,
    h: 0.75,
    fontSize: 22,
    bold: true,
    color: COLORS.white,
    fontFace: "맑은 고딕",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { meetingTitle, date, attendees, minutes, actionItems } = body;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE"; // 16:9

    // ─────────────────────────────────────────
    // Slide 1: Title
    // ─────────────────────────────────────────
    const slide1 = pptx.addSlide();

    // Full background
    slide1.addShape(PptxGenJS.ShapeType.rect, {
      x: 0, y: 0, w: "100%", h: "100%",
      fill: { color: COLORS.primary },
    });

    // Teal accent block
    slide1.addShape(PptxGenJS.ShapeType.rect, {
      x: 0, y: 3.8, w: "100%", h: 0.08,
      fill: { color: COLORS.teal },
    });

    slide1.addShape(PptxGenJS.ShapeType.rect, {
      x: 0, y: 3.88, w: "100%", h: 3.37,
      fill: { color: "0f2549" },
    });

    // Semiconductor icon text
    slide1.addText("⚙️ 반도체 회의 AI 어시스턴트", {
      x: 0.5, y: 0.5, w: 9, h: 0.6,
      fontSize: 14, color: COLORS.teal,
      fontFace: "맑은 고딕",
    });

    slide1.addText(meetingTitle, {
      x: 0.5, y: 1.2, w: 12, h: 1.8,
      fontSize: 36, bold: true, color: COLORS.white,
      fontFace: "맑은 고딕",
      wrap: true,
    });

    slide1.addText("회의록", {
      x: 0.5, y: 4.1, w: 5, h: 0.7,
      fontSize: 20, color: COLORS.teal,
      fontFace: "맑은 고딕", bold: true,
    });

    slide1.addText(`날짜: ${date}`, {
      x: 0.5, y: 4.9, w: 6, h: 0.45,
      fontSize: 14, color: "94a3b8",
      fontFace: "맑은 고딕",
    });

    if (attendees.length > 0) {
      slide1.addText(`참석자: ${attendees.join(", ")}`, {
        x: 0.5, y: 5.4, w: 12, h: 0.45,
        fontSize: 13, color: "94a3b8",
        fontFace: "맑은 고딕",
      });
    }

    // ─────────────────────────────────────────
    // Slide 2: Meeting Overview
    // ─────────────────────────────────────────
    const slide2 = pptx.addSlide();
    slide2.background = { color: COLORS.lightGray };
    addSlideHeader(slide2, "회의 개요");

    const overviewRows: PptxGenJS.TableRow[] = [
      [
        { text: "회의 제목", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 12 } },
        { text: meetingTitle, options: { fontSize: 12, color: COLORS.darkText } },
      ],
      [
        { text: "날짜", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 12 } },
        { text: date, options: { fontSize: 12, color: COLORS.darkText } },
      ],
      [
        { text: "참석자", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 12 } },
        {
          text: attendees.length > 0 ? attendees.join(", ") : "미기재",
          options: { fontSize: 12, color: COLORS.darkText },
        },
      ],
    ];

    slide2.addTable(overviewRows, {
      x: 0.5, y: 1.3, w: 12, h: 2.5,
      border: { type: "solid", pt: 1, color: COLORS.border },
      fontFace: "맑은 고딕",
      colW: [2, 10],
    });

    // ─────────────────────────────────────────
    // Slide 3: Key Discussion Points
    // ─────────────────────────────────────────
    const slide3 = pptx.addSlide();
    slide3.background = { color: COLORS.white };
    addSlideHeader(slide3, "주요 논의 사항", true);

    const discussionPoints = extractSection(minutes, "주요 논의 사항");
    if (discussionPoints.length > 0) {
      const bulletItems = discussionPoints.map((point, i) => ({
        text: `${i + 1}. ${point}`,
        options: { bullet: false, fontSize: 14, color: COLORS.darkText, paraSpaceAfter: 8 },
      }));
      slide3.addText(bulletItems, {
        x: 0.5, y: 1.3, w: 12, h: 5.5,
        fontFace: "맑은 고딕",
        valign: "top",
      });
    } else {
      slide3.addText("회의 전사 내용에서 논의 사항을 추출할 수 없습니다.", {
        x: 0.5, y: 2, w: 12, h: 1,
        fontSize: 14, color: COLORS.mutedText,
        fontFace: "맑은 고딕",
      });
    }

    // ─────────────────────────────────────────
    // Slide 4: Decisions
    // ─────────────────────────────────────────
    const slide4 = pptx.addSlide();
    slide4.background = { color: COLORS.lightGray };
    addSlideHeader(slide4, "결정 사항");

    const decisions = extractSection(minutes, "결정 사항");
    if (decisions.length > 0) {
      decisions.forEach((decision, i) => {
        slide4.addShape(PptxGenJS.ShapeType.roundRect, {
          x: 0.4,
          y: 1.3 + i * 0.85,
          w: 12.1,
          h: 0.72,
          fill: { color: COLORS.white },
          line: { color: COLORS.teal, pt: 1.5 },
          rectRadius: 0.1,
        });
        slide4.addText(`✅  ${decision}`, {
          x: 0.6,
          y: 1.35 + i * 0.85,
          w: 11.8,
          h: 0.6,
          fontSize: 13,
          color: COLORS.darkText,
          fontFace: "맑은 고딕",
        });
      });
    } else {
      slide4.addText("결정된 사항이 없거나 추출할 수 없습니다.", {
        x: 0.5, y: 2, w: 12, h: 1,
        fontSize: 14, color: COLORS.mutedText, fontFace: "맑은 고딕",
      });
    }

    // ─────────────────────────────────────────
    // Slide 5: Action Items
    // ─────────────────────────────────────────
    const slide5 = pptx.addSlide();
    slide5.background = { color: COLORS.white };
    addSlideHeader(slide5, "액션 아이템");

    if (actionItems.length > 0) {
      const headerRow: PptxGenJS.TableRow = [
        { text: "No.", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 11, align: "center" } },
        { text: "업무 내용", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 11 } },
        { text: "담당자", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 11, align: "center" } },
        { text: "기한", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 11, align: "center" } },
        { text: "우선순위", options: { bold: true, color: COLORS.white, fill: { color: COLORS.primary }, fontSize: 11, align: "center" } },
      ];

      const priorityKorean: Record<string, string> = {
        high: "높음",
        medium: "보통",
        low: "낮음",
      };

      const priorityColors: Record<string, string> = {
        high: "fee2e2",
        medium: "fef9c3",
        low: "dcfce7",
      };

      const dataRows: PptxGenJS.TableRow[] = actionItems.map((item, i) => [
        {
          text: String(i + 1),
          options: { fontSize: 11, align: "center", color: COLORS.darkText, fill: { color: i % 2 === 0 ? COLORS.white : "f8fafc" } },
        },
        {
          text: item.task,
          options: { fontSize: 11, color: COLORS.darkText, fill: { color: i % 2 === 0 ? COLORS.white : "f8fafc" } },
        },
        {
          text: item.assignee,
          options: { fontSize: 11, align: "center", color: COLORS.darkText, fill: { color: i % 2 === 0 ? COLORS.white : "f8fafc" } },
        },
        {
          text: item.deadline || "미정",
          options: { fontSize: 11, align: "center", color: COLORS.darkText, fill: { color: i % 2 === 0 ? COLORS.white : "f8fafc" } },
        },
        {
          text: priorityKorean[item.priority] ?? item.priority,
          options: {
            fontSize: 11, align: "center", bold: true,
            color: item.priority === "high" ? "dc2626" : item.priority === "low" ? "16a34a" : "92400e",
            fill: { color: priorityColors[item.priority] ?? "f1f5f9" },
          },
        },
      ]);

      slide5.addTable([headerRow, ...dataRows], {
        x: 0.4, y: 1.25, w: 12.1,
        border: { type: "solid", pt: 0.5, color: COLORS.border },
        fontFace: "맑은 고딕",
        rowH: 0.55,
        colW: [0.7, 5.8, 1.8, 1.9, 1.9],
      });
    } else {
      slide5.addText("액션 아이템이 없습니다.", {
        x: 0.5, y: 2, w: 12, h: 1,
        fontSize: 14, color: COLORS.mutedText, fontFace: "맑은 고딕",
      });
    }

    // ─────────────────────────────────────────
    // Slide 6: Next Steps / Risks
    // ─────────────────────────────────────────
    const slide6 = pptx.addSlide();
    slide6.background = { color: COLORS.lightGray };
    addSlideHeader(slide6, "다음 단계 및 리스크");

    const nextSteps = extractSection(minutes, "다음 단계");
    const risks = extractSection(minutes, "리스크");

    let yPos = 1.3;

    if (nextSteps.length > 0) {
      slide6.addText("다음 단계", {
        x: 0.5, y: yPos, w: 6, h: 0.4,
        fontSize: 15, bold: true, color: COLORS.teal, fontFace: "맑은 고딕",
      });
      yPos += 0.45;
      nextSteps.slice(0, 4).forEach((step) => {
        slide6.addText(`→  ${step}`, {
          x: 0.7, y: yPos, w: 11.5, h: 0.45,
          fontSize: 13, color: COLORS.darkText, fontFace: "맑은 고딕",
        });
        yPos += 0.5;
      });
    }

    if (risks.length > 0) {
      yPos += 0.2;
      slide6.addText("리스크 및 이슈", {
        x: 0.5, y: yPos, w: 6, h: 0.4,
        fontSize: 15, bold: true, color: "dc2626", fontFace: "맑은 고딕",
      });
      yPos += 0.45;
      risks.slice(0, 3).forEach((risk) => {
        slide6.addText(`⚠  ${risk}`, {
          x: 0.7, y: yPos, w: 11.5, h: 0.45,
          fontSize: 13, color: COLORS.darkText, fontFace: "맑은 고딕",
        });
        yPos += 0.5;
      });
    }

    if (nextSteps.length === 0 && risks.length === 0) {
      slide6.addText("해당 내용이 없습니다.", {
        x: 0.5, y: 2, w: 12, h: 1,
        fontSize: 14, color: COLORS.mutedText, fontFace: "맑은 고딕",
      });
    }

    // Add slide numbers to content slides
    const totalSlides = 6;
    [slide2, slide3, slide4, slide5, slide6].forEach((slide, i) => {
      slide.addText(`${i + 2} / ${totalSlides}`, {
        x: 11.5, y: 6.8, w: 1.5, h: 0.3,
        fontSize: 9, color: COLORS.mutedText, align: "right",
        fontFace: "맑은 고딕",
      });
    });

    // Generate buffer
    const buffer = await pptx.write({ outputType: "nodebuffer" });

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meetingTitle + "_회의록")}.pptx`,
      },
    });
  } catch (err) {
    console.error("PPT export error:", err);
    return NextResponse.json(
      { error: "PPT 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
