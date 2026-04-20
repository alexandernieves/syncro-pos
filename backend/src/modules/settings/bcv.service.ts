import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class BcvService {
  private readonly logger = new Logger(BcvService.name);

  constructor(private settingsService: SettingsService) {}

  async syncRate() {
    try {
      // Temporarily disable TLS validation because the BCV official site often has misconfigured certs
      const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      const response = await fetch('https://www.bcv.org.ve/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      
      // Restore the original TLS validation state immediately
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      
      if (!response.ok) throw new Error(`BCV server responded with status: ${response.status}`);
      
      const html = await response.text();
      
      const matchUsd = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i);
      const matchEur = html.match(/id="euro"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i);
      const matchDate = html.match(/Fecha Valor:\s*<span[^>]*>([^<]+)<\/span>/i);
      
      if (!matchUsd || !matchUsd[1]) {
        this.logger.error('Could not parse BCV USD rate from HTML.');
        throw new Error('USD Rate not found in official HTML response');
      }

      const rateStringUsd = matchUsd[1].replace(/\./g, '').replace(',', '.');
      const rateUsd = parseFloat(rateStringUsd);

      let rateEur = 1;
      if (matchEur && matchEur[1]) {
        const rateStringEur = matchEur[1].replace(/\./g, '').replace(',', '.');
        rateEur = parseFloat(rateStringEur);
      }

      const updateDate = matchDate && matchDate[1] ? matchDate[1].trim().replace(/\s+/g, ' ') : "No disponible";

      this.logger.log(`Updating exchange rate: USD=${rateUsd}, EUR=${rateEur}, Fecha=${updateDate}`);
      
      return await this.settingsService.updateSettings({ 
        exchangeRate: rateUsd,
        exchangeRateEur: rateEur,
        bcvUpdateDate: updateDate
      });
    } catch (error) {
      this.logger.error('Error syncing BCV rate:', error);
      throw error;
    }
  }
}
