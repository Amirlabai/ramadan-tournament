import AccessibleModal from './AccessibleModal'
import BigBossName from './BigBossName'

type BigBossDailyDecreeProps = {
  open: boolean
  onAcknowledge: () => void
}

const BigBossDailyDecree = ({ open, onAcknowledge }: BigBossDailyDecreeProps) => (
  <AccessibleModal
    open={open}
    onClose={onAcknowledge}
    titleId="big-boss-decree-title"
    className="big-boss-modal"
    dialogClassName="big-boss-dialog"
    centered={false}
  >
    <div className="big-boss-dialog__panel" data-roleplay-bypass>
      <p className="big-boss-dialog__eyebrow">צו יומי מס׳ 88</p>
      <h2 id="big-boss-decree-title">הודעה חגיגית לתושבי הכפר</h2>
      <BigBossName stacked />
      <p>
        הבוס הגדול שמח להודיע כי גם היום הותר לכם לצפות בתוצאות, לקרוא חדשות
        ולהתרשם מנדיבותו יוצאת הדופן.
      </p>
      <p>
        כל הצלחה בטורניר מיוחסת לחזונו. כל תקלה תועבר לוועדה שתוקם בעתיד.
      </p>
      <button
        type="button"
        className="btn big-boss-dialog__primary"
        onClick={onAcknowledge}
        data-roleplay-bypass
      >
        קיבלתי את דבר הבוס
      </button>
    </div>
  </AccessibleModal>
)

export default BigBossDailyDecree
