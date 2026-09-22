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
      <body className="font-sans">{children}</body>
    </html>
  );
}
