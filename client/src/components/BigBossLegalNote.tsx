import BigBossName from './BigBossName'
import type { ReactNode } from 'react'

type BigBossLegalNoteProps = {
  children: ReactNode
}

const BigBossLegalNote = ({ children }: BigBossLegalNoteProps) => (
  <aside className="big-boss-legal-note" aria-label="הודעת משחק תפקידים">
    <BigBossName stacked />
    <p className="mb-0">{children}</p>
  </aside>
)

export default BigBossLegalNote
