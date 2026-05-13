import * as Sentry from '@sentry/node'

// Treat the install.sh placeholders as "unset" so an unconfigured plist no-ops cleanly.
function clean(value: string | undefined): string | undefined {
  if (!value || value.startsWith('__REPLACE_')) return undefined
  return value
}

const dsn = clean(process.env.SENTRY_DSN_SERVER)
const environment = clean(process.env.SENTRY_ENVIRONMENT) ?? 'development'
const release = clean(process.env.SENTRY_RELEASE)

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
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
}

export {Sentry}
