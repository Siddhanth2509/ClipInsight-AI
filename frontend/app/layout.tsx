import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'ClipInsight AI — 桜の知恵 · Sakura AI Video Analysis',
  description: 'Experience cinematic AI video analysis. Upload a reel or paste a link from Instagram, YouTube or TikTok. ClipInsight AI extracts frames, transcribes audio, and delivers powerful insights — like sakura petals revealing hidden beauty.',
  keywords: ['AI video analysis', 'Instagram Reels AI', 'YouTube Shorts analyzer', 'Gemini AI', 'video insights', 'sakura'],
  openGraph: {
    title: 'ClipInsight AI — 桜の知恵',
    description: 'AI-powered video analysis with a cinematic Japanese aesthetic.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
