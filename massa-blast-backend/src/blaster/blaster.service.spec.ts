import { BlasterService } from './blaster.service';
import { ClientService } from '../client/client.service';
import { BlastingSession } from '../client/types/BlastingSession';
import { RewardService } from '../reward/reward.service';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { TotalRollsRecord } from '../database/entities/TotalRollsRecord';

describe('BlasterService', () => {
  // BlasterService
  let blasterService: BlasterService;
  let blasterSetWithdrawableFor: jest.SpyInstance;

  // ClientService
  let clientService: ClientService;
  let getBlastingSessionsOfPendingWithdrawRequests: jest.SpyInstance;
  let getBalance: jest.SpyInstance;
  let getAllDeferredCredits: jest.SpyInstance;
  let sellRolls: jest.SpyInstance;
  let buyRolls: jest.SpyInstance;

  // RewardService
  let rewardService: RewardService;

  // Dates
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-02');
  const startTimestamp = BigInt(startDate.getTime());
  const endTimestamp = BigInt(endDate.getTime());

  beforeEach(async () => {
    clientService = new ClientService();
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([]);
    getBalance = jest.spyOn(clientService, 'getBalance').mockResolvedValue(0n);
    jest.spyOn(clientService, 'setWithdrawableFor').mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);
    sellRolls = jest.spyOn(clientService, 'sellRolls').mockResolvedValue();
    buyRolls = jest.spyOn(clientService, 'buyRolls').mockResolvedValue();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BlasterService,
        ClientService,
        RewardService,
        DatabaseService,
      ],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        addTotalRolls: jest.fn(),
        getTotalRolls: jest
          .fn()
          .mockResolvedValue([
            new TotalRollsRecord(1_000_000_000, startDate),
            new TotalRollsRecord(1_000_000_000, endDate),
          ]),
      })
      .compile();

    rewardService = await moduleRef.resolve(RewardService);
    blasterService = new BlasterService(clientService, rewardService);
    blasterSetWithdrawableFor = jest.spyOn(
      blasterService,
      'setWithdrawableFor',
    );
  });

  it('should be defined', () => {
    expect(blasterService).toBeDefined();
  });

  it('howManyRollsToSell', () => {
    expect(blasterService.howManyRollsToSell(0n, 1_000_000_000n)).toBe(1n);
    expect(blasterService.howManyRollsToSell(0n, 99_000_000_000n)).toBe(1n);
    expect(blasterService.howManyRollsToSell(0n, 399_000_000_000n)).toBe(4n);
    expect(blasterService.howManyRollsToSell(0n, 500_000_000_000n)).toBe(5n);
    expect(blasterService.howManyRollsToSell(0n, 6_000_000_000_000n)).toBe(60n);
    expect(blasterService.howManyRollsToSell(0n, 6_100_000_000_000n)).toBe(61n);
    expect(blasterService.howManyRollsToSell(0n, 6_101_000_000_000n)).toBe(62n);
  });

  it('blast', async () => {
    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).not.toHaveBeenCalled();
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).not.toHaveBeenCalled();
    expect(buyRolls).not.toHaveBeenCalled();
  });

  it('sell rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          1_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
      ]);
    getBalance = jest.spyOn(clientService, 'getBalance').mockResolvedValue(0n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).not.toHaveBeenCalled();
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalled();
    expect(buyRolls).not.toHaveBeenCalled();
  });

  it('buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).not.toHaveBeenCalled();
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).not.toHaveBeenCalled();
    expect(buyRolls).toHaveBeenCalled();
  });

  it('distribute', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute and buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(200_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(1);
  });

  it('distribute and sell rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
        new BlastingSession(
          startTimestamp,
          200_000_000_000n,
          'AU2',
          'O2',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(1);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute and buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
        new BlastingSession(
          startTimestamp,
          200_000_000_000n,
          'AU2',
          'O2',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(400_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      new BlastingSession(
        startTimestamp,
        200_000_000_000n,
        'AU2',
        'O2',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(1);
  });

  it('sort before distribute', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
        new BlastingSession(
          startTimestamp,
          200_000_000_000n,
          'AU2',
          'O2',
          endTimestamp + 1n,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(300_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        200_000_000_000n,
        'AU2',
        'O2',
        endTimestamp + 1n,
      ),
    );
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );

    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute with deferred credit', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
        new BlastingSession(
          startTimestamp,
          200_000_000_000n,
          'AU2',
          'O2',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(300_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(200_000_000_000n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      new BlastingSession(
        startTimestamp,
        200_000_000_000n,
        'AU2',
        'O2',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute with deferred credit and sell rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
        new BlastingSession(
          startTimestamp,
          300_000_000_000n,
          'AU2',
          'O2',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(200_000_000_000n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenNthCalledWith(1, 1n);
    expect(buyRolls).not.toHaveBeenCalled();
  });

  it('distribute with deferred credit and buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(
          startTimestamp,
          100_000_000_000n,
          'AU1',
          'O1',
          endTimestamp,
        ),
        new BlastingSession(
          startTimestamp,
          300_000_000_000n,
          'AU2',
          'O2',
          endTimestamp,
        ),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(600_000_000_000n);
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(200_000_000_000n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      new BlastingSession(
        startTimestamp,
        100_000_000_000n,
        'AU1',
        'O1',
        endTimestamp,
      ),
    );
    expect(blasterSetWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      new BlastingSession(
        startTimestamp,
        300_000_000_000n,
        'AU2',
        'O2',
        endTimestamp,
      ),
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).not.toHaveBeenCalled();
    expect(buyRolls).toHaveBeenNthCalledWith(1, 2n);
  });
});
