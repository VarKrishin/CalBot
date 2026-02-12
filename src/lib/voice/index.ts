import type { Env } from '../../env.d'
import { getFile, downloadFile } from '../channels/telegram'

const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

export async function transcribeVoice(env: Env, fileId: string): Promise<string> {
  const { file_path } = await getFile(env, fileId)
  const audio = await downloadFile(env, file_path)
  const result = await env.AI.run(WHISPER_MODEL, { audio }) as { text?: string }
  return (result.text ?? '').trim()
}
