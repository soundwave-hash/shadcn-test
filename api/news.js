export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const country = req.query.country || 'United States'

  const q = encodeURIComponent(
    '"supply chain" OR "food prices" OR "grocery" OR "freight" OR "port delays" OR ' +
    '"fuel prices" OR "gas prices" OR "oil prices" OR "food recall" OR "crop" OR ' +
    '"cold storage" OR "trade tariffs" OR "flooding" OR "hurricane" OR "drought" OR ' +
    '"winter storm" OR "wildfire" OR "inflation" OR "tariffs" OR "trade war" OR ' +
    '"sanctions" OR "strike" OR "labor shortage" OR "minimum wage" OR "immigration" OR ' +
    '"border" OR "election" OR "geopolitical" OR "OPEC" OR "Red Sea" OR "shipping lanes"'
  )

  try {
    const gnewsRes = await fetch(
      `https://gnews.io/api/v4/search?q=${q}&lang=en&max=10&apikey=${process.env.GNEWS_API_KEY}`
    )
    const gnewsData = await gnewsRes.json()

    if (!gnewsData.articles?.length) {
      return res.status(200).json({ headlines: [] })
    }

    const headlines = gnewsData.articles.map(a => a.title)

    // Claude Haiku second-pass filter
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
          content: `You are filtering news headlines for a grocery warehouse distribution manager in ${country}. Review these headlines and return ONLY the 5-6 most operationally relevant ones. A headline is relevant if it has direct or indirect implications for: supply chain costs, inventory availability, transportation delays, food prices, labor disruptions, weather affecting distribution, fuel/energy costs, trade/tariffs, or food safety. Political, social, or weather news is relevant ONLY if it has downstream operational impact.\n\nReturn ONLY a valid JSON array of strings (the selected headline titles), nothing else.\n\nHeadlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || '[]'

    try {
      const filtered = JSON.parse(text)
      return res.status(200).json({ headlines: Array.isArray(filtered) ? filtered : headlines.slice(0, 6) })
    } catch {
      return res.status(200).json({ headlines: headlines.slice(0, 6) })
    }
  } catch (err) {
    console.error('news.js error:', err)
    return res.status(500).json({ error: err.message, headlines: [] })
  }
}
