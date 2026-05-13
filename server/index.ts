import cookieParser from 'cookie-parser'
import cors from 'cors'
import type {NextFunction, Request, Response} from 'express'
import express from 'express'
import path from 'path'
import {fileURLToPath} from 'url'

// Touch the DB module so the connection opens at boot.
import './db/index.js'
import {Sentry} from './lib/sentry.js'
import {requireAuth} from './middleware/auth.js'
import {authRouter} from './routes/auth.js'
import {categoriesRouter} from './routes/categories.js'
import {completionsRouter} from './routes/completions.js'
import {itemsRouter} from './routes/items.js'
import {periodRouter} from './routes/period.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5186

app.use(cors({origin: true, credentials: true}))
app.use(express.json({limit: '1mb'}))
app.use(cookieParser())

// Open: only the auth endpoints (login/logout/status).
app.use('/api/auth', authRouter)

// Auth gate for everything below.
app.use('/api', requireAuth)
app.use('/api/items', itemsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/completions', completionsRouter)
app.use('/api/period', periodRouter)

// In production, serve the built Vite static files.
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Sentry's Express error handler must come after all routes and before any
// custom error handlers. It reports unhandled errors that bubble up via next(err)
// — which is how asyncHandler() forwards route throws.
Sentry.setupExpressErrorHandler(app)

// Final fallback: convert any error that escapes to a 500. The 4-arg signature
// is required for Express to recognize this as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  if (!res.headersSent) {
    res.status(500).json({error: 'Internal server error'})
  }
})

app.listen(PORT, () => {
  console.log(`Checkmate server running on http://localhost:${PORT}`)
})
