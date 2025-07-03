import { render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { SonarQubeSemaphoreDialog } from '../SonarQubeDialog';
import { Entity } from '@backstage/catalog-model';
import { determineSonarQubeColor } from '../../Semaphores/SonarQubeTrafficLight';

const mockSonarUtils = {
  getSonarQubeFacts: jest.fn(),
  getTop5CriticalSonarCloudRepos: jest.fn(),
};

jest.mock('../../../utils/sonarCloudUtils', () => ({
  SonarCloudUtils: jest.fn(() => mockSonarUtils),
}));

jest.mock('../../Semaphores/SonarQubeTrafficLight', () => ({
  determineSonarQubeColor: jest.fn(),
}));

jest.mock('../BaseSemaphoreDialogs', () => ({
  BaseSemaphoreDialog: ({ data }: any) => (
    <div
      data-testid="base-dialog"
      data-color={data.color}
      data-summary={data.summary}
    />
  ),
}));

describe('SonarQubeSemaphoreDialog', () => {
  const mockCatalogApi = {
    getEntityByRef: jest.fn().mockResolvedValue({
      metadata: {
        annotations: { 'sonarcloud.io/project-key': 'my-service-key' },
      },
    }),
  };

  const mockTechInsightsApi = {};
  const mockEntities: Entity[] = [
    {
      apiVersion: 'v1',
      kind: 'Component',
      metadata: {
        name: 'my-service',
        namespace: 'default',
        annotations: {
          'sonarcloud.io/enabled': 'true',
          'sonarcloud.io/project-key': 'my-service-key',
        },
      },
      spec: { system: 'my-system' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders green when no issues found', async () => {
    mockSonarUtils.getSonarQubeFacts.mockResolvedValue({
      bugs: 0,
      code_smells: 0,
      vulnerabilities: 0,
      code_coverage: 90,
      quality_gate: 'OK',
    });
    mockSonarUtils.getTop5CriticalSonarCloudRepos.mockResolvedValue([]);
    (determineSonarQubeColor as jest.Mock).mockResolvedValueOnce({
      color: 'green',
    });

    render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeSemaphoreDialog
          open
          onClose={() => {}}
          entities={mockEntities}
        />
      </TestApiProvider>,
    );

    await waitFor(() => {
      const dialog = screen.getByTestId('base-dialog');
      expect(dialog).toHaveAttribute('data-color', 'green');
    });
  });

  it('renders red when quality gate fails', async () => {
    mockSonarUtils.getSonarQubeFacts.mockResolvedValue({
      bugs: 0,
      code_smells: 0,
      vulnerabilities: 0,
      code_coverage: 90,
      quality_gate: 'ERROR',
    });
    mockSonarUtils.getTop5CriticalSonarCloudRepos.mockResolvedValue([
      {
        entity: { name: 'my-service' },
        quality_gate: 1,
        bugs: 0,
        vulnerabilities: 0,
        code_smells: 0,
        code_coverage: 90,
      },
    ]);
    (determineSonarQubeColor as jest.Mock).mockResolvedValueOnce({
      color: 'red',
    });

    render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeSemaphoreDialog
          open
          onClose={() => {}}
          entities={mockEntities}
        />
      </TestApiProvider>,
    );

    await waitFor(() => {
      const dialog = screen.getByTestId('base-dialog');
      expect(dialog).toHaveAttribute('data-color', 'red');
    });
  });

  it('renders gray and error summary on fetch error', async () => {
    mockSonarUtils.getSonarQubeFacts.mockRejectedValue(
      new Error('fetch failed'),
    );

    render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeSemaphoreDialog
          open
          onClose={() => {}}
          entities={mockEntities}
        />
      </TestApiProvider>,
    );

    await waitFor(() => {
      const dialog = screen.getByTestId('base-dialog');
      expect(dialog).toHaveAttribute('data-color', 'gray');
      expect(dialog.getAttribute('data-summary')).toMatch(
        /Failed to load SonarQube data/,
      );
    });
  });

  it('renders gray when no enabled entities', async () => {
    const disabledEntities = [
      {
        ...mockEntities[0],
        metadata: {
          ...mockEntities[0].metadata,
          annotations: {},
        },
      },
    ];

    render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeSemaphoreDialog
          open
          onClose={() => {}}
          entities={disabledEntities}
        />
      </TestApiProvider>,
    );

    await waitFor(() => {
      const dialog = screen.getByTestId('base-dialog');
      expect(dialog).toHaveAttribute('data-color', 'gray');
      expect(dialog.getAttribute('data-summary')).toMatch(
        /No repositories found with SonarQube enabled/,
      );
    });
  });

  it('does not fetch data when closed', async () => {
    mockSonarUtils.getSonarQubeFacts.mockClear();

    render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeSemaphoreDialog
          open={false}
          onClose={() => {}}
          entities={mockEntities}
        />
      </TestApiProvider>,
    );

    expect(mockSonarUtils.getSonarQubeFacts).not.toHaveBeenCalled();
  });
});
