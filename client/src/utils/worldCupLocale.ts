import locale from '../../../data/worldcup/hebrew-locale.json';

type LocaleData = typeof locale;

export function wcGroupLabel(group: string | undefined | null): string {
  if (!group?.trim()) return '';
  if (locale.groups[group as keyof LocaleData['groups']]) {
    return locale.groups[group as keyof LocaleData['groups']];
  }
  if (group.startsWith('GROUP_')) return `בית ${group.slice('GROUP_'.length)}`;
  return group;
}

export function wcStageLabel(stage: string | undefined | null): string {
  if (!stage?.trim()) return 'נוקאאוט';
  return locale.stages[stage as keyof LocaleData['stages']] || stage.replace(/_/g, ' ');
}
