import express from 'express'
import cors from 'cors'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// ── Load all .md files from /context at startup ──────────────────────────────
function loadContext() {
  const contextDir = path.join(ROOT, 'context')

  if (!fs.existsSync(contextDir)) {
    console.warn('⚠️  No context/ folder found. Create it and add .md files.')
    return ''
  }

  const files = fs.readdirSync(contextDir)
    .filter(f => f.endsWith('.md'))
    .sort()

  if (files.length === 0) {
    console.warn('⚠️  context/ folder is empty.')
    return ''
  }

  console.log(`📄  Loaded context: ${files.join(', ')}`)

  return files.map(file => {
    const raw = fs.readFileSync(path.join(contextDir, file), 'utf-8')
    const label = file.replace('.md', '').replace(/-/g, ' ')
    return `### ${label}\n\n${raw}`
  }).join('\n\n---\n\n')
}

const CONTEXT = loadContext()

const SYSTEM_PROMPT = `You are a concise, friendly AI assistant on Muhamad Arvin Zulfikar's personal portfolio website.

Your only job is to answer questions about Arvin using the context below. Follow these rules strictly:

1. Keep answers short — 2 to 4 sentences unless the user asks for detail.
2. Be warm and professional. Refer to Arvin in third person.
3. If something is not covered in the context, say: "I don't have that detail, but you can reach Arvin at zulfikararvin@gmail.com"
4. Never invent or guess information.
5. Do not answer questions unrelated to Arvin (e.g. general coding questions, world events).

--- ARVIN'S CONTEXT ---

${CONTEXT}

--- END OF CONTEXT ---`

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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT
    })

    // Support multi-turn by replaying conversation history
    const chat = model.startChat({
      history: history.map(turn => ({
        role: turn.role,          // 'user' | 'model'
        parts: [{ text: turn.content }]
      }))
    })

    const result = await chat.sendMessage(message.trim())
    const response = result.response.text()

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
