// Canva Connect API client
// Docs: https://www.canva.dev/docs/connect/

const CANVA_BASE = 'https://api.canva.com/rest/v1'

function canvaHeaders() {
  return {
    Authorization: `Bearer ${process.env.CANVA_CLIENT_SECRET}`,
    'Content-Type': 'application/json',
  }
}

export async function createDesignFromTemplate(params: {
  title: string
  designType?: string
}): Promise<{ id: string; editUrl: string; viewUrl: string }> {
  const res = await fetch(`${CANVA_BASE}/designs`, {
    method: 'POST',
    headers: canvaHeaders(),
    body: JSON.stringify({
      title: params.title,
      asset_type: params.designType ?? 'INSTAGRAM_POST',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Canva create design failed: ${err}`)
  }

  const { design } = await res.json()
  return {
    id: design.id,
    editUrl: design.urls.edit_url,
    viewUrl: design.urls.view_url,
  }
}
