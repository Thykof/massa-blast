import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '../database/database.service';
import { AxiosResponse } from 'axios';

type Stacker = [string, number];

interface GetStackersRpcResponse {
  jsonrpc: string;
  result: Stacker[];

  error?: { code: number; message: string; data: string };
  id: number;
}

@Injectable()
export class RollService {
  constructor(
    private httpService: HttpService,
    private dataBaseService: DatabaseService,
  ) {}

  private readonly logger = new Logger('ROLL');

  public onModuleInit() {
    this.fetchTotalRolls();
  }

  @Interval(16 * 128 * 3 * 1000) // every 3 cycles
  // @Interval(3 * 1000) // DEBUG
  async fetchTotalRolls() {
    const stackers = await this.getStakers();

    const totalRolls = stackers.reduce((acc, curr) => acc + curr[1], 0);

    this.logger.log(`Total rolls: ${totalRolls}`);

    this.dataBaseService.addTotalRolls(totalRolls);

    return totalRolls;
  }

  async getStakers(): Promise<Stacker[]> {
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'get_stakers',
      params: [{ offset: 0, limit: 99999999 }],
    };

    let response: AxiosResponse<GetStackersRpcResponse>;
    try {
      response = await this.httpService.axiosRef.post<GetStackersRpcResponse>(
        'https://mainnet.massa.net/api/v2',
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      this.logger.error('Request to RPC failed');
      this.logger.error(error);
      throw error;
    }

    const data = response.data;

    if (data.jsonrpc !== '2.0') {
      this.logger.error('Invalid JSON-RPC version');
      throw new Error('Invalid JSON-RPC version');
    }

    if (data.error) {
      this.logger.error('Error fetching stackers from RPC');
      this.logger.error(data.error.message);
      throw new Error(data.error.message);
    }

    return data.result;
  }
}
