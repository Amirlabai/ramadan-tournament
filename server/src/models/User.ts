import { prisma } from '../lib/prisma';
import { prismaUserToIUser, IUser, UserRole, IMappedPlayerInfo, IPendingTeamRequest, IPlayerProfile } from '../db/userMapper';
import { prismaNullableTokenField } from '../db/prismaNullables';
import { toInputJson } from '../lib/json';
import { normalizeEmail } from '../utils/normalizeEmail';

export type { IUser, UserRole, IMappedPlayerInfo, IPendingTeamRequest, IPlayerProfile };

function buildWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  if (query.email) {
    const normalized = normalizeEmail(String(query.email));
    if (normalized) where.email = normalized;
  }
  if (query.username) where.username = query.username;
  if (query.googleId) where.googleId = query.googleId;
  if (query.verificationToken) where.verificationToken = query.verificationToken;
  if (query.verificationTokenExpiresAfter instanceof Date) {
    where.verificationTokenExpires = { gt: query.verificationTokenExpiresAfter };
  } else if (query.verificationTokenExpires && typeof query.verificationTokenExpires === 'object') {
    const gt = (query.verificationTokenExpires as { gt?: Date; $gt?: Date }).gt
      ?? (query.verificationTokenExpires as { $gt?: Date }).$gt;
    if (gt) where.verificationTokenExpires = { gt };
  }
  if (query.passwordResetToken) where.passwordResetToken = query.passwordResetToken;
  if (query.passwordResetExpiresAfter instanceof Date) {
    where.passwordResetExpires = { gt: query.passwordResetExpiresAfter };
  }
  if (query['mappedPlayerInfo.teamId']) where.mappedPlayerInfo = { path: ['teamId'], equals: query['mappedPlayerInfo.teamId'] };
  return where;
}

export class User {
  id?: string;
  username?: string;
  email?: string;
  password?: string;
  googleId?: string;
  displayName!: string;
  avatarUrl?: string;
  googlePictureUrl?: string;
  role: UserRole = 'User';
  mappedPlayerInfo?: IMappedPlayerInfo;
  playerProfile?: IPlayerProfile;
  pendingTeamRequest?: IPendingTeamRequest;
  isVerified = false;
  verificationToken?: string | null;
  verificationTokenExpires?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  tokenVersion?: number;

  constructor(data: Partial<IUser> & Record<string, unknown>) {
    Object.assign(this, data);
  }

  async save(): Promise<IUser> {
    const role = this.role === 'admin' || this.role === 'Admin' ? 'admin' : 'user';
    const data = {
      username: this.username,
      email: this.email ? normalizeEmail(this.email) ?? undefined : undefined,
      password: this.password,
      googleId: this.googleId,
      displayName: this.displayName || 'User',
      avatarUrl: this.avatarUrl,
      googlePictureUrl: this.googlePictureUrl,
      role: role as 'admin' | 'user',
      mappedPlayerInfo: toInputJson(this.mappedPlayerInfo),
      playerProfile: toInputJson(this.playerProfile),
      pendingTeamRequest: toInputJson(this.pendingTeamRequest),
      isVerified: this.isVerified,
      verificationToken: prismaNullableTokenField(this.verificationToken),
      verificationTokenExpires: prismaNullableTokenField(this.verificationTokenExpires),
      passwordResetToken: prismaNullableTokenField(this.passwordResetToken),
      passwordResetExpires: prismaNullableTokenField(this.passwordResetExpires),
      tokenVersion: this.tokenVersion ?? 0,
    };

    if (this.id) {
      const updated = await prisma.user.update({
        where: { id: this.id },
        data,
      });
      return prismaUserToIUser(updated);
    }

    const created = await prisma.user.create({ data });
    const mapped = prismaUserToIUser(created);
    this.id = mapped.id;
    return mapped;
  }

