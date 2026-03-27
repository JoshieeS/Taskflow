// AI models have timezone blindness — they don't know what "Sunday" means
// in the user's local timezone unless you tell them explicitly, and even
// then they can be off by a day when the UTC offset crosses midnight.
//
// A deterministic algorithm is:
//   - Instant (no network round-trip)
//   - Always correct to the user's local timezone (uses browser Date API)
//   - Testable and debuggable
//   - Free
//
// ALGORITHM:
//   1. Run the raw title through a set of regex patterns
//   2. For each match, resolve it to an actual local Date object
//   3. Convert to ISO string in LOCAL time (not UTC)
//   4. Strip the matched phrase from the title
//   5. Return { cleanTitle, isoDate | null }
//
// The key insight for "next Sunday" etc:
//   - Get today's day of week (0=Sun, 1=Mon ... 6=Sat)
//   - Calculate how many days until the target day
//   - Add that many days to today's local date
//   - This is always correct regardless of timezone

export interface DateParseResult {
  cleanTitle: string
  isoDate: string | null  // YYYY-MM-DD in user's local timezone, or null
}

function toLocalISO(date: Date): string {
  // Convert a Date to YYYY-MM-DD in the user's LOCAL timezone
  // Using toISOString() would give UTC date which can be wrong by 1 day
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function nextWeekday(dayIndex: number): Date {
  const today = new Date()
  const todayIndex = today.getDay()
  let daysUntil = dayIndex - todayIndex

  if (daysUntil <= 0) daysUntil += 7

  return addDays(today, daysUntil)
}

// Weekday name → index map
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  // Short forms
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

// Each pattern: { regex, resolver }
// The resolver returns a Date based on what was matched
interface DatePattern {
  regex: RegExp
  resolve: (match: RegExpMatchArray) => Date | null
}

const today = () => new Date()
const tomorrow = () => addDays(new Date(), 1)
const inNDays = (n: number) => addDays(new Date(), n)
const endOfWeek = () => {
  // End of this week = coming Sunday
  return nextWeekday(0)
}

const DATE_PATTERNS: DatePattern[] = [
  // "today" / "due today"
  {
    regex: /\b(?:due\s+)?today\b/i,
    resolve: () => today(),
  },
  // "tomorrow" / "due tomorrow"
  {
    regex: /\b(?:due\s+)?tomorrow\b/i,
    resolve: () => tomorrow(),
  },
  // "this sunday", "this monday" etc — same week
  {
    regex: /\bthis\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i,
    resolve: (m) => {
      const idx = WEEKDAY_INDEX[m[1].toLowerCase()]
      return idx !== undefined ? nextWeekday(idx) : null
    },
  },
  // "next sunday", "next monday" etc — always means 7+ days away
  {
    regex: /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i,
    resolve: (m) => {
      const idx = WEEKDAY_INDEX[m[1].toLowerCase()]
      if (idx === undefined) return null
      // "next" always means strictly next week, so add 7 to whatever nextWeekday returns
      const base = nextWeekday(idx)
      // If nextWeekday returned something within 7 days, push it another week
      const diff = (base.getTime() - today().getTime()) / (1000 * 60 * 60 * 24)
      return diff <= 7 ? addDays(base, 7) : base
    },
  },
  // "coming sunday", "this coming friday"
  {
    regex: /\b(?:this\s+)?coming\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i,
    resolve: (m) => {
      const idx = WEEKDAY_INDEX[m[1].toLowerCase()]
      return idx !== undefined ? nextWeekday(idx) : null
    },
  },
  // Standalone weekday names — "by sunday", "before friday", "on wednesday"
  {
    regex: /\b(?:by|before|on|due)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    resolve: (m) => {
      const idx = WEEKDAY_INDEX[m[1].toLowerCase()]
      return idx !== undefined ? nextWeekday(idx) : null
    },
  },
  // "next week"
  {
    regex: /\bnext\s+week\b/i,
    resolve: () => inNDays(7),
  },
  // "this week" / "end of week" / "by end of week"
  {
    regex: /\b(?:this\s+week|end\s+of\s+(?:the\s+)?week|by\s+end\s+of\s+week)\b/i,
    resolve: () => endOfWeek(),
  },
  // "end of month" / "by end of month"
  {
    regex: /\bend\s+of\s+(?:the\s+)?month\b/i,
    resolve: () => {
      const d = new Date()
      return new Date(d.getFullYear(), d.getMonth() + 1, 0) // last day of current month
    },
  },
  // "in 3 days" / "in 2 weeks"
  {
    regex: /\bin\s+(\d+)\s+(day|days|week|weeks)\b/i,
    resolve: (m) => {
      const n = parseInt(m[1])
      const unit = m[2].toLowerCase()
      return inNDays(unit.startsWith('week') ? n * 7 : n)
    },
  },
  // ISO date in title: 2026-04-15
  {
    regex: /\b(\d{4}-\d{2}-\d{2})\b/,
    resolve: (m) => {
      const d = new Date(m[1] + 'T00:00:00') // force local time
      return isNaN(d.getTime()) ? null : d
    },
  },
  // "by [date phrase]" generic — catches leftovers like "by the 15th"
  {
    regex: /\bby\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i,
    resolve: (m) => {
      const day = parseInt(m[1])
      const d = new Date()
      d.setDate(day)
      // If the day has already passed this month, use next month
      if (d < new Date()) d.setMonth(d.getMonth() + 1)
      return d
    },
  },
]

// Phrases that indicate a date context — used for stripping
const DATE_CONTEXT_WORDS = [
  /\bby\b/i,
  /\bbefore\b/i,
  /\bdue\b/i,
  /\bon\b/i,
  /\bdeadline\b/i,
]

export function extractDateFromTitle(rawTitle: string): DateParseResult {
  let cleanTitle = rawTitle
  let isoDate: string | null = null

  for (const pattern of DATE_PATTERNS) {
    const match = cleanTitle.match(pattern.regex)
    if (!match) continue

    const resolved = pattern.resolve(match)
    if (!resolved) continue

    isoDate = toLocalISO(resolved)
    cleanTitle = cleanTitle.replace(match[0], '').trim()

    // Also remove trailing context words left over after stripping
    // e.g. "submit report by" → "submit report"
    for (const ctx of DATE_CONTEXT_WORDS) {
      cleanTitle = cleanTitle.replace(new RegExp(`\\s*${ctx.source}\\s*$`, 'i'), '').trim()
    }

    // Normalise spacing and punctuation left by removal
    cleanTitle = cleanTitle
      .replace(/\s{2,}/g, ' ')    // collapse double spaces
      .replace(/[,;]\s*$/g, '')   // remove trailing comma/semicolon
      .trim()

    break // Stop after first match — one date per task
  }

  return { cleanTitle, isoDate }
}