import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiAgentService } from './src/modules/ai-agent/ai-agent.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiAgentService);
  try {
    await aiService.runProactiveAudit('fb0cb714-bfad-4ce4-b09b-1cac6d62ca30');
  } catch(e) {
    console.error("FULL ERROR:", e);
  }
  await app.close();
}
bootstrap();
