export type AgentId = 'creator' | 'trend_analyst' | 'campaign_planner' | 'performance_reviewer'

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface AgentRun {
  id: string
  agent: AgentId
  status: AgentStatus
  input: Record<string, unknown>
  output: Record<string, unknown>
  error?: string
  duration_ms?: number
  created_at: string
}

export type ContentType = 'caption' | 'description' | 'email' | 'image' | 'video' | 'canva_template' | 'canva'

export interface ContentItem {
  id: string
  type: ContentType
  title: string
  body?: string
  image_url?: string
  video_url?: string
  canva_url?: string
  metadata: Record<string, unknown>
  tags: string[]
  created_at: string
  updated_at: string
}

export interface TrendHashtag {
  tag: string
  platform: 'tiktok' | 'instagram'
  description: string
  tiktok_url: string
  instagram_url: string
}

export interface TrendCreator {
  handle: string
  platform: 'tiktok' | 'instagram'
  followers: string
  reason: string
  url: string
}

export interface TrendContentIdea {
  format: string
  idea: string
  why: string
}

export interface MoodBoardImage {
  id: number
  url: string
  large_url: string
  photographer: string
  photographer_url: string
  alt: string
  pexels_url: string
}

export interface TrendReport {
  id: string
  title: string
  summary?: string
  colors: string[]
  styles: string[]
  silhouettes: string[]
  mood_board_images: MoodBoardImage[]
  trending_hashtags: TrendHashtag[]
  trending_creators: TrendCreator[]
  trending_content: TrendContentIdea[]
  raw_data: Record<string, unknown>
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  description?: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'completed' | 'paused'
  google_drive_url?: string
  todoist_project_id?: string
  calendar_event_ids: string[]
  brief: Record<string, unknown>
  milestones?: CampaignMilestone[]
  created_at: string
  updated_at: string
}

export interface CampaignMilestone {
  id: string
  campaign_id: string
  title: string
  due_date?: string
  week_number?: number
  todoist_task_id?: string
  calendar_event_id?: string
  completed: boolean
  created_at: string
}

export interface PerformanceReport {
  id: string
  title: string
  period_start?: string
  period_end?: string
  metrics: Record<string, unknown>
  insights?: string
  google_drive_url?: string
  raw_csv_url?: string
  created_at: string
}

// Creator agent inputs
export interface CreatorInput {
  task: ContentType
  product?: string
  tone?: string
  platform?: string
  prompt?: string
  additionalContext?: string
  language?: 'english' | 'bahasa-indonesia' | 'bahasa-melayu'
  captionLength?: 'short' | 'standard' | 'long'
  videoLength?: 5 | 10
}

// Trend analyst inputs
export interface TrendInput {
  focus?: string
  season?: string
  market?: string
}

// Campaign planner inputs
export interface CampaignInput {
  name: string
  description: string
  startDate: string
  theme?: string
  budget?: string
  channels?: string[]
}

// Performance reviewer inputs
export interface PerformanceInput {
  title: string
  period?: string
  metricsText?: string
  csvData?: string
}
