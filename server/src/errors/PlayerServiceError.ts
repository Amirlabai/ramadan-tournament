export type PlayerServiceErrorCode =
  | 'NOT_ON_ROSTER'
  | 'TEAM_OWNER'
  | 'PLAYER_NOT_FOUND'
  | 'SEASON_NOT_ACTIVE'
  | 'SERVER_ERROR';

export class PlayerServiceError extends Error {
  readonly code: PlayerServiceErrorCode;
  readonly status: number;

  constructor(code: PlayerServiceErrorCode, message: string, status: number) {
    super(message);
    this.name = 'PlayerServiceError';
    this.code = code;
    this.status = status;
  }
}
