import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageBase64, mediaType } = req.body
  if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Missing image data' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `You are a nutrition expert. Analyze this meal photo and estimate the nutritional content for the full plate shown.

Return ONLY a valid JSON object — no explanation, no markdown, just raw JSON:
{
  "name": "short meal name (e.g. Dal + 2 Roti + Sabzi)",
  "cal": <total calories as integer>,
  "protein": <protein in grams as number>,
  "carbs": <carbs in grams as number>,
  "fat": <fat in grams as number>,
  "breakdown": "one line describing what you see and portion sizes"
}

Guidelines:
- Use typical Indian portion sizes if it looks like Indian food
- Be conservative (slightly underestimate rather than overestimate)
- If you cannot identify the food clearly, still give your best estimate`
          }
        ]
      }]
    })

    const text = message.content[0].text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0])
    res.status(200).json(json)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown server error' })
  }
}
