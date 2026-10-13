import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

      // Helper to format current date as fallback
      const getCurrentFormattedDate = () => {
        const d = new Date();
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };

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
          const usdRegex = /id="dolar"[\s\S]*?<strong[^>]*?>\s*([\d,.]+)\s*<\/strong>/i;
          const eurRegex = /id="euro"[\s\S]*?<strong[^>]*?>\s*([\d,.]+)\s*<\/strong>/i;
          const dateRegex = /id="fecha"[\s\S]*?<span[^>]*?>\s*([^<]+)\s*<\/span>/i;
          const alternateDateRegex = /Fecha Valor:\s*<span[^>]*?>\s*([^<]+)\s*<\/span>/i;

          const matchUsd = html.match(usdRegex);
          const matchEur = html.match(eurRegex);
          const matchDate = html.match(dateRegex) || html.match(alternateDateRegex);

          if (matchUsd) {
            rateUsd = parseFloat(matchUsd[1].trim().replace(/\./g, '').replace(',', '.'));
            rateEur = matchEur ? parseFloat(matchEur[1].trim().replace(/\./g, '').replace(',', '.')) : null;
            updateDate = matchDate ? matchDate[1].trim().replace(/\s+/g, ' ') : getCurrentFormattedDate();
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
            updateDate = getCurrentFormattedDate();
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
      // Colombian TRM (pesos per dollar), for branches in Táchira. Not fatal if it fails.
      const trm = await this.fetchTrm();
      if (trm) {
        updateData.exchangeRateCop = trm.rate;
        updateData.copUpdateDate = trm.date;
      }
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

  /**
   * TRM certified by the Superintendencia Financiera de Colombia (datos.gov.co open data),
   * with dolarapi.com as a fallback. Pesos per dollar.
   */
  async fetchTrm(): Promise<{ rate: number; date: string } | null> {
    try {
      const res = await fetch('https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1', { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const [row] = (await res.json()) as { valor: string; vigenciadesde: string }[];
        const rate = Number(row?.valor);
        if (rate > 0) return { rate, date: String(row.vigenciadesde).slice(0, 10) };
      }
    } catch (e) {
      this.logger.warn(`TRM datos.gov.co falló: ${e.message}`);
    }
    try {
      const res = await fetch('https://co.dolarapi.com/v1/trm', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = (await res.json()) as { valor: number; fechaActualizacion: string };
        if (Number(data?.valor) > 0) return { rate: Number(data.valor), date: String(data.fechaActualizacion).slice(0, 10) };
      }
    } catch (e) {
      this.logger.warn(`TRM dolarapi falló: ${e.message}`);
    }
    return null;
  }

  /** The business's own peso rate (Cúcuta border); null goes back to the TRM. */
  async setCopRate(businessId: string, manual: number | null) {
    if (manual !== null && !(manual >= 100 && manual <= 100000)) throw new BadRequestException('La tasa del peso debe estar entre 100 y 100.000 pesos por dólar');
    const update: any = { copRateManual: manual };
    if (manual === null) {
      const trm = await this.fetchTrm();
      if (trm) { update.exchangeRateCop = trm.rate; update.copUpdateDate = trm.date; }
    }
    return this.settingsService.updateSettings(update, businessId);
  }
}
