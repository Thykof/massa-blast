import { Test, TestingModule } from '@nestjs/testing';
import { BlasterService } from './blaster.service';
import { ClientService } from '../client/client.service';

describe('BlasterService', () => {
  let service: BlasterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlasterService, ClientService],
    }).compile();

    service = module.get<BlasterService>(BlasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('howManyRollsToSell', () => {
    expect(service.howManyRollsToSell(0n, 1_000_000_000n)).toBe(1n);
    expect(service.howManyRollsToSell(0n, 99_000_000_000n)).toBe(1n);
    expect(service.howManyRollsToSell(0n, 399_000_000_000n)).toBe(4n);
    expect(service.howManyRollsToSell(0n, 500_000_000_000n)).toBe(5n);
    expect(service.howManyRollsToSell(0n, 6_000_000_000_000n)).toBe(60n);
    expect(service.howManyRollsToSell(0n, 6_100_000_000_000n)).toBe(61n);
    expect(service.howManyRollsToSell(0n, 6_101_000_000_000n)).toBe(62n);
  });
});
