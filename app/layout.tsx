import './globals.css'

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
    <html lang="en">
      <body className="bg-white text-slate-900">{children}</body>
    </html>
  )
}
