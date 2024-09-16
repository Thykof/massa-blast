import { Controller, Get, Query } from '@nestjs/common';
import { RewardService } from './reward.service';
import { GetRewardsDto } from './dtos/getRewards';

@Controller('reward')
export class RewardController {
  constructor(private rewardsServer: RewardService) {}

  // http://localhost:3000/reward?mas=201000000000&from=1713350284000
  @Get()
  async getRewards(@Query() query: GetRewardsDto): Promise<number> {
    return Number(
      await this.rewardsServer.getRewards(
        BigInt(query.mas),
        new Date(query.from),
        query.to ? new Date(query.to) : new Date(),
      ),
    );
  }
}
