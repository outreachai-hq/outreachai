# Design System Specifications

## Color System

### Primary Brand Color
```
Brand Blue: #0A66C2 (LinkedIn-inspired)
  Tailwind: bg-blue-600 (900 range)
  Uses: Logo, primary buttons, active states
```

### Semantic Color Palette

| Element | Light Mode | Dark Mode | Purpose |
|---------|-----------|-----------|---------|
| **Backgrounds** | `bg-white` | `dark:bg-gray-950` | Main page backgrounds |
| | `bg-gray-50` | `dark:bg-gray-900/40` | Secondary backgrounds |
| | `bg-gray-100` | `dark:bg-gray-800` | Hover states |
| **Text** | `text-gray-900` | `dark:text-white` | Primary text |
| | `text-gray-600` | `dark:text-gray-400` | Secondary text |
| | `text-gray-500` | `dark:text-gray-500` | Tertiary text (muted) |
| **Borders** | `border-gray-200` | `dark:border-gray-800` | Standard borders |
| | `border-gray-100` | `dark:border-gray-800/50` | Subtle dividers |

### Status Colors

#### Success / Live (Emerald)
```
Light: bg-emerald-50, text-emerald-700, border-emerald-200
Dark:  bg-emerald-950/50, text-emerald-300, border-emerald-800/40
Used for: "Live" badges, successful states, confirmations
```

#### Warning / Coming (Amber)
```
Light: bg-amber-50, text-amber-700, border-amber-200
Dark:  bg-amber-950/50, text-amber-300, border-amber-800/40
Used for: "Coming Soon" badges, warnings, attention needed
```

#### Info / Beta (Blue)
```
Light: bg-blue-50, text-blue-700, border-blue-200
Dark:  bg-blue-950/50, text-blue-300, border-blue-800/40
Used for: "Beta" badges, info banners, feature highlights
```

#### Error / Hot (Rose)
```
Light: bg-rose-50, text-rose-700, border-rose-200
Dark:  bg-rose-950/50, text-rose-300, border-rose-800/40
Used for: "New" badges, errors, hot items
```

#### Pro / Premium (Violet)
```
Light: bg-violet-50, text-violet-700, border-violet-200
Dark:  bg-violet-950/50, text-violet-300, border-violet-800/40
Used for: "Pro" badges, premium features
```

#### Enterprise (Indigo)
```
Light: bg-indigo-50, text-indigo-700, border-indigo-200
Dark:  bg-indigo-950/50, text-indigo-300, border-indigo-800/40
Used for: "Enterprise" badges, enterprise features
```

---

## Typography System

### Font Stack
```css
--font-geist-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-geist-mono: "Geist Mono", monospace;
```

### Type Scale

#### Headings
| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `h1` | `3xl` (30px) | bold (700) | 1.2 | -0.02em | Page titles |
| `h2` | `2xl` (24px) | bold (700) | 1.2 | -0.01em | Section headings |
| `h3` | `lg` (18px) | semibold (600) | 1.25 | 0 | Card titles |
| `h4` | `base` (16px) | semibold (600) | 1.5 | 0 | List item titles |

#### Body Text
| Size | Weight | Line Height | Color | Usage |
|------|--------|-------------|-------|-------|
| `lg` (18px) | 400 | 1.75 | primary | Large body text |
| `base` (16px) | 400 | 1.5 | primary | Standard body text |
| `sm` (14px) | 400 | 1.5 | secondary | Small text, descriptions |
| `xs` (12px) | 400 | 1.5 | tertiary | Labels, helper text |

#### Component Text
| Component | Size | Weight | Example |
|-----------|------|--------|---------|
| **Navigation Items** | `sm` | medium (500) | `text-gray-600 dark:text-gray-400 font-medium` |
| **Section Labels** | `[10px]` | medium (500) | `text-[10px] font-medium text-gray-500 uppercase` |
| **Badges** | `xs` | semibold (600) | `text-xs font-semibold` |
| **Button Text** | `sm` | medium (500) | `text-sm font-medium` |
| **Helper Text** | `xs` | 400 | `text-xs text-gray-500` |

