import { Request, Response, NextFunction } from 'express';
import { Division } from '@prisma/client';

export type TournamentRequest = Request & { tournamentDivision?: Division };

export const setBoysDivision = (req: TournamentRequest, _res: Response, next: NextFunction): void => {
  req.tournamentDivision = Division.boys;
  next();
};

export const setGirlsDivision = (req: TournamentRequest, _res: Response, next: NextFunction): void => {
  req.tournamentDivision = Division.girls;
  next();
};

export function getRequestDivision(req: TournamentRequest): Division {
  return req.tournamentDivision ?? Division.boys;
}
