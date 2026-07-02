import { Response } from 'express';
import { Request } from 'express';
import {
  AnalyticsService,
  type AnalyticsCategory,
  isAllowedAnalyticsEvent,
  validateSessionId,
} from '../services/AnalyticsService';

type ClientAnalyticsEvent = {
  eventName?: string;
  category?: string;
  path?: string;
  properties?: Record<string, unknown>;
};

const CATEGORY_VALUES = new Set<AnalyticsCategory>([
  'auth',
  'registration',
  'browse',
  'player_zone',
  'interaction',
]);

function parseCategory(value: unknown): AnalyticsCategory | null {
  if (typeof value !== 'string' || !CATEGORY_VALUES.has(value as AnalyticsCategory)) {
    return null;
  }
  return value as AnalyticsCategory;
}

export const ingestClientEvents = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    sessionId?: string;
    events?: ClientAnalyticsEvent[];
  };

  if (!Array.isArray(body?.events) || body.events.length === 0) {
    res.status(400).json({ error: 'sessionId and events are required' });
    return;
  }

  const sessionId = validateSessionId(body.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: 'Invalid sessionId' });
    return;
  }

  if (body.events.length > 25) {
    res.status(400).json({ error: 'Too many events in batch' });
    return;
  }

  let accepted = 0;
  for (const event of body.events) {
    const category = parseCategory(event.category);
    if (!event.eventName || !category) continue;
    if (!isAllowedAnalyticsEvent(event.eventName, 'client')) continue;

    AnalyticsService.log({
      eventName: event.eventName,
      category,
      source: 'client',
      sessionId,
      path: event.path,
      properties: event.properties,
    });
    accepted += 1;
  }

  if (accepted === 0) {
    res.status(400).json({ error: 'No valid events in batch' });
    return;
  }

  res.status(204).end();
};
