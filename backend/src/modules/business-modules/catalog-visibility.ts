import { PrismaService } from '../prisma/prisma.service';
import { CATALOG_CODES } from './catalog';

export const visibilityKey = (code: string) => `module_catalog_private:${code}`;

export async function privateCatalogModules(prisma: PrismaService) {
  const keys = CATALOG_CODES.map(visibilityKey);
  const settings = await prisma.platformSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const privateKeys = new Set(settings.filter(({ value }) => value === true).map(({ key }) => key));
  return new Set(CATALOG_CODES.filter((code) => privateKeys.has(visibilityKey(code))));
}
