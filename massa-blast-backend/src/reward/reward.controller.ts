import { Controller, Get, Query } from '@nestjs/common';
import { RewardService } from './reward.service';
import { GetRewardsDto } from './dtos/getRewards';

@Controller('reward')
export class RewardController {
  constructor(private rewardsServer: RewardService) {}

  // http://localhost:3000/reward?rolls=556&from=2024-03-11T20:49:49.866&to=2024-03-11T20:52:50.232
  @Get()
  async getRewards(@Query() query: GetRewardsDto): Promise<number> {
    return Number(
      await this.rewardsServer.getRewards(
        BigInt(query.rolls),
        new Date(query.from),
        new Date(query.to),
      ),
    );
  }
}
