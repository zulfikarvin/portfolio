import { loadContext, buildSystemPrompt, getChatResponse } from './_shared.js'

const CONTEXT = loadContext(process.cwd())
const SYSTEM_PROMPT = buildSystemPrompt(CONTEXT)

// ── Vercel serverless function: POST /api/chat ────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, history = [] } = req.body || {}

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server.'
    })
  }

  try {
    const response = await getChatResponse({
      message,
      history,
      apiKey: process.env.GEMINI_API_KEY,
      systemPrompt: SYSTEM_PROMPT
    })
    res.status(200).json({ response })
  } catch (err) {
    console.error('Gemini error:', err.message)
    res.status(500).json({ error: 'Failed to get a response. Please try again.' })
  }
}
