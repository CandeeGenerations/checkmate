import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
const environment = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE
const release = import.meta.env.VITE_SENTRY_RELEASE as string | undefined

function scrubEvent<T extends Sentry.Event>(event: T): T {
  if (event.request) {
    delete event.request.data
    delete event.request.query_string
    delete event.request.cookies
  }
  return event
}

function scrubBreadcrumb(b: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (b.data) {
    delete b.data.input
    delete b.data.response
  }
  return b
}

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    // 401 cookie expiry surfaces in TanStack Query as `Error("Unauthorized")`;
    // it is product behavior, not a bug. AbortError is route-change fetch cancellation.
    ignoreErrors: ['AbortError', 'Unauthorized'],
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
}

export {Sentry}
