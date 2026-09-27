const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

/** 80 -> "$80.00" */
export function formatMoney(dollars: number): string {
  return money.format(dollars)
}

/** "2026-06-10T..." -> "10 Jun 2026" */
export function formatDate(iso: string): string {
  return date.format(new Date(iso))
}

/** Length in characters as the backend counts them (emoji count once). */
export function characterCount(text: string): number {
  return [...text].length
}
