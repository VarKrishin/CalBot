import type { Env } from '../../env.d'

const TELEGRAM_API = 'https://api.telegram.org'

export async function sendMessage(env: Env, chatId: number, text: string): Promise<void> {
  const url = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: undefined }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Telegram sendMessage failed:', res.status, err)
    throw new Error(`Telegram API error: ${res.status}`)
  }
}

export async function getFile(env: Env, fileId: string): Promise<{ file_path: string }> {
  const url = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Telegram getFile failed: ${res.status}`)
  const data = (await res.json()) as { ok: boolean; result?: { file_path: string } }
  if (!data.ok || !data.result?.file_path) throw new Error('Invalid getFile response')
  return { file_path: data.result.file_path }
}

export async function downloadFile(env: Env, filePath: string): Promise<ArrayBuffer> {
  const url = `${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download file failed: ${res.status}`)
  return res.arrayBuffer()
}
