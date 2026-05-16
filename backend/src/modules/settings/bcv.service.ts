import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class BcvService {
  private readonly logger = new Logger(BcvService.name);

  constructor(private settingsService: SettingsService) {}

  async syncRate(businessId: string, target: 'pos' | 'dashboard' = 'pos') {
    try {
      this.logger.log(`Iniciando sincronización de tasa BCV para negocio ${businessId}, target: ${target}`);
      
      let rateUsd: number | null = null;
      let rateEur: number | null = null;
      let updateDate: string | null = null;

      // 1. Intentar scraping oficial del BCV (Prioridad)
      try {
        const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        const response = await fetch('https://www.bcv.org.ve/', {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
          const html = await response.text();
          const usdRegex = /id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i;
          const eurRegex = /id="euro"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i;
          const dateRegex = /id="fecha"[\s\S]*?<span>\s*([^<]+)\s*<\/span/i;

          const matchUsd = html.match(usdRegex);
          const matchEur = html.match(eurRegex);
          const matchDate = html.match(dateRegex);

          if (matchUsd) {
            rateUsd = parseFloat(matchUsd[1].trim().replace(/\./g, '').replace(',', '.'));
            rateEur = matchEur ? parseFloat(matchEur[1].trim().replace(/\./g, '').replace(',', '.')) : null;
            updateDate = matchDate ? matchDate[1].trim().replace(/\s+/g, ' ') : "Reciente";
          }
        }

        if (originalTlsReject !== undefined) process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
        else delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } catch (scrapError) {
        this.logger.warn(`Scraping BCV falló: ${scrapError.message}`);
      }

      // 2. Fallback a dolarapi.com
      if (!rateUsd) {
        try {
          const usdRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(8000) });
          if (usdRes.ok) {
            const bcvUsd = await usdRes.json();
            rateUsd = bcvUsd.promedio;
            updateDate = "Vía API";
          }
          const eurRes = await fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: AbortSignal.timeout(8000) });
          if (eurRes.ok) {
            const bcvEur = await eurRes.json();
            rateEur = bcvEur.promedio;
          }
        } catch (e) {
          this.logger.warn(`Error en fallback API: ${e.message}`);
        }
      }

      if (!rateUsd) {
          throw new Error('No se pudo obtener la tasa de cambio de ninguna fuente');
      }

      const updateData: any = {};
      if (target === 'dashboard') {
        updateData.exchangeRateDashboard = rateUsd;
        updateData.exchangeRateDashboardEur = rateEur || 1;
        updateData.bcvUpdateDateDashboard = updateDate;
      } else {
        updateData.exchangeRate = rateUsd;
        updateData.exchangeRateEur = rateEur || 1;
        updateData.bcvUpdateDate = updateDate;
      }
      
      return await this.settingsService.updateSettings(updateData, businessId);
    } catch (error) {
      this.logger.error(`Error sincronizando tasa BCV: ${error.message}`);
      throw error;
    }
  }
}
