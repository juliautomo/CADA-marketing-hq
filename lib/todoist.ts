const TODOIST_BASE = 'https://api.todoist.com/rest/v2'

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
  const data = await res.json()
  return data.id as string
}

export async function createTask(params: {
  content: string
  projectId: string
  dueDate?: string
  description?: string
  priority?: 1 | 2 | 3 | 4
}): Promise<string> {
  const res = await fetch(`${TODOIST_BASE}/tasks`, {
    method: 'POST',
    headers: todoistHeaders(),
    body: JSON.stringify({
      content: params.content,
      project_id: params.projectId,
      due_date: params.dueDate,
      description: params.description,
      priority: params.priority ?? 2,
    }),
  })
  const data = await res.json()
  return data.id as string
}
