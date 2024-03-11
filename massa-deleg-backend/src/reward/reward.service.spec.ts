import { Test, TestingModule } from '@nestjs/testing';
import { RewardService } from './reward.service';
import { AppModule } from '../app.module';
import { HttpModule } from '@nestjs/axios';

describe('RewardService', () => {
  let service: RewardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule],
    }).compile();

    service = module.get<RewardService>(RewardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRewards', () => {
    it('should return a number', async () => {
      const result = await service.getRewards(1, new Date(), new Date());
      expect(typeof result).toBe('number');
    });
  });

  describe('rewardsDuringPeriod', () => {
    it('should return a number', () => {
      const result = service.rewardsDuringPeriod(
        1,
        2,
        new Date(),
        new Date(),
        1,
      );
      expect(typeof result).toBe('number');
    });

    it('should return a number', () => {
      const result = service.rewardsDuringPeriod(
        1,
        1,
        new Date('2021-01-01'),
        new Date('2021-01-02'),
        1,
      );
      expect(result).toBe(176256);
    });
  });
});
