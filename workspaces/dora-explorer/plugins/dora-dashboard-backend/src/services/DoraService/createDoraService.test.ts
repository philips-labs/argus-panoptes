import { createDoraService } from './createDoraService';
import { ConfigReader } from '@backstage/config';

const mockExecute = jest.fn();

jest.mock('mysql2/promise', () => ({
  createPool: () => ({
    execute: mockExecute,
  }),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(
    () => 'SELECT * FROM metrics WHERE date BETWEEN ? AND ? AND project IN (?)',
  ),
}));

jest.mock('@backstage/backend-plugin-api', () => ({
  ...jest.requireActual('@backstage/backend-plugin-api'),
  resolvePackagePath: () => '/mocked/path/query.sql',
}));

const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: () => logger,
};

const config = new ConfigReader({
  dora: {
    db: {
      host: 'localhost',
      user: 'root',
      password: 'pass',
      database: 'dora_db',
    },
  },
});

describe('DoraService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return project names', async () => {
    mockExecute.mockResolvedValueOnce([[{ name: 'proj1' }, { name: 'proj2' }]]);

    const service = await createDoraService({ logger, config });
    const names = await service.getProjectNames();

    expect(names).toEqual(['proj1', 'proj2']);
    expect(mockExecute).toHaveBeenCalledWith(
      'SELECT DISTINCT name FROM projects',
    );
  });

  it('should log and throw on DB error in getProjectNames', async () => {
    const error = new Error('fail');
    mockExecute.mockRejectedValueOnce(error);

    const service = await createDoraService({ logger, config });

    await expect(service.getProjectNames()).rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });

  test.each([
    ['cfr', 'daily'],
    ['cfr', 'monthly'],
    ['df', 'daily'],
    ['df', 'monthly'],
    ['mltc', 'daily'],
    ['mltc', 'monthly'],
    ['mttr', 'daily'],
    ['mttr', 'monthly'],
  ])(
    'should return data for metric=%s and aggregation=%s',
    async (metric, agg) => {
      const fakeResult = [{ date: '2024-01-01', value: 42 }];
      mockExecute.mockResolvedValueOnce([fakeResult]);

      const service = await createDoraService({ logger, config });
      const result = await service.getMetric(
        metric as any,
        agg as any,
        ['project1'],
        1,
        2,
      );

      expect(result).toEqual(fakeResult);
      expect(mockExecute).toHaveBeenCalled();
    },
  );

  it('throws for unsupported metric type', async () => {
    const service = await createDoraService({ logger, config });
    await expect(
      service.getMetric('unknown' as any, 'daily', ['p'], 1, 2),
    ).rejects.toThrow('Unsupported DORA metric type');
  });

  it('throws for unsupported aggregation', async () => {
    const service = await createDoraService({ logger, config });
    await expect(
      service.getMetric('cfr', 'yearly' as any, ['p'], 1, 2),
    ).rejects.toThrow('Unsupported aggregation');
  });
});
