import type { Metadata } from 'next'
import './globals.css'
import Backdrop from '@/components/Backdrop'

export const metadata: Metadata = {
  title: 'pitchstone',
  description: 'Personal notes with voice input, wiki links, and real-time sync',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Backdrop />
        {children}
      </body>
    </html>
  )
}
