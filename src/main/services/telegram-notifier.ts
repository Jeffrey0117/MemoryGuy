import https from 'https'

export interface SendResult {
  readonly ok: boolean
  readonly error?: string
}

const REQUEST_TIMEOUT_MS = 15_000

/**
 * Send a plain-text message via the Telegram Bot API.
 * The bot token is used verbatim in the path (Telegram tokens are URL-path safe).
 */
export function sendTelegramMessage(token: string, chatId: string, text: string): Promise<SendResult> {
  return new Promise((resolve) => {
    if (!token || !chatId) {
      resolve({ ok: false, error: 'Telegram token / chat id not configured' })
      return
    }

    const payload = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })

    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ ok: true })
          } else {
            resolve({ ok: false, error: `Telegram API ${res.statusCode}: ${body.slice(0, 200)}` })
          }
        })
      },
    )

    req.on('error', (err) => resolve({ ok: false, error: err.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'Telegram request timed out' })
    })

    req.write(payload)
    req.end()
  })
}
