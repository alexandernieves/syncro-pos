import { PrismaService } from './src/modules/prisma/prisma.service';
import { ScraperService } from './src/modules/landings/scraper.service';
import { LandingsService } from './src/modules/landings/landings.service';
import { ConfigService } from '@nestjs/config';

async function test() {
  const prisma = new PrismaService();
  const configService = new ConfigService({
    OPENROUTER_API_KEY: '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'
  });
  const scraper = new ScraperService();
  const landings = new LandingsService(prisma, configService, scraper);

  const business = await prisma.business.findFirst();
  if (!business) {
    console.error("No business found");
    return;
  }

  const url = "https://es.aliexpress.com/item/1005006980090984.html?sourceType=562&pvid=8c0eb1e1-9b5d-4e84-8921-e9700b94c3f2&pdp_ext_f=%7B%22ship_from%22%3A%22CN%22%2C%22sku_id%22%3A%2212000038925631485%22%7D&scm=1007.28480.422277.0&scm-url=1007.28480.422277.0&scm_id=1007.28480.422277.0&pdp_npi=6%40dis%21CLP%21CLP+5%2C572%21CLP+2%2C596%21%21%2139.90%2118.59%21%402103212317828063795001338ea01e%2112000038925631485%21dsg%21CL%21%21X%211%210%21c%3A562&spm=a2g0o.tm1000029706.8287340260.d9&aecmd=true";
  
  console.log(`Starting test with business ID: ${business.id}`);
  try {
    const res = await landings.importFromUrl(url, business.id);
    console.log("Success!", res);
  } catch (err) {
    console.error("FAILED", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
