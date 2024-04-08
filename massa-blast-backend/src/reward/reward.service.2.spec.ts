import { Test, TestingModule } from '@nestjs/testing';
import { RewardService } from './reward.service';
import { DatabaseService } from '../database/database.service';
import { TotalRollsRecord } from '../database/entities/TotalRollsRecord';

describe('RewardService', () => {
  let service: RewardService;
  const start = new Date('2021-01-01');
  const end = new Date('2021-01-02');
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

  describe('getRewards', () => {
    it('limit case', async () => {
      // First test uses the initial mock setup
      const result = await service.getRewards(10_000_000_000n, start, end);
      expect(result.toString()).toBe('15863040000000');
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

      const result = await service.getRewards(10_000_000_000n, start, end);
      expect(result.toString()).toBe('283679250076016640');
    });
  });
});
