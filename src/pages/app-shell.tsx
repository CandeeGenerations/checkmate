import {ItemDialog} from '@/components/item-dialog'
import {LoginDialog} from '@/components/login-dialog'
import {Button} from '@/components/ui/button'
import {useAuth} from '@/hooks/use-auth'
import type {Frequency} from '@/lib/date'
import {cn} from '@/lib/utils'
import {CalendarClock, CalendarDays, CalendarRange, type LucideIcon, Plus, Sun} from 'lucide-react'
import {useState} from 'react'
import {NavLink, Outlet, useLocation} from 'react-router-dom'

const TABS: ReadonlyArray<{to: string; label: string; frequency: Frequency; icon: LucideIcon}> = [
  {to: '/daily', label: 'Daily', frequency: 'daily', icon: Sun},
  {to: '/weekly', label: 'Weekly', frequency: 'weekly', icon: CalendarDays},
  {to: '/monthly', label: 'Monthly', frequency: 'monthly', icon: CalendarRange},
  {to: '/quarterly', label: 'Quarterly', frequency: 'quarterly', icon: CalendarClock},
]

export function AppShell() {
  const [showAdd, setShowAdd] = useState(false)
  const {authRequired, authenticated, isLoading, logout} = useAuth()
  const showLogin = authRequired && !authenticated && !isLoading
  const location = useLocation()
  const activeTab = TABS.find((t) => location.pathname.startsWith(t.to))
  const defaultFrequency: Frequency = activeTab?.frequency ?? 'daily'
  // Treat the index path as "Daily" so the nav highlights correctly during the first frame,
  // before `<Navigate to="/daily" replace />` redirects.
  const fallbackToDaily = location.pathname === '/'
  const isTabActive = (to: string, isActive: boolean) => isActive || (fallbackToDaily && to === '/daily')

  return (
    // h-svh = small viewport height = guaranteed visible area (iOS standalone PWA reports
    // dvh too large with viewport-fit=cover, leaving phantom space below the nav).
    <div className="flex h-svh flex-col bg-background text-foreground">
      <header className="z-20 shrink-0 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <a href="/" className="flex items-center gap-2">
            <img src="/checkmate-icon.svg" alt="" className="h-8 w-8" />
            <span className="font-display text-2xl tracking-tight">checkmate</span>
          </a>
          {/* Tabs in the top bar — desktop / iPad only. Mobile uses the bottom nav below. */}
          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({isActive}) =>
                  cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    isTabActive(tab.to, isActive)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              New item
            </Button>
            {authenticated && (
              <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto h-full max-w-6xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar — mobile only. Lives as a flex sibling (not fixed) so it always
          pins to the viewport bottom. The env() fallback covers iOS's lazy safe-area reporting. */}
      <nav className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden">
        <div className="flex items-stretch justify-around px-2 pt-1 pb-[env(safe-area-inset-bottom,0.5rem)]">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({isActive}) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                    isTabActive(tab.to, isActive) ? 'text-primary' : 'text-muted-foreground/70',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <LoginDialog open={showLogin} onOpenChange={() => {}} />
      <ItemDialog open={showAdd} onOpenChange={setShowAdd} defaultFrequency={defaultFrequency} />
    </div>
  )
}
