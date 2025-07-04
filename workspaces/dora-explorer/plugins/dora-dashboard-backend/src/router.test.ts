import express from 'express';
import request from 'supertest';
import { createRouter } from './router';
import { DoraService } from './services/DoraService/types';

const mockGetMetric = jest.fn();
const mockGetProjectNames = jest.fn();

const mockDoraService: DoraService = {
  getMetric: mockGetMetric,
  getProjectNames: mockGetProjectNames,
};

const mockHttpAuth = {} as any;

describe('router', () => {
  let app: express.Express;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = express();

    const router = await createRouter({
      httpAuth: mockHttpAuth,
      doraService: mockDoraService,
    });

    app.use(router);
  });

  it('responds with metrics data', async () => {
    mockGetMetric.mockResolvedValue([{ date: '2024-01-01', value: 1 }]);

    const res = await request(app).get(
      '/metrics/df/daily/1710000000/1711000000?projects=proj1,proj2',
    );

    expect(res.status).toBe(200);
    expect(mockGetMetric).toHaveBeenCalledWith(
      'df',
      'daily',
      ['proj1', 'proj2'],
      1710000000,
      1711000000,
    );
    expect(res.body).toEqual([{ date: '2024-01-01', value: 1 }]);
  });

  it('handles missing projects query by defaulting to empty array', async () => {
    mockGetMetric.mockResolvedValue([{ date: '2024-01-01', value: 1 }]);

    const res = await request(app).get(
      '/metrics/df/daily/1710000000/1711000000',
    );

    expect(res.status).toBe(200);
    expect(mockGetMetric).toHaveBeenCalledWith(
      'df',
      'daily',
      [],
      1710000000,
      1711000000,
    );
  });

  it('handles non-string projects query gracefully', async () => {
    mockGetMetric.mockResolvedValue([{ date: '2024-01-01', value: 1 }]);

    const res = await request(app)
      .get('/metrics/df/daily/1710000000/1711000000')
      .query({ projects: ['proj1', 'proj2'] });

    expect(res.status).toBe(200);
    expect(mockGetMetric).toHaveBeenCalledWith(
      'df',
      'daily',
      [],
      1710000000,
      1711000000,
    );
  });

  it('returns 500 if getMetric throws', async () => {
    mockGetMetric.mockRejectedValue(new Error('fail'));

    const res = await request(app).get(
      '/metrics/df/daily/1710000000/1711000000?projects=proj1,proj2',
    );

    // Since the router doesn’t handle this error, it may crash the request
    // In Express default, this will send a 500 status anyway
    expect(res.status).toBe(500);
  });

  it('responds with project names', async () => {
    mockGetProjectNames.mockResolvedValue(['proj1', 'proj2']);

    const res = await request(app).get('/projects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['proj1', 'proj2']);
    expect(mockGetProjectNames).toHaveBeenCalled();
  });

  it('returns 500 if getProjectNames fails', async () => {
    mockGetProjectNames.mockRejectedValue(new Error('fail'));

    const res = await request(app).get('/projects');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch project names' });
  });
});
