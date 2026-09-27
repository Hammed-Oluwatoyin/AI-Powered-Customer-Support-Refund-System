const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const shortDateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

/** 80 -> "$80.00" */
export function formatMoney(dollars: number): string {
  return money.format(dollars)
}

/** "2026-06-10T..." -> "10 Jun 2026" */
export function formatDate(iso: string): string {
  return date.format(new Date(iso))
}

/** "2026-06-10T09:30:05Z" -> "10 Jun 2026, 10:30:05" (local time) */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** "2026-06-10T09:30:05Z" -> "10 Jun, 10:30" (local time), for compact tables */
export function formatShortDateTime(iso: string): string {
  return shortDateTime.format(new Date(iso))
}

/** Length in characters as the backend counts them (emoji count once). */
export function characterCount(text: string): number {
  return [...text].length
}