---

## Spacing System

### Scale
```
1 unit = 4px (Tailwind default)

xs:  2px  (0.5)
sm:  4px  (1)
md:  8px  (2)
lg:  12px (3)
xl:  16px (4)
2xl: 24px (6)
3xl: 32px (8)
4xl: 48px (12)
```

### Component Spacing

#### Navigation Items (Sidebar)
```tsx
px-3 py-2.5        // Padding: 12px horizontal, 10px vertical
gap-2.5            // Gap between icon and text: 10px
h-9                // Height: 36px
border-l-2          // Left border width: 2px
pl-2.5              // Left padding when bordered: 10px
```

#### Badges (Pill)
```tsx
px-2 py-0.5        // Padding: 8px horizontal, 2px vertical
rounded-full       // Fully rounded
text-xs            // Font size: 12px
```

#### Buttons (Primary)
```tsx
px-4 py-2.5        // Padding: 16px horizontal, 10px vertical
rounded-lg         // Border radius: 8px
text-sm            // Font size: 14px
```

#### Cards / Containers
```tsx
p-4 md:p-6         // Padding: 16px (mobile), 24px (desktop)
gap-4 md:gap-6     // Gap between items
rounded-lg         // Border radius: 8px
border              // 1px solid border
```

#### Page Content
```tsx
p-6                // Padding: 24px
max-w-7xl          // Max width: 80rem (1280px)
mx-auto            // Center container
```

---

## Component Specifications

### Empty State (ActionableEmptyState)

#### Structure
```
Icon Container (Outer)
  ↓ width: 64px, height: 64px
  Icon (Inner) → width: 32px, height: 32px
  Background: bg-blue-50 dark:bg-blue-950/40
  Border radius: rounded-2xl (16px)
  ↓ margin-bottom: 24px

Title
  ↓ font-size: 24px (text-2xl)
  font-weight: 700 (bold)
  margin-bottom: 8px

Description
  ↓ font-size: 14px (text-sm)
  color: text-gray-600 dark:text-gray-400
  line-height: 1.5 (relaxed)
  margin-bottom: 24px

Helper Text (Optional)
  ↓ font-size: 12px (text-xs)
  padding: 12px (px-3 py-2)
  background: bg-gray-50 dark:bg-gray-900/40
  border: 1px solid border-gray-100 dark:border-gray-800
  border-radius: 8px (rounded-lg)
  margin-bottom: 24px

Primary Button (CTA)
  ↓ width: 100%
  padding: 10px vertical, 16px horizontal (py-2.5 px-4)
  background: bg-blue-600
  color: text-white
  font-weight: 600 (semibold)
  border-radius: 8px (rounded-lg)
  margin-bottom: 12px
  hover: bg-blue-700

Alternate Button
  ↓ width: 100%
  padding: 10px vertical, 16px horizontal
  background: transparent
  color: text-gray-700 dark:text-gray-300
  border-radius: 8px (rounded-lg)
  hover: bg-gray-100 dark:bg-gray-800
```

### Setup Warning Banner (SetupWarningBanner)

#### Structure
```
Container
  ↓ padding: 14px (px-4 py-3.5)
  border-radius: 8px (rounded-lg)
  display: flex, gap: 16px (gap-4)
  border: 1px solid

Icon
  ↓ width: 20px, height: 20px
  margin-top: 4px (mt-0.5)
  flex-shrink-0
  color: variant-specific

Content Wrapper
  ↓ flex-1

Title
  ↓ font-size: 14px (text-sm)
  font-weight: 600 (semibold)
  margin-bottom: 4px

Description
  ↓ font-size: 12px (text-xs)
  line-height: 1.5 (relaxed)
  margin-bottom: 12px

Button
  ↓ font-size: 12px (text-xs)
  font-weight: 600 (semibold)
  padding: 6px vertical, 12px horizontal (py-1.5 px-3)
  border-radius: 4px (rounded)
  transition: colors 150ms

Close Button (X)
  ↓ width: 16px, height: 16px
  flex-shrink-0
  opacity-50 → opacity-100 on hover
  padding: 4px (p-1)
```

