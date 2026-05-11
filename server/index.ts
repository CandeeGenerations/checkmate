import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import path from 'path'
import {fileURLToPath} from 'url'

// Touch the DB module so the connection opens at boot.
import './db/index.js'
import {requireAuth} from './middleware/auth.js'
import {authRouter} from './routes/auth.js'
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
app.use('/api/completions', completionsRouter)
app.use('/api/period', periodRouter)

// In production, serve the built Vite static files.
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Checkmate server running on http://localhost:${PORT}`)
})
