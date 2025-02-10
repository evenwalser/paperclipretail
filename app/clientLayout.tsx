'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup')

  return (
    <div className="flex min-h-screen">
      {!isAuthPage && <Sidebar />}
      <main className="flex-1">{children}</main>
    </div>
  )
} 