#### Variant Styles
```
Warning:
  Container: bg-amber-50 dark:bg-amber-950/40
           border-amber-200 dark:border-amber-800/40
  Icon:     text-amber-600 dark:text-amber-500
  Button:   bg-amber-600 hover:bg-amber-700 text-white

Info:
  Container: bg-blue-50 dark:bg-blue-950/40
           border-blue-200 dark:border-blue-800/40
  Icon:     text-blue-600 dark:text-blue-500
  Button:   bg-blue-600 hover:bg-blue-700 text-white
```

### Getting Started Checklist (GettingStartedChecklist)

#### Header
```
Container
  ↓ padding: 14px (px-4 py-3.5)
  background: gradient-to-r from-blue-50 to-indigo-50
             dark:from-blue-950/40 dark:to-indigo-950/40
  border-radius: rounded-t-lg (top only)
  display: flex, gap: 12px (gap-3)

Chevron Icon
  ↓ width: 20px, height: 20px
  color: text-blue-600 dark:text-blue-400
  transition: transform 200ms (rotate on open)

Title
  ↓ font-size: 14px (text-sm)
  font-weight: 700 (bold)
  color: text-gray-900 dark:text-white

Progress Text
  ↓ font-size: 12px (text-xs)
  color: text-gray-600 dark:text-gray-400
  margin-top: 4px
```

#### Progress Bar
```
Container
  ↓ height: 6px (h-1.5)
  background: bg-blue-200 dark:bg-blue-900/40
  border-radius: rounded-full
  overflow: hidden
  margin: 12px bottom (pb-3)

Progress Fill
  ↓ background: gradient-to-r from-blue-600 to-indigo-600
  height: 100%
  transition: width 500ms ease-out
```

#### Checklist Items
```
Item Container
  ↓ padding: 14px (px-4 py-3.5)
  display: flex, gap: 12px (gap-3)
  border-bottom: 1px solid (except last item)
  border-color: border-blue-100 dark:border-blue-800/20
  background: completed → bg-blue-100/30 dark:bg-blue-900/20

Checkbox
  ↓ width: 20px, height: 20px (flex-shrink-0)
  border: 2px solid
  border-radius: 4px (rounded)
  display: flex items-center justify-center
  transition: all 200ms

  Unchecked:
    border-gray-300 dark:border-gray-600
    hover: border-blue-400 dark:border-blue-500

  Checked:
    background: bg-blue-600 dark:bg-blue-500
    border-color: same as background
    checkmark: ✓ white, w-3 h-3, stroke-width: 3

Content
  ↓ flex-1

Label (Link)
  ↓ font-size: 14px (text-sm)
  font-weight: 600 (semibold)
  color: text-gray-900 dark:text-white
  hover: text-blue-600 dark:text-blue-400
  transition: colors 150ms

Description
  ↓ font-size: 12px (text-xs)
  color: text-gray-600 dark:text-gray-400
  margin-top: 4px

Action Link (uncompleted only)
  ↓ font-size: 12px (text-xs)
  font-weight: 700 (bold)
  color: text-blue-600 dark:text-blue-400
  hover: text-blue-700 dark:text-blue-300
  white-space: nowrap
  margin-left: 8px (ml-2)
  transition: colors 150ms
  text: "Set up →"
```

### Modern Badge (ModernBadge)

#### Universal Styling
```
Container (All Variants)
  ↓ display: inline-flex
  items-center
  border-radius: rounded-full (9999px)
  font-size: 12px (text-xs)
  padding: 2px vertical, 8px horizontal (px-2 py-0.5)
  font-weight: 600 (semibold)
  line-height: none (leading-none)
  border: 1px solid (all variants)

Light Mode:
  background: {color}-100
  text: {color}-700
  border: {color}-200

Dark Mode:
  background: {color}-950/50
  text: {color}-300
  border: {color}-800/40
```

