// CADA Brand Context — injected into all agent system prompts
import { createServiceClient } from '@/lib/supabase'

export interface BrandContext {
  systemPrompt: (agentRole: string) => string
  imagePrompt: string
  referenceImageUrl: string | undefined
  imageQuality: 'low' | 'medium' | 'high'
  driveEnabled: boolean
  driveFolderId: string | undefined
  raw: Record<string, string>
}

export async function getBrandContext(): Promise<BrandContext> {
  const db = createServiceClient()
  const KEYS = [
    'brand_name', 'brand_handle', 'brand_description',
    'brand_products_list', 'brand_price_point', 'brand_markets', 'brand_channels',
    'brand_voice', 'brand_guidelines', 'brand_target_customer',
    'brand_campaign_theme', 'brand_caption_examples',
    'brand_style_prefix', 'brand_negative_prompts', 'brand_color_description',
    'brand_shot_style', 'brand_colors',
    'brand_style_reference_url', 'brand_color_swatch_url',
    'brand_model_reference_url', 'brand_logo_url',
    'image_quality', 'drive_media_upload_enabled', 'drive_media_folder_id',
  ]
  const { data } = await db.from('cada_settings').select('key, value').in('key', KEYS)
  const raw: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.value && row.value !== 'null') {
      raw[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
    }
  }

  // Build image prompt from Visual Kit fields
  let colorContext = raw.brand_color_description || ''
  if (raw.brand_colors) {
    try {
      const hexes: string[] = JSON.parse(raw.brand_colors)
      if (hexes.length) colorContext = `Color palette: ${hexes.join(', ')}${colorContext ? `. ${colorContext}` : ''}`
    } catch { /* ignore */ }
  }
  const imagePromptParts = [
    raw.brand_style_prefix,
    colorContext,
    raw.brand_shot_style,
  ].filter(Boolean)
  const imagePromptBase = imagePromptParts.join('. ')
  const imagePrompt = raw.brand_negative_prompts
    ? `${imagePromptBase}${imagePromptBase ? '. ' : ''}Avoid: ${raw.brand_negative_prompts}`
    : imagePromptBase

  const referenceImageUrl = raw.brand_model_reference_url || raw.brand_style_reference_url || undefined

  return {
    systemPrompt: (agentRole: string) => getBrandSystemPrompt(agentRole, raw),
    imagePrompt,
    referenceImageUrl,
    imageQuality: (raw.image_quality as BrandContext['imageQuality']) || 'medium',
    driveEnabled: raw.drive_media_upload_enabled === 'true',
    driveFolderId: raw.drive_media_folder_id || undefined,
    raw,
  }
}

export const BRAND = {
  name: 'CADA',
  handle: 'wear_cada',
  tagline: 'Modest fashion for the modern Muslim woman',
  description: `CADA (wear_cada) is an Indonesian modest fashion brand selling Muslim-friendly womenswear.
We design elegant, covered clothing that is fashionable, comfortable, and appropriate for Muslim women.
Our aesthetic is sophisticated and understated — think quiet luxury meets modest everyday dressing.`,

  markets: ['Indonesia', 'Singapore'],
  channels: ['Shopee', 'TikTok Shop', 'Tokopedia', 'Instagram', 'TikTok'],
  pricePoint: 'affordable-mid (Rp 280,000 – Rp 400,000 / SGD 25–35)',
  currency: 'IDR (Rp) for Indonesia, SGD for Singapore',

  products: [
    { name: 'Pleated Linen Pants', price: 'Rp 350,000', notes: 'Wide-leg, high-waist, navy' },
    { name: 'Butter Yellow Ruffle Sleeve Button-Up Shirt', price: 'Rp 280,000', notes: 'Loose fit, feminine, modest' },
    { name: 'High Waisted Denim Maxi Skirt', price: 'Rp 385,000', notes: 'Full coverage, A-line, dark wash' },
  ],

  brandColor: '#6B0F2B', // Deep burgundy/maroon
  aesthetics: ['quiet luxury', 'modest chic', 'clean minimal', 'sophisticated everyday'],

  voiceAndTone: `
- Warm, elegant, and aspirational — never preachy or overly religious
- Indonesian and Singaporean Muslim women aged 20–35
- Speaks to women who want to look polished and on-trend while being covered
- Mix of English and occasional Bahasa Indonesia phrases is appropriate (e.g. "Yuk, tampil cantik!")
- Never use words: revealing, sexy, bare, skin-baring
- Always use: modest, covered, elegant, effortless, feminine, everyday luxury`,

  social: {
    instagram: 'https://www.instagram.com/wear_cada',
    tiktok: 'https://www.tiktok.com/@wear_cada',
    shopee: 'https://shopee.co.id/wearcada',
  },

  contentGuidelines: `
- All clothing must be fully covered (wrists, ankles, neckline)
- Models should wear hijab in any visual references
- Captions can mix English + Bahasa Indonesia
- Hashtags: #CADA #wearcada #modestfashion #hijabfashion #ootdmodest #fashionmuslim #bajumuslim
- Platform tone: Instagram = elegant & editorial; TikTok = relatable & conversational
- Price should always be shown in Rp for Indonesian content`,
}

export interface BrandOverrides {
  brand_voice?: string
  brand_guidelines?: string
  brand_target_customer?: string
  brand_campaign_theme?: string
  brand_caption_examples?: string
}

export function getBrandSystemPrompt(agentRole: string, overrides: BrandOverrides = {}): string {
  const name = (overrides as Record<string, string>).brand_name || BRAND.name
  const handle = (overrides as Record<string, string>).brand_handle || BRAND.handle
  const description = (overrides as Record<string, string>).brand_description || BRAND.description
  const pricePoint = (overrides as Record<string, string>).brand_price_point || BRAND.pricePoint
  const markets = (overrides as Record<string, string>).brand_markets || BRAND.markets.join(', ')
  const channels = (overrides as Record<string, string>).brand_channels || BRAND.channels.join(', ')
  const productsList = (overrides as Record<string, string>).brand_products_list
  const products = productsList
    ? productsList.split('\n').filter(Boolean).map(l => `- ${l.trim()}`).join('\n')
    : BRAND.products.map(p => `- ${p.name} (${p.price}): ${p.notes}`).join('\n')

  const voice = overrides.brand_voice || BRAND.voiceAndTone
  const guidelines = overrides.brand_guidelines || BRAND.contentGuidelines
  const targetCustomer = overrides.brand_target_customer || 'Indonesian and Singaporean Muslim women aged 20–35'
  const campaignTheme = overrides.brand_campaign_theme
  const captionExamples = overrides.brand_caption_examples

  return `You are the ${agentRole} for ${name} (${handle}).

BRAND OVERVIEW:
${description}

PRODUCTS (current range):
${products}

PRICE POINT: ${pricePoint}
MARKETS: ${markets}
SALES CHANNELS: ${channels}

TARGET CUSTOMER:
${targetCustomer}

BRAND VOICE & TONE:
${voice}

CONTENT GUIDELINES:
${guidelines}
${campaignTheme ? `\nCURRENT CAMPAIGN THEME:\n${campaignTheme}` : ''}
${captionExamples ? `\nCAPTION STYLE EXAMPLES (match this voice and style):\n${captionExamples}` : ''}

Always tailor every output specifically for ${name}. Reference real product names, correct price points, and appropriate aesthetics.`
}
