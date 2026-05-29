import './globals.css'
import { Space_Grotesk, Bebas_Neue } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
})

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-bebas-neue',
})

export const metadata = {
  title: 'Mana Social LLC Dashboard',
  description: 'Business management for Camera Pho',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${bebasNeue.variable}`}>
      <body style={{ fontFamily: 'var(--font-space-grotesk), -apple-system, BlinkMacSystemFont, sans-serif', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
