const TODOIST_BASE = 'https://api.todoist.com/api/v1'

function todoistHeaders() {
  return {
    Authorization: `Bearer ${process.env.TODOIST_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function createProject(name: string): Promise<string> {
  const res = await fetch(`${TODOIST_BASE}/projects`, {
    method: 'POST',
    headers: todoistHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Todoist createProject failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  if (!data.id) throw new Error(`Todoist createProject: no id in response: ${JSON.stringify(data)}`)
  return data.id as string
}

export async function createTask(params: {
  content: string
  projectId?: string
  dueDate?: string
  description?: string
  priority?: 1 | 2 | 3 | 4
}): Promise<string> {
  const body: Record<string, unknown> = {
    content: params.content,
    due_date: params.dueDate,
    description: params.description,
    priority: params.priority ?? 2,
  }
  if (params.projectId) body.project_id = params.projectId

  const res = await fetch(`${TODOIST_BASE}/tasks`, {
    method: 'POST',
    headers: todoistHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Todoist createTask failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data.id as string
}
