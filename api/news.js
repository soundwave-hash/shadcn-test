export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const country = req.query.country || 'United States'

  const q = encodeURIComponent('tariffs OR trade OR inflation OR oil OR shipping OR freight OR weather OR labor OR economy OR sanctions')

  try {
    const gnewsRes = await fetch(
      `https://gnews.io/api/v4/search?q=${q}&lang=en&max=10&apikey=${process.env.GNEWS_API_KEY}`
    )
    const gnewsData = await gnewsRes.json()

    if (!gnewsData.articles?.length) {
      return res.status(200).json({ headlines: [], debug: gnewsData, keyPresent: !!process.env.GNEWS_API_KEY, keyLength: process.env.GNEWS_API_KEY?.length })
    }

    const headlines = gnewsData.articles.map(a => a.title)

    // Claude Haiku — filter and reframe for shipping, logistics & grocery operations
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `You are filtering news headlines for operations managers in shipping, logistics, and grocery distribution. Review these headlines and return ONLY the 5-6 most operationally relevant ones. A headline is relevant if it has any direct or indirect impact on: transportation costs, fuel prices, port or freight delays, trade policy, labor availability, weather disruptions, food or consumer goods pricing, or global supply chain stability. Cast a wide net — macro economic and geopolitical news counts if it has downstream operational consequences.\n\nReturn ONLY a valid JSON array of strings (the selected headline titles), nothing else.\n\nHeadlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || '[]'

    try {
      const filtered = JSON.parse(text)
      return res.status(200).json({ headlines: Array.isArray(filtered) && filtered.length ? filtered : headlines.slice(0, 6) })
    } catch {
      return res.status(200).json({ headlines: headlines.slice(0, 6) })
    }
  } catch (err) {
    console.error('news.js error:', err)
    return res.status(500).json({ error: err.message, headlines: [] })
  }
}
