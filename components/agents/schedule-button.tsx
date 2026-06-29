'use client'

import { useState } from 'react'
import { Clock, Check, X } from 'lucide-react'

interface Props {
  platform: 'instagram' | 'tiktok'
  mediaUrl: string
  mediaType: 'IMAGE' | 'REELS'
  caption: string
  label?: string
}

const TIME_SLOTS = [
  { label: '9:00 AM',  utcHour: 2  },
  { label: '12:00 PM', utcHour: 5  },
  { label: '3:00 PM',  utcHour: 8  },
  { label: '6:00 PM',  utcHour: 11 },
  { label: '9:00 PM',  utcHour: 14 },
]

function getTodayWIB() {
  // Return today's date string in WIB (UTC+7)
  const now = new Date()
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return wib.toISOString().slice(0, 10)
}

function buildScheduledAt(dateStr: string, utcHour: number): string {
  // dateStr is YYYY-MM-DD in WIB — slot is at utcHour UTC = utcHour-7 WIB...
  // actually slot label is WIB time, utcHour is the UTC equivalent
  return `${dateStr}T${String(utcHour).padStart(2, '0')}:00:00.000Z`
}

export function ScheduleButton({ platform, mediaUrl, mediaType, caption, label }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState<typeof TIME_SLOTS[0] | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const isInstagram = platform === 'instagram'
  const gradientClass = isInstagram
    ? 'bg-gradient-to-r from-violet-600 to-pink-600'
    : 'bg-zinc-900'

  const todayWIB = getTodayWIB()

  async function schedule() {
    if (!date || !slot) return
    setStatus('saving')
    const scheduled_at = buildScheduledAt(date, slot.utcHour)
    const res = await fetch('/api/scheduled-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, media_url: mediaUrl, media_type: mediaType, caption, scheduled_at }),
    })
    if (res.ok) {
      setStatus('done')
      setMsg(`Scheduled for ${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${slot.label} WIB`)
      setOpen(false)
    } else {
      const d = await res.json()
      setStatus('error')
      setMsg(d.error ?? 'Failed to schedule')
    }
  }

  if (status === 'done') return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
      <Check className="w-4 h-4 shrink-0" /> {msg}
    </div>
  )

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-center gap-2 w-full rounded-xl text-white text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity ${gradientClass} opacity-80`}
      >
        <Clock className="w-4 h-4" />
        {label ?? `Schedule for ${isInstagram ? 'Instagram' : 'TikTok'}`}
      </button>

      {open && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700">Pick a publish window</span>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={todayWIB}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Time slots */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">Time (WIB)</label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIME_SLOTS.map(s => (
                <button
                  key={s.label}
                  onClick={() => setSlot(s)}
                  className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                    slot?.label === s.label
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-400">Posts publish at the selected window. Max ~3 hours off from chosen time.</p>
          </div>

          <button
            onClick={schedule}
            disabled={!date || !slot || status === 'saving'}
            className="w-full rounded-lg bg-violet-600 text-white text-sm font-semibold py-2 hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {status === 'saving' ? 'Scheduling…' : 'Confirm Schedule'}
          </button>
          {status === 'error' && <p className="text-xs text-red-500 text-center">{msg}</p>}
        </div>
      )}
    </div>
  )
}
