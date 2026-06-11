import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "반도체 회의 AI 어시스턴트",
  description: "실시간 회의록 생성 및 액션 아이템 도출 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
