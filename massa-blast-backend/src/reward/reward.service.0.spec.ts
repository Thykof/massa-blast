import { Test, TestingModule } from '@nestjs/testing';
import { RewardService } from './reward.service';
import { DatabaseService } from '../database/database.service';
import { TotalRollsRecord } from '../database/entities/TotalRollsRecord';
import BigNumber from 'bignumber.js';
import { fromMAS } from '@massalabs/massa-web3';

describe('RewardService', () => {
  let service: RewardService;
  const start = new Date('2021-01-01');
  const end = new Date('2021-01-02');
  const dateJan3 = new Date('2021-01-03');
  const mockDatabaseService = {
    addTotalRolls: jest.fn(),
    getTotalRolls: jest
      .fn()
      .mockResolvedValue([
        new TotalRollsRecord(1, start),
        new TotalRollsRecord(1, end),
      ]),
  };
  let app: TestingModule;

  async function createServiceWithMockedDB() {
    app = await Test.createTestingModule({
      providers: [RewardService, DatabaseService],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDatabaseService)
      .compile();

    service = app.get<RewardService>(RewardService);
  }

  beforeEach(async () => {
    jest.clearAllMocks(); // Clears previous mock states
    await createServiceWithMockedDB(); // Create service instance with the initial spy/mock
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('rewardsDuringPeriod', () => {
    it('limit case', () => {
      const result = service.rewardsDuringPeriod(
        1, // one roll
        1, // one roll
        start,
        end,
        new BigNumber(100_000_000_000), // one roll
      );
      expect(result.toString()).toBe(
        new BigNumber(176_256_000_000_000).toString(),
      );
    });
    it('during one hour', () => {
      const result = service.rewardsDuringPeriod(
        1, // one roll
        1, // one roll
        new Date(start.getTime()),
        new Date(start.getTime() + 60_000 * 60), // start + one hour
        new BigNumber(100_000_000_000), // one roll
      );
      expect(result.toString()).toBe(
        new BigNumber(176_256_000_000_000).dividedBy(24).toString(),
      );
    });
    it('number of roll increase', () => {
      const result = service.rewardsDuringPeriod(
        1, // one roll
        2, // one roll
        new Date(start.getTime()),
        new Date(start.getTime() + 60_000 * 60), // start + one hour
        new BigNumber(100_000_000_000), // one roll
      );
      expect(result.toString()).toBe(
        new BigNumber('4896000000000.00000002448').toString(),
      );
    });
    it('real use case, one day', () => {
      const result = service.rewardsDuringPeriod(
        500_000,
        500_000,
        start,
        end,
        new BigNumber('10000000000'), // 10 MAS
      );
      expect(result.toString()).toBe(new BigNumber('35251200').toString());
    });
    it('real use case, next day', () => {
      const result = service.rewardsDuringPeriod(
        500_000,
        500_000,
        start,
        end,
        new BigNumber('10035251200'), // 10 MAS + rewards from previous day
      );
      expect(result.toString()).toBe(
        new BigNumber('35375464.710144').toString(),
      );
    });
    it('real use case, one hour', () => {
      const result = service.rewardsDuringPeriod(
        500_000,
        500_000,
        new Date(start.getTime()),
        new Date(start.getTime() + 60_000 * 60), // start + one hour
        service.rollPrice.multipliedBy(50_000), // user has 50k rolls
      );
      expect(result.toString()).toBe(
        new BigNumber(176.256)
          .dividedBy(24)
          .multipliedBy(service.rollPrice)
          .toString(),
      );
    });
    it('real use case, low amount', () => {
      const result = service.rewardsDuringPeriod(
        500_000,
        500_000,
        new Date(start.getTime()),
        new Date(start.getTime() + 60_000 * 60), // start + one hour
        new BigNumber(10_000_000_000), // 10 MAS
      );
      expect(result.toString()).toBe(
        new BigNumber(176.256)
          .dividedBy(500_000)
          .dividedBy(24)
          .multipliedBy(service.rollPrice)
          .toString(),
      );
    });
    it('real use case, very low amount', () => {
      const result = service.rewardsDuringPeriod(
        1_000_000,
        1_000_000,
        new Date(start.getTime()),
        new Date(start.getTime() + 60_000), // start + one minute
        new BigNumber(10_000_000_000), // 10 MAS
      );
      expect(result.toString()).toBe('12240');
    });
    it('extra 1', () => {
      const result = service.rewardsDuringPeriod(
        500000,
        500000,
        start,
        end,
        new BigNumber(10_000_000_000),
      );
      expect(result.toString()).toBe('35251200');
    });
    it('extra 2', () => {
      const result = service.rewardsDuringPeriod(
        500000,
        500000,
        end,
        dateJan3,
        new BigNumber(10_000_000_000 + 35251200),
      );
      expect(result.toString()).toBe('35375464.710144');
    });
  });

  describe('rewardsPerRoll', () => {
    it('should return max rewards per day', () => {
      const result = service.rewardsPerRoll(
        new BigNumber(1),
        service.rollPrice,
      );
      expect(result.toString()).toBe(
        new BigNumber(176_256_000_000_000).toString(),
      );
    });
    it('should return half of max rewards per day', () => {
      const result = service.rewardsPerRoll(
        new BigNumber(1),
        service.rollPrice.dividedBy(2),
      );
      expect(result.toString()).toBe(
        new BigNumber(176_256_000_000_000).dividedBy(2).toString(),
      );
    });
    it('limit: 0', () => {
      const result = service.rewardsPerRoll(new BigNumber(1), new BigNumber(0));
      expect(result.toString()).toBe('0');
    });
    it('real use case', () => {
      const result = service.rewardsPerRoll(
        new BigNumber(500_000),
        service.rollPrice.multipliedBy(50_000), // user has 50k rolls
      );
      expect(result.toString()).toBe(
        new BigNumber(176.256).multipliedBy(service.rollPrice).toString(),
      );
    });
    it('real use case, low user amount', () => {
      const result = service.rewardsPerRoll(
        new BigNumber(500_000),
        new BigNumber(1_000_000_000), // 1 MAS
      );
      expect(result.toString()).toBe(fromMAS('0.00352512').toString());
    });
  });
  describe('averageRolls', () => {
    it('should return max rewards per day', () => {
      const result = service.averageRolls(new BigNumber(1), new BigNumber(2));
      expect(result.toString()).toBe(new BigNumber(1.5).toString());
    });
  });
});