#### Variant Examples
```
Beta (Blue):
  Light: bg-blue-100, text-blue-700, border-blue-200
  Dark:  bg-blue-950/50, text-blue-300, border-blue-800/40

Live (Emerald):
  Light: bg-emerald-100, text-emerald-700, border-emerald-200
  Dark:  bg-emerald-950/50, text-emerald-300, border-emerald-800/40

Soon (Gray):
  Light: bg-gray-100, text-gray-500, border-gray-200
  Dark:  bg-gray-800/50, text-gray-400, border-gray-700/40
```

---

## Dark Mode Guidelines

### Key Principles
1. **Opacity matters:** Use `/40` to `/50` on dark backgrounds for subtlety
2. **Text contrast:** Lighter in dark mode for readability
3. **Borders:** Use opacity-reduced versions
4. **No pure black:** Use `gray-950` or colors with opacity

### Pattern
```tsx
// Light
className="bg-{color}-50 text-{color}-700 border border-{color}-200"

// Dark  
className="dark:bg-{color}-950/50 dark:text-{color}-300 dark:border-{color}-800/40"
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| `sm` | 640px | Small phones |
| `md` | 768px | Tablets, sidebar hide |
| `lg` | 1024px | Desktops |
| `xl` | 1280px | Large desktops |
| `2xl` | 1536px | Extra large |

### Key Media Query Usage
```tsx
// Hide on mobile, show on desktop
hidden md:block

// Sidebar drawer on mobile
fixed md:static

// Responsive padding
p-4 md:p-6 lg:p-8

// Column layout
grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

---

## Animation Specifications

### Transitions
```tsx
// Standard transitions (150ms)
transition-colors
transition-all

// Slower transitions (200ms)
duration-200

// Slow transitions (500ms)
duration-500

// Easing
ease-out  (cubic-bezier(0, 0, 0.2, 1))
```

### Common Patterns
```tsx
// Hover state fade
hover:bg-gray-100 transition-colors

// Checklist progress
transition-all duration-500 ease-out (for progress bar)

// Collapse/expand
rotate-180 transition-transform duration-200
```

---

## Accessibility Specifications

### Focus States
```tsx
// All interactive elements
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
dark:focus:ring-offset-gray-950
```

### Color Contrast
```
WCAG AA Standard: 4.5:1 for normal text, 3:1 for large text

All badge colors meet or exceed this standard in both light and dark modes
```

### Icons
```tsx
// Icon sizing
w-3 h-3  (12px)  — Small inline icons
w-4 h-4  (16px)  — Standard icons
w-5 h-5  (20px)  — Large standalone icons
w-6 h-6  (24px)  — Very large icons

// Icon opacity
Icons use solid color (no transparency)
Hover/disabled states use opacity-50 or color changes
```

---

## Usage Examples

### Creating a New Badge Variant
```tsx
// Add to variantStyles in ModernBadge.tsx
custom: {
  bg: 'bg-custom-100 dark:bg-custom-950/50',
  text: 'text-custom-700 dark:text-custom-300',
  border: 'border border-custom-200 dark:border-custom-800/40',
}

// Use it
<ModernBadge variant="custom" label="Custom" />
```

### Extending Empty State
```tsx
// Change the icon size
icon className="w-12 h-12"  // Standard: w-8 h-8

// Change button styling
// Primary: bg-blue-600, Secondary: bg-gray-100

// Adjust spacing for different content
mb-6 vs mb-8 (24px vs 32px)
```

### Custom Section
```tsx
// If adding a custom section to sidebar
<p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 mb-2 mt-4">
  {label}
</p>

// Then add items using NavItem component
```

---

## File References

- **Colors:** Tailwind config (implicit in classNames)
- **Fonts:** Next.js font imports (app/layout.tsx)
- **Components:** webapp/components/
- **Current page implementations:** REFERENCE_IMPLEMENTATION.md
