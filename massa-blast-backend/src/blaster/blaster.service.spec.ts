import { BlasterService } from './blaster.service';
import { ClientService } from '../client/client.service';
import { BlastingSession } from '../client/types/BlastingSession';

describe('BlasterService', () => {
  let blasterService: BlasterService;
  let clientService: ClientService;
  let getBlastingSessionsOfPendingWithdrawRequests: jest.SpyInstance;
  let getBalance: jest.SpyInstance;
  let setWithdrawableFor: jest.SpyInstance;
  let getAllDeferredCredits: jest.SpyInstance;
  let sellRolls: jest.SpyInstance;
  let buyRolls: jest.SpyInstance;

  beforeEach(async () => {
    clientService = new ClientService();
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([]);
    getBalance = jest.spyOn(clientService, 'getBalance').mockResolvedValue(0n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);
    sellRolls = jest.spyOn(clientService, 'sellRolls').mockResolvedValue();
    buyRolls = jest.spyOn(clientService, 'buyRolls').mockResolvedValue();

    blasterService = new BlasterService(clientService);
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
    expect(setWithdrawableFor).not.toHaveBeenCalled();
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).not.toHaveBeenCalled();
    expect(buyRolls).not.toHaveBeenCalled();
  });

  it('sell rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 1_000_000_000n, 'AU1', 'O1'),
      ]);
    getBalance = jest.spyOn(clientService, 'getBalance').mockResolvedValue(0n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).not.toHaveBeenCalled();
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
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).not.toHaveBeenCalled();
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).not.toHaveBeenCalled();
    expect(buyRolls).toHaveBeenCalled();
  });

  it('distribute', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenCalledWith(
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute and buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(200_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenCalledWith(
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(1);
  });

  it('distribute and sell rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
        new BlastingSession(0n, 200_000_000_000n, 'AU2', 'O2'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(1);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute and buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
        new BlastingSession(0n, 200_000_000_000n, 'AU2', 'O2'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(400_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      'AU2',
      'O2',
      200_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(1);
  });

  it('sort before distribute', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
        new BlastingSession(1n, 200_000_000_000n, 'AU2', 'O2'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(300_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(0n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      'AU2',
      'O2',
      200_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute with deferred credit', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
        new BlastingSession(0n, 200_000_000_000n, 'AU2', 'O2'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(300_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(200_000_000_000n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      'AU2',
      'O2',
      200_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenCalledTimes(0);
    expect(buyRolls).toHaveBeenCalledTimes(0);
  });

  it('distribute with deferred credit and sell rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
        new BlastingSession(0n, 300_000_000_000n, 'AU2', 'O2'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(100_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(200_000_000_000n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).toHaveBeenNthCalledWith(1, 1n);
    expect(buyRolls).not.toHaveBeenCalled();
  });

  it('distribute with deferred credit and buy rolls', async () => {
    getBlastingSessionsOfPendingWithdrawRequests = jest
      .spyOn(clientService, 'getBlastingSessionsOfPendingWithdrawRequests')
      .mockResolvedValue([
        new BlastingSession(0n, 100_000_000_000n, 'AU1', 'O1'),
        new BlastingSession(0n, 300_000_000_000n, 'AU2', 'O2'),
      ]);
    getBalance = jest
      .spyOn(clientService, 'getBalance')
      .mockResolvedValue(600_000_000_000n);
    setWithdrawableFor = jest
      .spyOn(clientService, 'setWithdrawableFor')
      .mockImplementation();
    getAllDeferredCredits = jest
      .spyOn(clientService, 'getAllDeferredCredits')
      .mockResolvedValue(200_000_000_000n);

    await blasterService.blast();
    expect(getBalance).toHaveBeenCalled();
    expect(getAllDeferredCredits).toHaveBeenCalled();
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      1,
      'AU1',
      'O1',
      100_000_000_000n,
    );
    expect(setWithdrawableFor).toHaveBeenNthCalledWith(
      2,
      'AU2',
      'O2',
      300_000_000_000n,
    );
    expect(getBlastingSessionsOfPendingWithdrawRequests).toHaveBeenCalled();
    expect(sellRolls).not.toHaveBeenCalled();
    expect(buyRolls).toHaveBeenNthCalledWith(1, 2n);
  });
});
