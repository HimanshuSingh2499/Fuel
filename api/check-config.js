export default function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json({ configured: false, message: 'ANTHROPIC_API_KEY is not set' })
  res.status(200).json({
    configured: true,
    preview: key.slice(0, 16) + '...',
    length: key.length
  })
}
