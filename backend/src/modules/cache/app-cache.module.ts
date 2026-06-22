import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          try {
            const store = await redisStore({
              url: redisUrl,
              ttl: 5 * 60 * 1000, // 5 minutes standard TTL
            });
            console.log('[Cache] Conectado exitosamente a Redis Cache Store');
            return { store };
          } catch (err: any) {
            console.error('[Cache] Error conectando a Redis, usando fallback de memoria:', err.message);
          }
        }
        console.log('[Cache] Usando almacenamiento en caché local (Memoria In-Memory)');
        return {
          ttl: 5 * 60 * 1000, // 5 minutes standard TTL
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
