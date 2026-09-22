import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'My Mind OS',
  description:
    'نظام شخصي واحد لتنظيم الأفكار والمشاريع والمصادر والمهام — من فكرة إلى نتيجة إلى تعلّم.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* next/font is preferred, but it fetches from Google at build time, which
            some CI/build environments block. A runtime stylesheet link works
            everywhere (Vercel + CI) and degrades gracefully to the system font. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
