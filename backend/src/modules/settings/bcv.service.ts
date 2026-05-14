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

      // 1. Intentar usar la API de dolarapi.com (más estable y rápida)
      try {
        this.logger.log(`Intentando obtener tasas desde dolarapi.com para ${target}...`);
        
        // Fetch USD
        const usdRes = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(8000) }).catch(e => {
            this.logger.warn(`Error de red al consultar USD en dolarapi: ${e.message}`);
            return null;
        });

        // Fetch EUR
        const eurRes = await fetch('https://ve.dolarapi.com/v1/euros', { signal: AbortSignal.timeout(8000) }).catch(e => {
            this.logger.warn(`Error de red al consultar EUR en dolarapi: ${e.message}`);
            return null;
        });

        if (usdRes?.ok) {
          const usdData: any = await usdRes.json();
          const bcvUsd = Array.isArray(usdData) ? usdData.find((d: any) => d.fuente === 'oficial') : null;
          if (bcvUsd) {
            rateUsd = bcvUsd.promedio;
            try {
              const date = new Date(bcvUsd.fechaActualizacion);
              const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
              updateDate = date.toLocaleDateString('es-VE', options);
              updateDate = updateDate.charAt(0).toUpperCase() + updateDate.slice(1);
            } catch (e) {
              updateDate = "Reciente";
            }
          }
        }

        if (eurRes?.ok) {
          const eurData: any = await eurRes.json();
          const bcvEur = Array.isArray(eurData) ? eurData.find((d: any) => d.fuente === 'oficial') : null;
          if (bcvEur) {
            rateEur = bcvEur.promedio;
          }
        }

        if (rateUsd) {
          this.logger.log(`Tasa obtenida exitosamente vía API para ${target}: USD=${rateUsd}, EUR=${rateEur}`);
        }
      } catch (apiError) {
        this.logger.warn(`Error inesperado al consultar dolarapi.com: ${apiError.message}`);
      }

      // 2. Si falló la API, intentar scraping oficial del BCV
      if (!rateUsd) {
        this.logger.log(`Intentando obtener tasas mediante scraping oficial del BCV para ${target}...`);
        const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        try {
          const response = await fetch('https://www.bcv.org.ve/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(12000)
          });

          if (!response.ok) throw new Error(`BCV server respondió con status: ${response.status}`);
          
          const html = await response.text();
          
          const matchUsd = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i) || 
                           html.match(/dolar[\s\S]*?([\d,.]+)/i);
                           
          const matchEur = html.match(/id="euro"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i) || 
                           html.match(/euro[\s\S]*?([\d,.]+)/i);

          const matchDate = html.match(/Fecha Valor:\s*<[^>]*>([^<]+)<\/[^>]*>/i) ||
                            html.match(/id="fecha"[\s\S]*?<span>\s*([^<]+)\s*<\/span/i);

          if (matchUsd) {
            rateUsd = parseFloat(matchUsd[1].trim().replace(/\./g, '').replace(',', '.'));
            rateEur = matchEur ? parseFloat(matchEur[1].trim().replace(/\./g, '').replace(',', '.')) : (rateEur || 1);
            updateDate = matchDate && matchDate[1] ? matchDate[1].trim().replace(/\s+/g, ' ') : (updateDate || "No disponible");
            this.logger.log(`Tasa obtenida vía scraping para ${target}: USD=${rateUsd}, EUR=${rateEur}`);
          }
        } catch (scrapError) {
           this.logger.error(`Error en scraping BCV para ${target}: ${scrapError.message}`);
        } finally {
          if (originalTlsReject !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
          } else {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
          }
        }
      }

      if (!rateUsd) {
          this.logger.error(`Fallaron todas las fuentes para sincronizar tasa (${target})`);
          throw new Error('No se pudo obtener la tasa de cambio de ninguna fuente disponible');
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
      
      this.logger.log(`Guardando nuevos valores en configuración para ${target}: USD=${rateUsd}`);
      const result = await this.settingsService.updateSettings(updateData);
      this.logger.log(`Sincronización finalizada exitosamente para ${target}`);
      return result;
    } catch (error) {
      this.logger.error(`Error final al sincronizar tasa BCV (${target}): ${error.message}`);
      throw error;
    }
  }
}
