const FR_MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const FR_MONTHS_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function currentYear(): number {
  return new Date().getFullYear()
}

export function currentMonth(): number {
  return new Date().getMonth() + 1
}

export function shortMonth(month: number): string {
  return FR_MONTHS_SHORT[month - 1]
}

export function longMonth(month: number): string {
  return FR_MONTHS_LONG[month - 1]
}

export function monthYearLabel(year: number, month: number): string {
  return `${FR_MONTHS_LONG[month - 1]} ${year}`
}

export function dateYear(date: string): number {
  return parseInt(date.slice(0, 4))
}

export function dateMonth(date: string): number {
  return parseInt(date.slice(5, 7))
}

export function formatDisplayDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