  toObject(): IUser {
    return prismaUserToIUser({
      id: this.id || '',
      username: this.username ?? null,
      email: this.email ?? null,
      password: this.password ?? null,
      googleId: this.googleId ?? null,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl ?? null,
      googlePictureUrl: this.googlePictureUrl ?? null,
      role: (this.role === 'admin' || this.role === 'Admin' ? 'admin' : 'user') as 'admin' | 'user',
      activeDivision: null,
      isVerified: this.isVerified,
      verificationToken: this.verificationToken ?? null,
      verificationTokenExpires: this.verificationTokenExpires ?? null,
      passwordResetToken: this.passwordResetToken ?? null,
      passwordResetExpires: this.passwordResetExpires ?? null,
      tokenVersion: this.tokenVersion ?? 0,
      mappedPlayerInfo: (this.mappedPlayerInfo ?? null) as any,
      playerProfile: (this.playerProfile ?? null) as any,
      pendingTeamRequest: (this.pendingTeamRequest ?? null) as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static async findById(id: string): Promise<IUser | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? prismaUserToIUser(row) : null;
  }

  static findOne(query: Record<string, unknown>) {
    const run = async (includePassword: boolean) => {
      if (query.email && !normalizeEmail(String(query.email))) {
        return null;
      }
      const where = buildWhere(query);
      let row;
      if (where.verificationTokenExpires && typeof where.verificationTokenExpires === 'object') {
        const expires = where.verificationTokenExpires as { gt: Date };
        const { verificationTokenExpires: _drop, ...rest } = where;
        row = await prisma.user.findFirst({
          where: {
            ...rest,
            verificationTokenExpires: { gt: expires.gt },
          },
        });
      } else if (where.passwordResetExpires && typeof where.passwordResetExpires === 'object') {
        const expires = where.passwordResetExpires as { gt: Date };
        const { passwordResetExpires: _drop, ...rest } = where;
        row = await prisma.user.findFirst({
          where: {
            ...rest,
            passwordResetExpires: { gt: expires.gt },
          },
        });
      } else if (query['mappedPlayerInfo.teamId']) {
        row = await prisma.user.findFirst({
          where: {
            mappedPlayerInfo: {
              path: ['teamId'],
              equals: query['mappedPlayerInfo.teamId'] as number,
            },
          },
        });
      } else {
        row = await prisma.user.findFirst({ where: where as any });
      }
      if (!row) return null;
      const user = prismaUserToIUser(row);
      if (!includePassword) delete user.password;
      return user;
    };

    return {
      select: (fields: string) => run(fields.includes('password')),
      then: (resolve: (v: IUser | null) => void, reject: (e: unknown) => void) =>
        run(false).then(resolve, reject),
    };
  }

  static find(query: Record<string, unknown> = {}) {
    const run = async () => {
      const rows = await prisma.user.findMany();
      return rows
        .filter((row) => {
          const m = row.mappedPlayerInfo as IMappedPlayerInfo | null;
          const p = row.pendingTeamRequest as IPendingTeamRequest | null;
          if (query['mappedPlayerInfo.teamId'] != null && m?.teamId !== query['mappedPlayerInfo.teamId']) {
            return false;
          }
          if (query['mappedPlayerInfo.status'] && m?.status !== query['mappedPlayerInfo.status']) {
            return false;
          }
          if (query['mappedPlayerInfo.memberId']) {
            const cond = query['mappedPlayerInfo.memberId'] as { $gt?: number };
            if (cond.$gt !== undefined && !(m && m.memberId > cond.$gt)) return false;
          }
          if (query['pendingTeamRequest.status'] && p?.status !== query['pendingTeamRequest.status']) {
            return false;
          }
          if (query.mappedPlayerInfo && (query.mappedPlayerInfo as { $exists?: boolean }).$exists) {
            return m != null;
          }
          return true;
        })
        .map(prismaUserToIUser);
    };
    const chain = {
      select(_fields: string) {
        return chain;
      },
      sort(_sort: unknown) {
        return chain;
      },
      lean: async () => run(),
      then: (resolve: (v: IUser[]) => void, reject?: (e: unknown) => void) => run().then(resolve, reject),
    };
    return chain;
  }

  static async deleteById(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch (err) {
      console.error(`User.deleteById failed for ${id}:`, err);
      return false;
    }
  }

  static async deleteMany(_filter: Record<string, unknown> = {}) {
    await prisma.user.deleteMany();
  }
}
