import { SummaryPerRepo } from '@philips-labs/plugin-ai-plugin';
import { AISummaryStore } from './aiSummaryStore';

// Create a mock chainable query builder
const mockQueryBuilder = () => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn(),
  };
  return chain;
};

describe('AISummaryStore', () => {
  let mockDb: any;
  let store: AISummaryStore;

  beforeEach(() => {
    mockDb = jest.fn();
    store = new AISummaryStore(mockDb);
  });

  describe('getSummariesForToday', () => {
    it('returns mapped summaries for today', async () => {
      const builder = mockQueryBuilder();
      builder.where.mockResolvedValue([
        { repo_name: 'repo1', summary: 'summary1' },
        { repo_name: 'repo2', summary: 'summary2' },
      ]);

      mockDb.mockReturnValue(builder);

      const result = await store.getSummariesForToday('sys', '2025-06-19');

      expect(result).toEqual([
        { repoName: 'repo1', summary: 'summary1' },
        { repoName: 'repo2', summary: 'summary2' },
      ]);
    });
  });

  describe('getAllSummariesForDate', () => {
    it('returns grouped summaries by system', async () => {
      const builder = mockQueryBuilder();
      builder.where.mockResolvedValue([
        { system: 'sysA', repo_name: 'repo1', summary: 's1' },
        { system: 'sysB', repo_name: 'repo2', summary: 's2' },
        { system: 'sysA', repo_name: 'repo3', summary: 's3' },
      ]);

      mockDb.mockReturnValue(builder);

      const result = await store.getAllSummariesForDate('2025-06-19');

      expect(result).toEqual({
        sysA: [
          { repoName: 'repo1', summary: 's1' },
          { repoName: 'repo3', summary: 's3' },
        ],
        sysB: [{ repoName: 'repo2', summary: 's2' }],
      });
    });
  });

  describe('saveSummaries', () => {
    it('saves non-empty summaries with merge on conflict', async () => {
      const summaries: SummaryPerRepo[] = [
        { repoName: 'repo1', summary: 'Summary 1' },
        { repoName: 'repo2', summary: '  Summary 2  ' },
        { repoName: 'repo3', summary: '' },
        { repoName: 'repo4', summary: '   ' },
      ];

      const builder = mockQueryBuilder();
      mockDb.mockReturnValue(builder);

      await store.saveSummaries('sysX', '2025-06-19', summaries);

      expect(mockDb).toHaveBeenCalledWith('ai_summaries');
      expect(builder.insert).toHaveBeenCalledWith([
        {
          system: 'sysX',
          repo_name: 'repo1',
          summary: 'Summary 1',
          date: '2025-06-19',
        },
        {
          system: 'sysX',
          repo_name: 'repo2',
          summary: '  Summary 2  ',
          date: '2025-06-19',
        },
      ]);
      expect(builder.onConflict).toHaveBeenCalledWith([
        'system',
        'repo_name',
        'date',
      ]);
      expect(builder.merge).toHaveBeenCalled();
    });

    it('skips saving if no valid summaries', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const summaries: SummaryPerRepo[] = [
        { repoName: 'r1', summary: '' },
        { repoName: 'r2', summary: '   ' },
      ];

      await store.saveSummaries('sysX', '2025-06-19', summaries);

      // should not even call db
      expect(mockDb).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('throws and logs error on insert failure', async () => {
      const error = new Error('Insert failed');
      const builder = mockQueryBuilder();
      builder.merge.mockRejectedValue(error);
      mockDb.mockReturnValue(builder);

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(
        store.saveSummaries('sysX', '2025-06-19', [
          { repoName: 'r1', summary: 'some summary' },
        ]),
      ).rejects.toThrow('Insert failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to insert summaries:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });
});
