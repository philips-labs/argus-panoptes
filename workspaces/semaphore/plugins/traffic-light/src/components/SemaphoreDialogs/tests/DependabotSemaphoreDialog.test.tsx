import { render, screen, waitFor } from '@testing-library/react';
import { DependabotSemaphoreDialog } from '../DependabotSemaphoreDialog';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { TestApiProvider } from '@backstage/test-utils';
import { Entity } from '@backstage/catalog-model';
import { DependabotUtils } from '../../../utils/dependabotUtils';
import * as dependabotColor from '../../Semaphores/TrafficLightDependabot';

jest.mock('../../../utils/dependabotUtils');
jest.mock('../../Semaphores/TrafficLightDependabot');

const mockGetDependabotFacts = jest.fn();
(DependabotUtils as jest.Mock).mockImplementation(() => ({
  getDependabotFacts: mockGetDependabotFacts,
}));

const mockDetermineDependabotColor =
  dependabotColor.determineDependabotColor as jest.Mock;

const mockEntity: Entity = {
  apiVersion: '1',
  kind: 'Component',
  metadata: {
    name: 'test-repo',
    namespace: 'default',
  },
  spec: {},
};

describe('DependabotSemaphoreDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders metrics and top repos', async () => {
    mockGetDependabotFacts.mockResolvedValue({
      critical: 3,
      high: 1,
      medium: 0,
    });

    mockDetermineDependabotColor.mockResolvedValue({
      color: 'red',
    });

    render(
      <TestApiProvider apis={[[techInsightsApiRef, {} as any]]}>
        <DependabotSemaphoreDialog
          open
          onClose={() => {}}
          entities={[mockEntity]}
          system="my-system"
        />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Total Issues/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Repositories/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Critical/i)[0]).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Top 5 Repositories by Priority/i),
    ).toBeInTheDocument();
  });

  it('shows summary when no issues are found', async () => {
    mockGetDependabotFacts.mockResolvedValue({
      critical: 0,
      high: 0,
      medium: 0,
    });

    mockDetermineDependabotColor.mockResolvedValue({
      color: 'green',
    });

    render(
      <TestApiProvider apis={[[techInsightsApiRef, {} as any]]}>
        <DependabotSemaphoreDialog
          open
          onClose={() => {}}
          entities={[mockEntity]}
          system="my-system"
        />
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/No Dependabot security issues found/i),
      ).toBeInTheDocument(),
    );
  });

  it('handles API error gracefully', async () => {
    mockGetDependabotFacts.mockRejectedValue(new Error('Failed to fetch'));

    mockDetermineDependabotColor.mockResolvedValue({
      color: 'gray',
    });

    render(
      <TestApiProvider apis={[[techInsightsApiRef, {} as any]]}>
        <DependabotSemaphoreDialog
          open
          onClose={() => {}}
          entities={[mockEntity]}
          system="my-system"
        />
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Failed to load Dependabot data/i),
      ).toBeInTheDocument(),
    );
  });
});
