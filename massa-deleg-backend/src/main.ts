import { NestFactory } from '@nestjs/core';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const loggerTransports: winston.transport[] = [
    new winston.transports.Console({ level: 'info' }),
    new winston.transports.File({
      filename: 'logs/massa-deleg-backend.log',
      maxsize: 10000000,
      maxFiles: 10,
      tailable: true,
      level: 'debug',
    }),
  ];

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('massa-deleg', {
          prettyPrint: true,
          colors: true,
        }),
      ),
      transports: loggerTransports,
    }),
  });
  await app.listen(3000);
}
bootstrap();
