import { Prisma, User as PrismaUser } from '@prisma/client';
import { toInputJson } from '../lib/json';

export type UserRole = 'Admin' | 'Captain' | 'Player' | 'User' | 'admin' | 'user';

export interface IMappedPlayerInfo {
  teamId: number;
  memberId: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface IPendingTeamRequest {
  teamName: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface IPlayerProfile {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  number?: number;
  position?: string;
  bio?: string;
}

export interface IUser {
  id: string;
  username?: string;
  email?: string;
  password?: string;
  googleId?: string;
  displayName: string;
  avatarUrl?: string;
  googlePictureUrl?: string;
  role: UserRole;
  mappedPlayerInfo?: IMappedPlayerInfo;
  playerProfile?: IPlayerProfile;
  pendingTeamRequest?: IPendingTeamRequest;
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<IUser>;
  toObject(): IUser;
}

function mapRoleFromDb(role: string): UserRole {
  if (role === 'admin') return 'admin';
  return 'User';
}

function mapRoleToDb(role: UserRole): 'admin' | 'user' {
  if (role === 'admin' || role === 'Admin') return 'admin';
  return 'user';
}

export function prismaUserToIUser(row: PrismaUser): IUser {
  const base: IUser = {
    id: row.id,
    username: row.username ?? undefined,
    email: row.email ?? undefined,
    password: row.password ?? undefined,
    googleId: row.googleId ?? undefined,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? undefined,
    googlePictureUrl: row.googlePictureUrl ?? undefined,
    role: mapRoleFromDb(row.role),
    mappedPlayerInfo: (row.mappedPlayerInfo as IMappedPlayerInfo | null) ?? undefined,
    playerProfile: (row.playerProfile as IPlayerProfile | null) ?? undefined,
    pendingTeamRequest: (row.pendingTeamRequest as IPendingTeamRequest | null) ?? undefined,
    isVerified: row.isVerified,
    verificationToken: row.verificationToken ?? undefined,
    verificationTokenExpires: row.verificationTokenExpires ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    async save() {
      const { prisma } = await import('../lib/prisma');
      const updated = await prisma.user.update({
        where: { id: row.id },
        data: {
          username: base.username,
          email: base.email?.toLowerCase(),
          password: base.password,
          googleId: base.googleId,
          displayName: base.displayName,
          avatarUrl: base.avatarUrl,
          googlePictureUrl: base.googlePictureUrl,
          role: mapRoleToDb(base.role),
          mappedPlayerInfo: toInputJson(base.mappedPlayerInfo),
          playerProfile: toInputJson(base.playerProfile),
          pendingTeamRequest: toInputJson(base.pendingTeamRequest),
          isVerified: base.isVerified,
          verificationToken: base.verificationToken,
          verificationTokenExpires: base.verificationTokenExpires,
        },
      });
      Object.assign(base, prismaUserToIUser(updated));
      return base;
    },
    toObject() {
      return { ...base };
    },
  };
  return base;
}
