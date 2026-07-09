import legalPrerenderPathsJson from './legal-prerender-paths.json'

export const LEGAL_PRERENDER_PATHS: readonly string[] = legalPrerenderPathsJson

export const LEGAL_SITEMAP_PATHS = new Set<string>(LEGAL_PRERENDER_PATHS)
