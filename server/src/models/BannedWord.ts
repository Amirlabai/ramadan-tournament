import { prisma } from '../lib/prisma';

export class BannedWord {
  word?: string;
  language?: string;

  constructor(data: { word: string; language?: string }) {
    this.word = data.word;
    this.language = data.language;
  }

  async save() {
    return prisma.bannedWord.create({
      data: { word: this.word!.toLowerCase(), language: this.language || 'he' },
    });
  }

  static find(_filter?: Record<string, unknown>) {
    const promise = prisma.bannedWord.findMany({ orderBy: { word: 'asc' } });
    return Object.assign(promise, {
      sort(_sort: { word?: 1 }) {
        return promise;
      },
    });
  }

  static async create(data: { word: string; language?: string }) {
    return prisma.bannedWord.create({
      data: { word: data.word.toLowerCase(), language: data.language || 'he' },
    });
  }

  static async findByIdAndDelete(id: string) {
    return prisma.bannedWord.delete({ where: { id } });
  }

  static async deleteMany() {
    await prisma.bannedWord.deleteMany();
  }

  static async insertMany(docs: Array<{ word: string; language?: string }>) {
    for (const doc of docs) {
      await prisma.bannedWord.create({
        data: { word: doc.word.toLowerCase(), language: doc.language || 'he' },
      });
    }
  }
}
