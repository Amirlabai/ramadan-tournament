import { useA11yPreferences } from '../contexts/A11yPreferencesContext'
import './AccessibilityToolbar.css'

const AccessibilityToolbar = () => {
  const { highContrastActive, toggleHighContrast } = useA11yPreferences()

  return (
    <div
      className="a11y-toolbar"
      role="region"
      aria-label="התאמות נגישות"
    >
      <button
        type="button"
        className={`a11y-toolbar-btn ${highContrastActive ? 'is-active' : ''}`}
        onClick={toggleHighContrast}
        aria-pressed={highContrastActive}
        title={
          highContrastActive
            ? 'כבה ניגודיות גבוהה — לחץ שוב לצבעי ברירת מחדל'
            : 'הפעל ניגודיות גבוהה'
        }
      >
        <span className="a11y-toolbar-icon" aria-hidden="true">
          ◐
        </span>
        <span className="a11y-toolbar-label">ניגודיות גבוהה</span>
      </button>
    </div>
  )
}

export default AccessibilityToolbar
