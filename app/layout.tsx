import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '슈퍼 엘니뇨 이상기후 모니터링 대시보드',
  description: '기상청 단기예보 및 Gemini 1.5 Flash 기반 이상기후 실시간 관제 및 시민/농가 방재 행동 요령',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
