// Plan 7 — Conversation Labels helper.
//
// Five built-in label keys are seeded the first time a user opens any
// endpoint that needs them (the labels list, or the inbox once it starts
// reading from this table). builtIn=true rows cannot be deleted; the user
// can still rename/recolor them (label/color editable, key locked).

import { prisma } from './prisma'

export const BUILT_IN_LABELS = [
  { key: 'interested',     label: 'Interested',     color: '#10b981', position: 1 },
  { key: 'not_interested', label: 'Not interested', color: '#ef4444', position: 2 },
  { key: 'out_of_office',  label: 'Out of office',  color: '#f59e0b', position: 3 },
  { key: 'favorite',       label: 'Favorite',       color: '#3b82f6', position: 4 },
  { key: 'meeting_booked', label: 'Meeting booked', color: '#8b5cf6', position: 5 },
] as const

/**
 * Ensures the five built-in labels exist for a user. Idempotent via upsert
 * on (userId, key). Safe to call on every inbox/settings load — first call
 * inserts the rows, subsequent calls are no-ops at the DB level.
 */
export async function ensureBuiltinLabels(userId: string): Promise<void> {
  await Promise.all(
    BUILT_IN_LABELS.map((b) =>
      prisma.conversationLabel.upsert({
        where:  { userId_key: { userId, key: b.key } },
        update: {}, // never overwrite user customisations (renamed/recolored)
        create: { ...b, userId, builtIn: true },
      }),
    ),
  )
}

export function slugifyLabelKey(label: string): string {
  return label.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'label'
}
