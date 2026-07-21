import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { loadContext, buildSystemPrompt, getChatResponse } from './_shared.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

dotenv.config({ path: path.join(ROOT, '.env') })

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const CONTEXT = loadContext(ROOT)
const SYSTEM_PROMPT = buildSystemPrompt(CONTEXT)

// ── POST /api/chat ────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured. Copy .env.example to .env and add your key.'
    })
  }

  try {
    const response = await getChatResponse({
      message,
      history,
      apiKey: process.env.GEMINI_API_KEY,
      systemPrompt: SYSTEM_PROMPT
    })
    res.json({ response })
  } catch (err) {
    console.error('Gemini error:', err.message)
    res.status(500).json({ error: 'Failed to get a response. Please try again.' })
  }
})

app.listen(PORT, () => {
  console.log(`\n🚀  API server → http://localhost:${PORT}`)
  console.log(`📖  Context loaded: ${CONTEXT ? 'yes' : 'none — add .md files to /context'}`)
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set — copy .env.example to .env\n')
  }
})
