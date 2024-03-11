import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { DataSourceOptions } from 'typeorm';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TotalRollsRecord } from './entities/TotalRollsRecord';

export let mongoMemory: MongoMemoryServer;

export const getConfig = async (): Promise<DataSourceOptions> => {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const port = process.env.DB_PORT;
  const password = process.env.DB_PASSWORD;

  const isTest = process.env.NODE_ENV === 'test';
  const isDev = process.env.APP_ENV === 'dev';
  const useMeMoryDB = isTest || isDev;
  if (useMeMoryDB && !mongoMemory) {
    mongoMemory = await MongoMemoryServer.create({
      binary: { version: '7.0.0' },
    });
  }

  return {
    type: 'mongodb',
    host,
    port: parseInt(port, 10),
    username: user,
    password: password,
    entities: [TotalRollsRecord],
    synchronize: process.env.DB_SYNC === 'true',
    url: useMeMoryDB ? mongoMemory.getUri() : undefined,
  };
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (): Promise<TypeOrmModuleOptions> => getConfig(),
    }),
    TypeOrmModule.forFeature([TotalRollsRecord]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
