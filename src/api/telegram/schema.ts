/** Telegram webhook update payload (minimal for our handler). */
export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name?: string; username?: string }
  chat: { id: number; type: string }
  date: number
  text?: string
  voice?: { file_id: string; duration?: number }
}
