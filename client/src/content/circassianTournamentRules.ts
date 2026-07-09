export const TOURNAMENT_RULES_TITLE = "תקנון חוקי מונדיאל הצ'רקסי 2026"

export interface ScheduleRound {
  day: string
  date: string
  round: number
}

export const SCHEDULE_ROUNDS: ScheduleRound[] = [
  { day: 'שישי', date: '10/07/2026', round: 1 },
  { day: 'שבת', date: '11/07/2026', round: 2 },
  { day: 'שישי', date: '17/07/2026', round: 3 },
  { day: 'שבת', date: '18/07/2026', round: 4 },
  { day: 'שישי', date: '24/07/2026', round: 5 },
  { day: 'שבת', date: '25/07/2026', round: 6 },
  { day: 'שישי', date: '31/07/2026', round: 7 },
  { day: 'שבת (חצי גמר)', date: '01/08/2026', round: 8 },
  { day: 'שבת (גמר)', date: '08/08/2026', round: 9 },
]
