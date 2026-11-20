import { cn } from '@/lib/cn'

// Badge uses CSS variable-based chip classes from globals.css.
// No dark: Tailwind prefixes needed — variables handle both modes.

type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple' | 'amber' | 'rose'

const variants: Record<BadgeVariant, string> = {
  blue:   'chip-sent',
  green:  'chip-replied',
  red:    'chip-bounced',
  yellow: 'chip-paused',
  gray:   'chip-pending',
  purple: 'chip-purple',
  amber:  'chip-followup',
  rose:   'chip-bounced',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'gray', className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn('chip', variants[variant], className)}
    />
  )
}
