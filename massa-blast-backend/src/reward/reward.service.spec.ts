import { Test } from '@nestjs/testing';
import { RewardService } from './reward.service';
import { DatabaseService } from '../database/database.service';
import { TotalRollsRecord } from '../database/entities/TotalRollsRecord';

describe('RewardService', () => {
  let service: RewardService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RewardService, DatabaseService],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        addTotalRolls: jest.fn(),
        getTotalRolls: jest
          .fn()
          .mockResolvedValue([new TotalRollsRecord(100_000_000_000)]),
      })
      .compile();

    service = module.get<RewardService>(RewardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRewards', () => {
    it('should return a bigint', async () => {
      const result = await service.getRewards(1n, new Date(), new Date());
      expect(typeof result).toBe('bigint');
    });
  });

  describe('rewardsDuringPeriod', () => {
    it('should return a bigint', () => {
      const result = service.rewardsDuringPeriod(
        1n,
        2n,
        new Date(),
        new Date(),
        100n,
      );
      expect(typeof result).toBe('bigint');
    });

    it('should return a bigint', () => {
      const result = service.rewardsDuringPeriod(
        1n,
        1n,
        new Date('2021-01-01'),
        new Date('2021-01-02'),
        100n,
      );
      expect(result).toBe(176_256_000_000_000n);
    });
  });
});
