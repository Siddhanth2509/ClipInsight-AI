import type { Metadata } from 'next';
import GlobalOverlays from '@/components/GlobalOverlays';
import SmoothScroll from '@/components/SmoothScroll';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'ClipInsight AI — Turn Any Reel Into AI Intelligence',
  description: 'Paste any Instagram Reel, YouTube Short, or TikTok URL. Six AI engines analyze frames, speech, text, music, emotion, and trends — delivering a complete intelligence report in under 60 seconds.',
  keywords: ['AI video analysis', 'Instagram Reels analyzer', 'YouTube Shorts AI', 'TikTok analytics', 'Gemini AI', 'video intelligence'],
  openGraph: {
    title: 'ClipInsight AI — Turn Any Reel Into AI Intelligence',
    description: 'Six AI engines. One intelligence report. Under 60 seconds.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <SmoothScroll>
          {/* Client-side global overlays: particle field, sakura, cursor */}
          <GlobalOverlays />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}

