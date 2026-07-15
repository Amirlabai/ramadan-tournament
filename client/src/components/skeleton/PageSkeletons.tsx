import SEO from '../SEO';
import PageSkeletonStatus from './PageSkeletonStatus';
import SkeletonPageTitle from './SkeletonPageTitle';
import SkeletonProfileLayout from './SkeletonProfileLayout';
import SkeletonArchiveLayout from './SkeletonArchiveLayout';
import SkeletonNewsList from './SkeletonNewsList';
import SkeletonDashboardSection from './SkeletonDashboardSection';
import SkeletonMvpPanels from './SkeletonMvpPanels';
import SkeletonWcGroupGrid from './SkeletonWcGroupGrid';
import SkeletonWcTeamsList from './SkeletonWcTeamsList';
import SkeletonScheduleFilters from './SkeletonScheduleFilters';
import SkeletonScheduleMatchList from './SkeletonScheduleMatchList';
import SkeletonTeamsBrowseList from './SkeletonTeamsBrowseList';
import SkeletonStatsLayout from './SkeletonStatsLayout';
import SkeletonGirlsHomeLayout from './SkeletonGirlsHomeLayout';

interface PageSkeletonProps {
  label: string;
}

export function DashboardSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="dashboard-page">
      <SEO
        title="דף הבית"
        description="עקבו אחרי טורניר הרמדאן בזמן אמת - תוצאות, טבלאות, סטטיסטיקות שחקנים וחדשות החוץ והבית של טורניר נצ'מאז כפר כמא 2026."
        pathname="/"
      />
      <div className="container py-4">
        <SkeletonPageTitle />
        <SkeletonDashboardSection variant="next" titleWidth="7rem" count={3} />
        <div className="dashboard-cards-row">
          <SkeletonDashboardSection variant="recent" titleWidth="6.5rem" count={3} />
        </div>
      </div>
    </PageSkeletonStatus>
  );
}

export function WorldCupDashboardSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="dashboard-page">
      <SEO
        title="מונדיאל 2026 — דף הבית"
        description="תוצאות, משחקים קרובים ומלכי השערים — מונדיאל 2026."
        pathname="/world-cup"
      />
      <div className="container py-4">
        <SkeletonPageTitle />
        <SkeletonDashboardSection variant="next" titleWidth="7rem" count={3} />
        <div className="dashboard-cards-row">
          <SkeletonDashboardSection variant="recent" titleWidth="6.5rem" count={3} />
        </div>
      </div>
    </PageSkeletonStatus>
  );
}

export function ScheduleSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="schedule-page container py-4">
      <SEO
        title="לוח משחקים"
        description="לוח המשחקים המלא של טורניר רמדאן 2026. עדכונים חיים, תוצאות וזמני משחקים של כל שלבי הטורניר."
        pathname="/schedule"
      />
      <SkeletonPageTitle />
      <SkeletonScheduleFilters />
      <SkeletonScheduleMatchList count={4} />
    </PageSkeletonStatus>
  );
}

export function WorldCupScheduleSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="schedule-page container py-4">
      <SEO
        title="מונדיאל 2026 — משחקים"
        description="לוח משחקים מלא למונדיאל 2026 — תוצאות, זמנים ומיקומים."
        pathname="/world-cup/schedule"
      />
      <SkeletonPageTitle />
      <SkeletonScheduleFilters />
      <SkeletonScheduleMatchList count={4} />
    </PageSkeletonStatus>
  );
}

export function StatsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="stats-page container py-4">
      <SEO
        title="סטטיסטיקות"
        description="טבלאות ליגה, מלכי השערים וסטטיסטיקות מתקדמות של טורניר רמדאן 2026. עקבו אחרי המירוץ לאליפות ולתואר מלך השערים."
        pathname="/stats"
      />
      <SkeletonPageTitle />
      <SkeletonStatsLayout />
    </PageSkeletonStatus>
  );
}

