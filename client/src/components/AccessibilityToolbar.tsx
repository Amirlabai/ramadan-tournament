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
        aria-label={highContrastActive ? 'כבה ניגודיות גבוהה' : 'הפעל ניגודיות גבוהה'}
        title={
          highContrastActive
            ? 'כבה ניגודיות גבוהה. לחץ שוב לצבעי ברירת מחדל'
            : 'הפעל ניגודיות גבוהה'
        }
      >
        <i className="bi bi-circle-half a11y-toolbar-icon" aria-hidden="true" />
      </button>
    </div>
  )
}

export default AccessibilityToolbar
