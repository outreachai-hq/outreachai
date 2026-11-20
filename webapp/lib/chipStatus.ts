// Single source of truth for status → chip CSS class mapping.
// Uses CSS variables defined in globals.css — no Tailwind dark: prefixes needed.
// Usage: className={chipClass('replied')}  or  className={`chip ${chipVariant('sent')}`}

const STATUS_MAP: Record<string, string> = {
  // Success / green
  replied:      'chip-replied',
  success:      'chip-replied',
  won:          'chip-replied',
  active:       'chip-replied',
  connected:    'chip-replied',
  completed:    'chip-replied',

  // Info / blue
  sent:         'chip-sent',
  info:         'chip-sent',
  in_progress:  'chip-sent',
  sending:      'chip-sent',
  qualified:    'chip-sent',

  // Neutral / gray
  pending:      'chip-pending',
  draft:        'chip-pending',
  neutral:      'chip-pending',

  // Warning orange — follow-up, opened
  followup:     'chip-followup',
  follow_up:    'chip-followup',
  opened:       'chip-followup',
  callback:     'chip-followup',

  // Warning yellow — paused, scheduled
  paused:       'chip-paused',
  scheduled:    'chip-paused',

  // Error / red
  bounced:      'chip-bounced',
  error:        'chip-bounced',
  lost:         'chip-bounced',
  failed:       'chip-bounced',
  declined:     'chip-bounced',
  not_interested: 'chip-bounced',
  wrong_number: 'chip-bounced',
  left_voicemail: 'chip-bounced',

  // Purple
  ab_testing:   'chip-ab',
  ab:           'chip-ab',
  interested:   'chip-purple',
}

/**
 * Returns the full chip className string for a given status.
 * e.g. chipClass('replied') → 'chip chip-replied'
 */
export function chipClass(status: string | null | undefined): string {
  if (!status) return 'chip chip-pending'
  const key = status.toLowerCase().replace(/[\s-]/g, '_')
  const variant = STATUS_MAP[key] ?? 'chip-pending'
  return `chip ${variant}`
}

/**
 * Returns just the variant class (without base 'chip') for custom styling.
 * e.g. chipVariant('active') → 'chip-replied'
 */
export function chipVariant(status: string | null | undefined): string {
  if (!status) return 'chip-pending'
  const key = status.toLowerCase().replace(/[\s-]/g, '_')
  return STATUS_MAP[key] ?? 'chip-pending'
}

/**
 * Humanises a status string: 'in_progress' → 'In Progress'
 */
export function chipLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
