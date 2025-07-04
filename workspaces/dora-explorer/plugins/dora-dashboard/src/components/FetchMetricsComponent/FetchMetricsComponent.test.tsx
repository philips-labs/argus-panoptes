import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { FetchMetricsComponent } from './FetchMetricsComponent';
import {
  discoveryApiRef,
  fetchApiRef,
  FetchApi,
} from '@backstage/core-plugin-api';
import { screen, fireEvent, waitFor } from '@testing-library/react';

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(msg => {
    if (
      typeof msg === 'string' &&
      msg.includes('React Router Future Flag Warning')
    ) {
      return;
    }
  });
});

// Mock data
const mockProjects = ['project-alpha', 'project-beta'];
const mockMetrics = [
  { id: 'df', dataPoints: [{ key: '2025-01', value: 5 }] },
  { id: 'mltc', dataPoints: [{ key: '2025-01', value: 10 }] },
  { id: 'cfr', dataPoints: [] },
  { id: 'mttr', dataPoints: [] },
];

// Mock APIs
const discoveryApi = {
  getBaseUrl: async () => 'http://localhost:7007/api/dora-dashboard',
};

const fetchApi: Partial<FetchApi> = {
  fetch: jest.fn(async (input: RequestInfo | URL) => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      throw new Error('Unsupported input type for fetch');
    }

    if (url.endsWith('/projects')) {
      return new Response(JSON.stringify(mockProjects), { status: 200 });
    }

    if (url.includes('/metrics/')) {
      const metricId = /metrics\/(.*?)\//.exec(url)?.[1];
      const metric = mockMetrics.find(m => m.id === metricId);
      const data = (metric?.dataPoints || []).map(dp => ({
        data_key: dp.key,
        data_value: dp.value,
      }));
      return new Response(JSON.stringify(data), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  }),
};

describe('FetchMetricsComponent', () => {
  it('renders, loads projects, and fetches metrics on button click', async () => {
    await renderInTestApp(
      <TestApiProvider
        apis={[
          [discoveryApiRef, discoveryApi],
          [fetchApiRef, fetchApi],
        ]}
      >
        <FetchMetricsComponent />
      </TestApiProvider>,
    );

    expect(await screen.findByLabelText('Select Projects')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Fetch Monthly Data/i));

    await waitFor(() =>
      expect(screen.getByText(/Fetched Data/i)).toBeInTheDocument(),
    );

    expect(screen.getByText(/Deploy Freq Avg/i)).toBeInTheDocument();
  });
});