export function WorldCupStatsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="stats-page wc-stats-page container py-3">
      <SEO
        title="מונדיאל 2026 — סטטיסטיקות"
        description="טבלאות בתים, מלכי השערים ושלב הנוקאאוט — מונדיאל 2026."
        pathname="/world-cup/stats"
      />
      <SkeletonPageTitle />
      <SkeletonWcGroupGrid groupCount={3} rowsPerGroup={4} />
    </PageSkeletonStatus>
  );
}

export function TeamsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="teams-browse-page container py-4">
      <SEO
        title="קבוצות ושחקנים"
        description="רשימת הקבוצות והסגלים המלאים של טורניר נצ'מאז 2026. הכירו את השחקנים, הקפטנים והסטטיסטיקות האישיות של כל קבוצה."
        pathname="/teams"
      />
      <SkeletonPageTitle />
      <SkeletonTeamsBrowseList count={6} />
    </PageSkeletonStatus>
  );
}

export function GirlsTeamsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="teams-browse-page browse-page container py-4">
      <SEO
        title="קבוצות — טורניר בנות"
        description="רשימת הקבוצות והסגלים בטורניר בנות רמדאן 2026, כולל סך נקודות לכל קבוצה."
        pathname="/teams-girls"
      />
      <SkeletonPageTitle />
      <SkeletonTeamsBrowseList count={6} showVoteSlot />
    </PageSkeletonStatus>
  );
}

export function GirlsHomeSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="stats-page browse-page container py-4">
      <SEO
        title="טורניר בנות — נקודות"
        description="טבלת נקודות לטורניר בנות רמדאן 2026. הקבוצה עם הכי הרבה נקודות מובילה."
        pathname="/girls"
      />
      <SkeletonPageTitle />
      <SkeletonGirlsHomeLayout />
    </PageSkeletonStatus>
  );
}

export function GirlsNewsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="browse-page container py-4">
      <SEO
        title="חדשות — טורניר בנות"
        description="עדכונים וחדשות לטורניר בנות רמדאן 2026."
        pathname="/news-girls"
      />
      <SkeletonPageTitle />
      <SkeletonNewsList count={3} />
    </PageSkeletonStatus>
  );
}

export function MvpsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="dashboard-page mvps-page">
      <SEO
        title="מצטיינים"
        description="מלכי השערים ומירוץ ה-MVP של טורניר נצ'מאז כפר כמא 2026."
        pathname="/mvps"
      />
      <div className="container py-4">
        <SkeletonPageTitle />
        <SkeletonMvpPanels />
      </div>
    </PageSkeletonStatus>
  );
}

export function ProfileSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="profile-page">
      <SEO
        title="פרופיל אישי"
        description="עריכת פרופיל, תמונה ושיוך שחקן — מונדיאל קיץ 2026."
        pathname="/profile"
        noindex
      />
      <div className="container py-4" style={{ maxWidth: 760 }}>
        <SkeletonProfileLayout />
      </div>
    </PageSkeletonStatus>
  );
}

export function ArchiveSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="archive-page container py-4">
      <SEO
        title="היסטוריית הטורניר"
        description="צפו בתוצאות, בסטטיסטיקות וברגעי השיא מכל העונות הקודמות של טורניר הרמדאן."
        pathname="/archive"
      />
      <SkeletonPageTitle />
      <SkeletonArchiveLayout />
    </PageSkeletonStatus>
  );
}

export function WorldCupTeamsSkeleton({ label }: PageSkeletonProps) {
  return (
    <PageSkeletonStatus label={label} className="container py-4 wc-teams-page">
      <SEO
        title="מונדיאל 2026 — נבחרות"
        description="רשימת נבחרות ושחקנים — מונדיאל 2026."
        pathname="/world-cup/teams"
      />
      <SkeletonPageTitle />
      <SkeletonWcTeamsList count={8} />
    </PageSkeletonStatus>
  );
}
