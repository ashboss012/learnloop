import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LearnLoop',
  description: 'A fun, forgiving way to practice math',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
