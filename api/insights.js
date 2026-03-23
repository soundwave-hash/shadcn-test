export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  const { headline, country } = await req.json()

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      stream: true,
      messages: [{
        role: 'user',
        content: `You are an AI assistant for grocery distribution and retail operations managers in ${country || 'the United States'}. Your recommendations must always be grounded in the context of grocery supply chains — including perishables, ambient goods, cold chain logistics, store replenishment, vendor sourcing, and last-mile delivery to retail locations.

Analyze this news headline and provide operational insights in EXACTLY this format with no extra text:
IMPACT: [High|Moderate|Low]
• [Specific actionable recommendation for grocery freight, inbound logistics, or distribution center operations in one sentence]
• [Specific actionable recommendation for grocery inventory, perishable sourcing, or supplier diversification in one sentence]
• [Specific actionable recommendation for grocery cost management, pricing exposure, or contingency planning in one sentence]

Headline: "${headline}"`
      }]
    })
  })

  const reader = claudeRes.body.getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(parsed.delta.text))
              }
            } catch {}
          }
        }
      }
      controller.close()
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    }
  })
}
