export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') || 'United States'

  const q = encodeURIComponent('tariffs OR "freight rates" OR "supply chain" OR "port congestion" OR "fuel prices" OR shipping OR logistics OR "food prices" OR drought OR hurricane OR "labor strike" OR sanctions OR conflict OR war OR blockade OR "trade route" OR "Red Sea" OR "Strait of Hormuz" OR "military escalation"')

  try {
    const gnewsRes = await fetch(
      `https://gnews.io/api/v4/search?q=${q}&lang=en&max=20&apikey=${process.env.GNEWS_KEY}`
    )
    const gnewsData = await gnewsRes.json()

    if (!gnewsData.articles?.length) {
      return new Response(JSON.stringify({ headlines: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const urlMap = {}
    gnewsData.articles.forEach(a => { if (a.title) urlMap[a.title] = a.url })
    const headlines = [...new Set(gnewsData.articles.map(a => a.title))]

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
        max_tokens: 768,
        messages: [{
          role: 'user',
          content: `You are filtering news headlines for operations managers in grocery distribution and supply chain. Review these headlines and select the 8-10 most operationally relevant ones. A headline is relevant if it has any direct or indirect impact on: transportation costs, fuel prices, port or freight delays, trade policy, labor availability, weather disruptions, food or consumer goods pricing, global supply chain stability, or global conflicts that could disrupt trade routes, shipping lanes, or regional supply chains.\n\nFor each selected headline assign an impact level using these strict criteria:\n\n- High: Active, confirmed disruption happening NOW. Examples: port strike underway, shipping lane blocked, major hurricane making landfall near port, sudden large tariff imposed, military conflict actively disrupting trade routes, fuel price spike >10% this week.\n- Moderate: Developing risk or trend with growing probability of impact. Examples: strike vote scheduled, tariff negotiations ongoing, tropical storm tracking toward port, freight rates rising over past month, geopolitical tension escalating.\n- Low: Background context, long-term trends, or minor relevance. Examples: industry reports, technology adoption stats, forecasts beyond 30 days, policy discussions with no imminent timeline.\n\nBe decisive — only use Moderate if it genuinely does not qualify as High or Low. Aim for a realistic distribution across all three levels.\n\nReturn ONLY a valid JSON array of objects in this exact format, nothing else:\n[{"headline": "...", "impact": "High|Moderate|Low"}, ...]\n\nHeadlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || '[]'

    try {
      const filtered = JSON.parse(text)
      if (Array.isArray(filtered) && filtered.length && typeof filtered[0] === 'object') {
        // New format: [{ headline, impact }]
        const seen = new Set()
        const result = filtered.filter(item => {
          if (!item.headline || seen.has(item.headline)) return false
          seen.add(item.headline)
          return true
        }).map(item => ({ ...item, url: urlMap[item.headline] || null }))
        return new Response(JSON.stringify({ headlines: result }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
      // Fallback: plain string array (old format)
      const result = [...new Set(Array.isArray(filtered) && filtered.length ? filtered : headlines.slice(0, 10))]
      return new Response(JSON.stringify({ headlines: result.map(h => ({ headline: h, impact: 'Moderate' })) }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    } catch {
      return new Response(JSON.stringify({ headlines: headlines.slice(0, 10).map(h => ({ headline: h, impact: 'Moderate' })) }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, headlines: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
