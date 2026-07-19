const HIGHLIGHT_CLASS = 'nav-discover-pulse'
const DRAWER_SETTLE_MS = 320

export type DiscoverNavTarget = 'media-docs' | 'stats'

export function clearDiscoverNavHighlight(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS)
  })
}

export function queryDiscoverNavTargets(target: DiscoverNavTarget): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-nav-target="${target}"]`)
  )
}

/** Keep highlight on while a coachmark is open (cleared explicitly). */
export function setDiscoverNavHighlight(target: DiscoverNavTarget): boolean {
  clearDiscoverNavHighlight()
  const nodes = queryDiscoverNavTargets(target)
  if (!nodes.length) return false
  for (const el of nodes) {
    el.classList.add(HIGHLIGHT_CLASS)
  }
  nodes[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  return true
}

export function getDiscoverNavTargetRect(
  target: DiscoverNavTarget
): DOMRect | null {
  const nodes = queryDiscoverNavTargets(target)
  if (!nodes.length) return null
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    top = Math.min(top, r.top)
    left = Math.min(left, r.left)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  return new DOMRect(left, top, right - left, bottom - top)
}

export function computeDiscoverCoachmarkAnchor(
  target: DiscoverNavTarget
): { top: number; left: number } | null {
  const rect = getDiscoverNavTargetRect(target)
  if (!rect) return null
  const tipWidth = Math.min(280, window.innerWidth - 24)
  const gap = 12
  let left = rect.left - tipWidth - gap
  if (left < 12) left = 12
  let top = rect.top
  const maxTop = window.innerHeight - 180
  if (top > maxTop) top = Math.max(12, maxTop)
  return { top, left }
}

export { DRAWER_SETTLE_MS }
