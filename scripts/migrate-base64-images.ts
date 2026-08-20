/**
 * One-time migration: upload base64 image_url values in cada_content_items
 * to Supabase Storage and replace with public URLs.
 *
 * Run with: npx tsx scripts/migrate-base64-images.ts
 */
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: rows, error } = await db
    .from('cada_content_items')
    .select('id, image_url')
    .like('image_url', 'data:%')

  if (error) throw error
  console.log(`Found ${rows?.length ?? 0} rows with base64 images`)

  for (const row of rows ?? []) {
    try {
      const [header, b64] = (row.image_url as string).split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png'
      const ext = mimeType.includes('png') ? 'png' : 'jpg'
      const path = `gpt/migrated-${row.id}.${ext}`
      const buffer = Buffer.from(b64, 'base64')

      const { error: uploadError } = await db.storage
        .from('product-images')
        .upload(path, buffer, { contentType: mimeType, upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = db.storage.from('product-images').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      await db.from('cada_content_items').update({ image_url: publicUrl }).eq('id', row.id)
      console.log(`✓ ${row.id} → ${publicUrl}`)
    } catch (e) {
      console.error(`✗ ${row.id}:`, e)
    }
  }

  console.log('Done.')
}

main().catch(console.error)
