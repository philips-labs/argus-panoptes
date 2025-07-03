import request from 'supertest';
import express from 'express';
import { createRouter } from './router';
import { DatabaseService, LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

// Mocks
const mockLogger: jest.Mocked<LoggerService> = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

const mockStore = {
  getAllSummariesForDate: jest.fn(),
  saveSummaries: jest.fn(),
};

// Mock DB client
const mockDbClient = {
  select: jest.fn(),
  where: jest.fn(),
};

// Mock database manager
const mockDatabase: Partial<DatabaseService> = {
  getClient: jest.fn().mockResolvedValue({
    // Mock AISummaryStore internals here
    ...mockDbClient,
    // Fake store injection
    __store__: mockStore,
  }),
};

// Mock config
const mockConfig: Partial<Config> = {
  getOptionalConfigArray: jest.fn().mockReturnValue([
    {
      getOptionalString: jest.fn().mockReturnValue('mock-gemini-token'),
    },
  ]),
};

// Patch fetch for Gemini endpoint
global.fetch = jest.fn();

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    // Spy on AISummaryStore to inject mock store
    jest.mock('./utils/aiSummaryStore', () => ({
      AISummaryStore: jest.fn().mockImplementation(() => mockStore),
    }));

    const router = await createRouter({
      logger: mockLogger,
      config: mockConfig as Config,
      database: mockDatabase as DatabaseService,
    });

    app = express();
    app.use(express.json());
    app.use(router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /summaries', () => {
    it('returns 400 if date param is missing', async () => {
      const res = await request(app).get('/summaries');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Missing required "date" query param',
      });
    });

    it('returns 500 on fetch error', async () => {
      mockStore.getAllSummariesForDate.mockRejectedValue(new Error('fail'));

      const res = await request(app).get('/summaries?date=2025-06-19');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not fetch summaries' });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('POST /summaries', () => {
    it('returns 400 for bad input', async () => {
      const res = await request(app).post('/summaries').send({
        system: 'sys',
        summaries: [],
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid request format' });
    });

    it('returns 500 on save error', async () => {
      mockStore.saveSummaries.mockRejectedValue(new Error('db fail'));

      const res = await request(app)
        .post('/summaries')
        .send({
          system: 'sys',
          date: '2025-06-19',
          summaries: [{ repoName: 'repo1', summary: 'fail' }],
        });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Could not save summaries' });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('POST /generate', () => {
    it('calls Gemini API and returns result', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ generated: 'text response' }),
      });

      const res = await request(app).post('/generate').send({ prompt: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ generated: 'text response' });
    });

    it('returns 400 if prompt is missing', async () => {
      const res = await request(app).post('/generate').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Missing prompt' });
    });

    it('returns 500 if Gemini token is missing', async () => {
      (mockConfig.getOptionalConfigArray as jest.Mock).mockReturnValueOnce([]);

      const res = await request(app).post('/generate').send({ prompt: 'test' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Gemini token not configured' });
    });

    it('returns 500 if Gemini fetch fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'bad token' }),
      });

      const res = await request(app).post('/generate').send({ prompt: 'test' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'bad token' });
    });

    it('returns 500 on fetch exception', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('network fail'));

      const res = await request(app).post('/generate').send({ prompt: 'test' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to generate summary' });
    });
  });
});
