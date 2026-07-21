import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'

// ── Load all .md files from /context ──────────────────────────────────────────
export function loadContext(rootDir) {
  const contextDir = path.join(rootDir, 'context')

  if (!fs.existsSync(contextDir)) return ''

  const files = fs.readdirSync(contextDir)
    .filter(f => f.endsWith('.md'))
    .sort()

  if (files.length === 0) return ''

  return files.map(file => {
    const raw = fs.readFileSync(path.join(contextDir, file), 'utf-8')
    const label = file.replace('.md', '').replace(/-/g, ' ')
    return `### ${label}\n\n${raw}`
  }).join('\n\n---\n\n')
}

export function buildSystemPrompt(context) {
  return `You are a concise, friendly AI assistant on Muhamad Arvin Zulfikar's personal portfolio website.

Your only job is to answer questions about Arvin using the context below. Follow these rules strictly:

1. Keep answers short — 2 to 4 sentences unless the user asks for detail.
2. Be warm and professional. Refer to Arvin in third person.
3. If something is not covered in the context, say: "I don't have that detail, but you can reach Arvin at zulfikararvin@gmail.com"
4. Never invent or guess information.
5. Do not answer questions unrelated to Arvin (e.g. general coding questions, world events).

--- ARVIN'S CONTEXT ---

${context}

--- END OF CONTEXT ---`
}

export async function getChatResponse({ message, history, apiKey, systemPrompt }) {
  const genAI = new GoogleGenerativeAI(apiKey)

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt
  })

  // Support multi-turn by replaying conversation history
  const chat = model.startChat({
    history: history.map(turn => ({
      role: turn.role,          // 'user' | 'model'
      parts: [{ text: turn.content }]
    }))
  })

  const result = await chat.sendMessage(message.trim())
  return result.response.text()
}
