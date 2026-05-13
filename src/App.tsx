import {Sentry} from '@/lib/sentry'
import {Toaster} from '@/components/ui/sonner'
import {AppShell} from '@/pages/app-shell'
import {DailyPage} from '@/pages/daily-page'
import {MonthlyPage} from '@/pages/monthly-page'
import {QuarterlyPage} from '@/pages/quarterly-page'
import {WeeklyPage} from '@/pages/weekly-page'
import {MutationCache, QueryCache, QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom'

function isExpectedAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Unauthorized'
}

const queryClient = new QueryClient({
  defaultOptions: {queries: {staleTime: 30_000, refetchOnWindowFocus: false}},
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (isExpectedAuthError(error)) return
      Sentry.captureException(error, {tags: {queryKey: String(query.queryKey)}})
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isExpectedAuthError(error)) return
      Sentry.captureException(error)
    },
  }),
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/daily" replace />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/weekly" element={<WeeklyPage />} />
            <Route path="/monthly" element={<MonthlyPage />} />
            <Route path="/quarterly" element={<QuarterlyPage />} />
          </Route>
        </Routes>
        <Toaster richColors closeButton position="top-center" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
