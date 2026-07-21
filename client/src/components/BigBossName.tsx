type BigBossNameProps = {
  className?: string
  stacked?: boolean
}

const BigBossName = ({ className = '', stacked = false }: BigBossNameProps) => (
  <strong
    className={`big-boss-name${stacked ? ' big-boss-name--stacked' : ''}${className ? ` ${className}` : ''}`}
  >
    <bdi dir="ltr">Big Boss</bdi>
    <span aria-hidden="true"> </span>
    <bdi dir="rtl">טייקון הכפר</bdi>
  </strong>
)

export default BigBossName
