import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null

function getClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      baseURL: 'https://api.anthropic.com',
    })
  }
  return _anthropic
}

export async function generateText(systemPrompt: string, userMessage: string): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })
  const block = message.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function generateTextWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: Anthropic.Tool[]
): Promise<{ text: string; toolUses: Anthropic.ToolUseBlock[] }> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    tools,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  const toolUses = message.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  )

  return { text, toolUses }
}

// ─── Claude Vision ────────────────────────────────────────────────────────────

export interface ImageAnalysis {
  description: string       // What Claude sees in the image
  product: string           // Product name / item
  colors: string[]          // Dominant colors
  silhouette: string        // Garment shape / cut
  styling: string           // How it's styled
  mood: string              // Aesthetic mood / vibe
  dallePrompt: string       // Ready-made DALL-E 3 prompt for a similar image
  captionAngle: string      // Best angle for writing a caption about this image
  contentIdeas: string[]    // 3 content ideas based on this image
}

type ImageSource =
  | { type: 'url'; url: string }
  | { type: 'base64'; data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }

export async function analyzeImage(
  source: ImageSource,
  systemContext?: string
): Promise<ImageAnalysis> {
  const imageBlock: Anthropic.ImageBlockParam =
    source.type === 'url'
      ? { type: 'image', source: { type: 'url', url: source.url } }
      : { type: 'image', source: { type: 'base64', media_type: source.mediaType, data: source.data } }

  const system = systemContext ?? `You are a visual content analyst and content strategist.
Analyse images with expert precision — identifying products, styling, colors, and content opportunities.`

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system,
    messages: [
      {
        role: 'user',
        content: [
          imageBlock,
          {
            type: 'text',
            text: `Analyse this image for content strategy. Return ONLY valid JSON matching this exact shape:
{
  "description": "Describe everything visible — list ALL products/items shown, how each is styled or presented, setting, and mood. If no specific product is shown (e.g. lifestyle or setting shot), describe the scene. Be specific and comprehensive.",
  "product": "ALL products and items visible, comma-separated. If none, write 'none'.",
  "colors": ["color1", "color2", "color3"],
  "silhouette": "description of the shape/form of the main product or subject, or 'n/a' if not applicable",
  "styling": "how the subject is styled or presented — layers, accessories, plating, props, etc. Or describe the scene.",
  "mood": "the aesthetic mood and vibe of the image",
  "dallePrompt": "a detailed DALL-E 3 prompt to generate a similar editorial image in the same style, mood, and composition",
  "captionAngle": "the strongest hook or angle for a social media caption covering everything shown — not just one item",
  "contentIdeas": ["idea 1", "idea 2", "idea 3"]
}`,
          },
        ],
      },
    ],
  })

  const text = message.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No text response from Claude Vision')

  const jsonMatch = text.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse JSON from Claude Vision response')

  return JSON.parse(jsonMatch[0]) as ImageAnalysis
}
