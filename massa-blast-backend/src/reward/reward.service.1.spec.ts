import { Test, TestingModule } from '@nestjs/testing';
import { RewardService } from './reward.service';
import { DatabaseService } from '../database/database.service';
import { TotalRollsRecord } from '../database/entities/TotalRollsRecord';
import BigNumber from 'bignumber.js';

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

  describe('getRewards', () => {});

  describe('getRewardsWithoutFees', () => {
    it('limit case', async () => {
      // First test uses the initial mock setup
      const result = await service.getRewardsWithoutFees(
        new BigNumber(10_000_000_000),
        start,
        end,
      );
      expect(result.toString()).toBe('17625600000000');
    });

    it('should return the rewards', async () => {
      // Directly modify the mocked `getTotalRolls` before running the test
      mockDatabaseService.getTotalRolls.mockResolvedValueOnce([
        new TotalRollsRecord(1, start),
        new TotalRollsRecord(1, new Date(start.getTime() + 60_000 * 60)),
        new TotalRollsRecord(1, new Date(start.getTime() + 60_000 * 60 * 2)),
        new TotalRollsRecord(1, new Date(start.getTime() + 60_000 * 60 * 3)),
        new TotalRollsRecord(1, new Date(start.getTime() + 60_000 * 60 * 4)),
      ]);

      const result = await service.getRewardsWithoutFees(
        new BigNumber(10_000_000_000),
        start,
        end,
      );
      expect(result.toString()).toBe('315199166751129600');
    });

    it('real use case, one day', async () => {
      mockDatabaseService.getTotalRolls.mockResolvedValueOnce([
        new TotalRollsRecord(500_000, start),
        new TotalRollsRecord(500_000, end),
      ]);

      const result = await service.getRewardsWithoutFees(
        new BigNumber(10_000_000_000),
        start,
        end,
      );
      expect(result.toString()).toBe('35251200');
    });
    it('real use case, 2 days', async () => {
      mockDatabaseService.getTotalRolls.mockResolvedValueOnce([
        new TotalRollsRecord(500_000, start),
        new TotalRollsRecord(500_000, end),
      ]);

      const result = await service.getRewardsWithoutFees(
        new BigNumber('10035251200'),
        start,
        end,
      );
      expect(result.toString()).toBe('35375464.710144');
    });
    it('real use case, 2 days bis', async () => {
      mockDatabaseService.getTotalRolls.mockResolvedValueOnce([
        new TotalRollsRecord(500_000, start),
        new TotalRollsRecord(500_000, end),
        new TotalRollsRecord(500_000, dateJan3),
      ]);

      const result = await service.getRewardsWithoutFees(
        new BigNumber('10000000000'),
        start,
        end,
      );
      expect(result.toString()).toBe('70502400');
    });
    it('real use case, 1 year', async () => {
      mockDatabaseService.getTotalRolls.mockResolvedValueOnce(
        generateDateArray(start, 365).map(
          (date) => new TotalRollsRecord(1_500_000, date),
        ),
      );

      const result = await service.getRewardsWithoutFees(
        new BigNumber(1_000_000_000),
        start,
        end,
      );
      expect(result.toString()).toBe('427714560.00021385728');
    });
    it('real use case, 11 year (compound)', async () => {
      mockDatabaseService.getTotalRolls.mockResolvedValueOnce(
        generateDateArray(start, 365 * 11).map(
          (date) => new TotalRollsRecord(1_500_000, date),
        ),
      );

      const result = await service.getRewardsWithoutFees(
        new BigNumber(18_000_000_000),
        start,
        end,
      );
      expect(result.toString()).toBe('4604163708609.69542408592');
    });
  });
});

function generateDateArray(currentDate: Date, length: number): Date[] {
  const datesArray: Date[] = [];

  for (let i = 0; i < length; i++) {
    // Push a new Date object to the array
    datesArray.push(new Date(currentDate));

    // Increment the date by 1 day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return datesArray;
}
