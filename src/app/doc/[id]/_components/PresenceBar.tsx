'use client'

import type { CollaboratorPresence } from '@/types'

interface PresenceBarProps {
  users: CollaboratorPresence[]
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function PresenceBar({ users }: PresenceBarProps) {
  if (users.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {users.length} active
      </span>
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((u) => (
          <div
            key={u.userId}
            title={u.name}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: u.color }}
          >
            {getInitials(u.name)}
          </div>
        ))}
        {users.length > 5 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-muted-foreground">
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  )
}
