// plugins/traffic-light/src/components/Semaphores/tests/DependabotTrafficLight.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { TrafficLightDependabot } from '../TrafficLightDependabot';
import {
  techInsightsApiRef,
  TechInsightsApi,
} from '@backstage/plugin-tech-insights';
import { TestApiProvider } from '@backstage/test-utils';
import { Entity } from '@backstage/catalog-model';
import { DependabotUtils } from '../../../utils/dependabotUtils';

jest.mock('../../../utils/dependabotUtils');

const mockTechInsightsApi: jest.Mocked<Partial<TechInsightsApi>> = {
  getFacts: jest.fn(),
};

const mockEntities: Entity[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'repo-1', namespace: 'default' },
    spec: { system: 'mock-system' },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'repo-2', namespace: 'default' },
    spec: { system: 'mock-system' },
  },
];

describe('TrafficLightDependabot', () => {
  beforeAll(() => {
    // Suppress findDOMNode deprecation warning from Material-UI Tooltip
    jest.spyOn(console, 'error').mockImplementation(msg => {
      if (typeof msg === 'string' && msg.includes('findDOMNode')) return;
    });
  });

  beforeEach(() => jest.clearAllMocks());

  const renderComponent = (
    systemName?: string,
    entities: Entity[] = mockEntities,
  ) =>
    render(
      <TestApiProvider apis={[[techInsightsApiRef, mockTechInsightsApi]]}>
        <TrafficLightDependabot
          systemName={systemName as any}
          entities={entities}
        />
      </TestApiProvider>,
    );

  it('shows gray when no entities provided', async () => {
    renderComponent('mock-system', []);
    await waitFor(() => {
      expect(screen.getByTitle('No entities selected')).toBeInTheDocument();
    });
  });

  it('shows gray when systemName is empty', async () => {
    renderComponent('', mockEntities);
    await waitFor(() => {
      expect(
        screen.getByTitle(/No entities found for system/i),
      ).toBeInTheDocument();
    });
  });

  it('shows gray when systemName is undefined and fallback fails', async () => {
    const fallbackEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'repo-x', namespace: 'default' },
        spec: { system: 'other-system' },
      },
    ];
    renderComponent(undefined, fallbackEntities);
    await waitFor(() => {
      expect(
        screen.getByTitle(/No entities found for system/i),
      ).toBeInTheDocument();
    });
  });

  it('pretends to use fallback system name by explicitly passing the fallback', async () => {
    const fallbackEntities: Entity[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'fallback-repo', namespace: 'default' },
        spec: { system: 'fallback-system' },
      },
    ];

    (DependabotUtils as jest.Mock).mockImplementation(() => ({
      getDependabotChecks: jest.fn().mockResolvedValue({
        criticalAlertCheck: true,
        highAlertCheck: true,
        mediumAlertCheck: true,
      }),
    }));

    renderComponent('fallback-system', fallbackEntities);

    await waitFor(() => {
      expect(
        screen.getByTitle('All dependabot checks passed'),
      ).toBeInTheDocument();
    });
  });

  it('shows green when all checks pass', async () => {
    (DependabotUtils as jest.Mock).mockImplementation(() => ({
      getDependabotChecks: jest.fn().mockResolvedValue({
        criticalAlertCheck: true,
        highAlertCheck: true,
        mediumAlertCheck: true,
      }),
    }));
    renderComponent('mock-system');
    await waitFor(() => {
      expect(
        screen.getByTitle('All dependabot checks passed'),
      ).toBeInTheDocument();
    });
  });

  it('shows red when critical fails', async () => {
    (DependabotUtils as jest.Mock).mockImplementation(() => ({
      getDependabotChecks: jest
        .fn()
        .mockResolvedValueOnce({
          criticalAlertCheck: false,
          highAlertCheck: true,
          mediumAlertCheck: true,
        })
        .mockResolvedValueOnce({
          criticalAlertCheck: true,
          highAlertCheck: true,
          mediumAlertCheck: true,
        }),
    }));
    renderComponent('mock-system');
    await waitFor(() => {
      expect(
        screen.getByTitle(/Critical alerts exceed threshold/i),
      ).toBeInTheDocument();
    });
  });

  it('shows yellow when high fails but critical passes', async () => {
    (DependabotUtils as jest.Mock).mockImplementation(() => ({
      getDependabotChecks: jest
        .fn()
        .mockResolvedValueOnce({
          criticalAlertCheck: true,
          highAlertCheck: false,
          mediumAlertCheck: true,
        })
        .mockResolvedValueOnce({
          criticalAlertCheck: true,
          highAlertCheck: true,
          mediumAlertCheck: true,
        }),
    }));
    renderComponent('mock-system');
    await waitFor(() => {
      expect(
        screen.getByTitle(/minor critical issues in dependabot alerts/i),
      ).toBeInTheDocument();
    });
  });

  it('shows gray when check fails or throws error', async () => {
    (DependabotUtils as jest.Mock).mockImplementation(() => ({
      getDependabotChecks: jest.fn().mockRejectedValue(new Error('fail')),
    }));
    renderComponent('mock-system');
    await waitFor(() => {
      expect(
        screen.getByTitle('Error fetching dependabot data'),
      ).toBeInTheDocument();
    });
  });

  it('shows gray when getDependabotChecks returns undefined', async () => {
    (DependabotUtils as jest.Mock).mockImplementation(() => ({
      getDependabotChecks: jest.fn().mockResolvedValue(undefined),
    }));
    renderComponent('mock-system');
    await waitFor(() => {
      expect(
        screen.getByTitle('Error fetching dependabot data'),
      ).toBeInTheDocument();
    });
  });

  it('shows gray when no entities match the system name', async () => {
    const unmatchedEntities: Entity[] = mockEntities.map(e => ({
      ...e,
      spec: { system: 'nonexistent' },
    }));
    renderComponent('mock-system', unmatchedEntities);
    await waitFor(() => {
      expect(
        screen.getByTitle('No entities found for system: mock-system'),
      ).toBeInTheDocument();
    });
  });
});
