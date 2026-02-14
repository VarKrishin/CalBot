import type { Env } from '../../env.d'
import { getFile, downloadFile } from '../channels/telegram'

const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

/** Encode ArrayBuffer to base64 string (Workers-compatible, no Node Buffer). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function transcribeVoice(env: Env, fileId: string): Promise<string> {
  const { file_path } = await getFile(env, fileId)
  const buffer = await downloadFile(env, file_path)
  const audio = arrayBufferToBase64(buffer)
  const result = await env.AI.run(WHISPER_MODEL, {
    audio,
    language: 'en',
    initial_prompt: 'food, meals, breakfast, lunch, dinner, eggs, chapatis, rice, curry.',
  }) as { text?: string }
  return (result.text ?? '').trim()
}
