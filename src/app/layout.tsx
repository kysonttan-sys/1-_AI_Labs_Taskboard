import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskBoard',
  description: 'A modern task management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dark antialiased min-h-screen bg-[var(--bg-base)] text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}