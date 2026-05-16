import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class BcvService {
  private readonly logger = new Logger(BcvService.name);

  constructor(private settingsService: SettingsService) {}

  async syncRate(target: 'pos' | 'dashboard' = 'pos') {
    try {
      this.logger.log(`Iniciando sincronización de tasa BCV para: ${target}`);
      
      let rateUsd: number | null = null;
      let rateEur: number | null = null;
      let updateDate: string | null = null;

      // 1. Intentar scraping oficial del BCV (Prioridad)
      try {
        this.logger.log(`Intentando obtener tasas mediante scraping oficial del BCV para ${target}...`);
        const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        const response = await fetch('https://www.bcv.org.ve/', {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
          },
          signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) throw new Error(`BCV server respondió con status: ${response.status}`);
        
        const html = await response.text();
        
        // Mejorar regex para capturar los valores exactos de la tabla de tasas
        const usdRegex = /id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i;
        const eurRegex = /id="euro"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i;
        const dateRegex = /id="fecha"[\s\S]*?<span>\s*([^<]+)\s*<\/span/i;
        const alternateDateRegex = /Fecha Valor:\s*<strong>\s*([^<]+)\s*<\/strong>/i;

        const matchUsd = html.match(usdRegex);
        const matchEur = html.match(eurRegex);
        const matchDate = html.match(dateRegex) || html.match(alternateDateRegex);

        if (matchUsd) {
          rateUsd = parseFloat(matchUsd[1].trim().replace(/\./g, '').replace(',', '.'));
          rateEur = matchEur ? parseFloat(matchEur[1].trim().replace(/\./g, '').replace(',', '.')) : null;
          updateDate = matchDate ? matchDate[1].trim().replace(/\s+/g, ' ') : "Reciente";
          
          this.logger.log(`Tasa oficial obtenida: USD=${rateUsd}, EUR=${rateEur}, Fecha=${updateDate}`);
        }

        if (originalTlsReject !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      } catch (scrapError) {
        this.logger.error(`Error en scraping BCV: ${scrapError.message}`);
      }

      // 2. Fallback a dolarapi.com si falló el scraping o para completar datos
      if (!rateUsd || !rateEur) {
        try {
          this.logger.log(`Consultando dolarapi.com para completar/validar tasas...`);
          const usdRes = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(8000) });
          if (usdRes.ok) {
            const usdData = await usdRes.json();
            const bcvUsd = Array.isArray(usdData) ? usdData.find((d: any) => d.fuente === 'oficial') : null;
            if (bcvUsd) {
              if (!rateUsd) rateUsd = bcvUsd.promedio;
              if (!updateDate) updateDate = "Vía API";
            }
          }
          const eurRes = await fetch('https://ve.dolarapi.com/v1/euros', { signal: AbortSignal.timeout(8000) });
          if (eurRes.ok) {
            const eurData = await eurRes.json();
            const bcvEur = Array.isArray(eurData) ? eurData.find((d: any) => d.fuente === 'oficial') : null;
            if (bcvEur && !rateEur) rateEur = bcvEur.promedio;
          }
        } catch (e) {
          this.logger.warn(`Error en fallback API: ${e.message}`);
        }
      }

      if (!rateUsd) {
          this.logger.error(`Fallaron todas las fuentes para sincronizar tasa (${target})`);
          throw new Error('No se pudo obtener la tasa de cambio de ninguna fuente disponible');
      }

      const updateData: any = {};
      // Actualizar AMBOS (POS y Dashboard) para mantener sincronía si se prefiere, 
      // o solo el target según la lógica actual.
      if (target === 'dashboard') {
        updateData.exchangeRateDashboard = rateUsd;
        updateData.exchangeRateDashboardEur = rateEur || 1;
        updateData.bcvUpdateDateDashboard = updateDate;
      } else {
        updateData.exchangeRate = rateUsd;
        updateData.exchangeRateEur = rateEur || 1;
        updateData.bcvUpdateDate = updateDate;
      }
      
      this.logger.log(`Guardando nuevos valores en configuración para ${target}: USD=${rateUsd}, EUR=${rateEur}`);
      const result = await this.settingsService.updateSettings(updateData);
      return result;
    } catch (error) {
      this.logger.error(`Error final al sincronizar tasa BCV (${target}): ${error.message}`);
      throw error;
    }
  }
}
