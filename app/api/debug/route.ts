import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cwd = process.cwd()
  // list all env keys that look like ours
  const ourKeys = Object.keys(process.env).filter(k =>
    ['ANTHROPIC','OPENAI','SUPABASE','RUNWAYML','TODOIST','GOOGLE','CANVA','NEXT_PUBLIC'].some(p => k.startsWith(p))
  )
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  return NextResponse.json({
    hasAnthropicKey: !!key,
    keyLength: key?.length ?? 0,
    keyPrefix: key?.substring(0, 14) ?? 'MISSING',
    supabaseUrl: supaUrl ? supaUrl.substring(0, 30) + '...' : 'MISSING',
    anthropicBaseUrl: baseUrl ?? 'not set',
    cwd,
    foundEnvKeys: ourKeys,
  })
}
