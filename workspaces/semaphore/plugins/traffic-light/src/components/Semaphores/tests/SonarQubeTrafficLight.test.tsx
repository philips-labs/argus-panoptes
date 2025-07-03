import { render, screen, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  SonarQubeTrafficLight,
  determineSonarQubeColor,
} from '../SonarQubeTrafficLight';
import { SonarCloudUtils } from '../../../utils/sonarCloudUtils';

// Mock BaseTrafficLight
jest.mock('../BaseTrafficLight', () => ({
  BaseTrafficLight: ({ color, tooltip, onClick }: any) => (
    <button
      data-testid="base-traffic-light"
      data-color={color}
      data-tooltip={tooltip}
      onClick={onClick}
    >
      Light: {color}
    </button>
  ),
}));

// Mock SonarCloudUtils
jest.mock('../../../utils/sonarCloudUtils', () => ({
  SonarCloudUtils: jest.fn().mockImplementation(() => ({
    getSonarQubeFacts: jest.fn(),
  })),
}));

const mockSystemEntity = {
  metadata: {
    annotations: {
      'tech-insights.io/sonarcloud-quality-gate-red-threshold-percentage': '50',
      'tech-insights.io/sonarcloud-quality-gate-yellow-threshold-percentage':
        '25',
    },
  },
};

describe('determineSonarQubeColor', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockSonarUtils: any;
  let entities: Entity[];

  beforeEach(() => {
    entities = [
      {
        apiVersion: 'v1',
        kind: 'Component',
        metadata: {
          name: 'comp1',
          namespace: 'default',
          annotations: { 'sonarcloud.io/enabled': 'true' },
        },
        spec: { system: 'test-system' },
      },
      {
        apiVersion: 'v1',
        kind: 'Component',
        metadata: {
          name: 'comp2',
          namespace: 'default',
          annotations: { 'sonarcloud.io/enabled': 'true' },
        },
        spec: { system: 'test-system' },
      },
    ];

    mockCatalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue(mockSystemEntity),
    };

    mockTechInsightsApi = {};
    mockSonarUtils = {
      getSonarQubeFacts: jest.fn(),
    };
  });

  it('returns gray if no entities are provided', async () => {
    const result = await determineSonarQubeColor(
      [],
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('gray');
    expect(result.reason).toMatch(/No entities selected/);
  });

  it('returns gray if no enabled entities', async () => {
    const disabled = [
      {
        ...entities[0],
        metadata: { ...entities[0].metadata, annotations: {} },
      },
    ];
    const result = await determineSonarQubeColor(
      disabled,
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('gray');
    expect(result.reason).toMatch(/No entities have SonarQube enabled/);
  });

  it('returns gray if system metadata is missing', async () => {
    const noSystem = [{ ...entities[0], spec: {} }];
    const result = await determineSonarQubeColor(
      noSystem,
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('gray');
    expect(result.reason).toMatch(/System metadata is missing/);
  });

  it('returns green if all pass', async () => {
    mockSonarUtils.getSonarQubeFacts.mockResolvedValue({ quality_gate: 'OK' });
    const result = await determineSonarQubeColor(
      entities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('green');
  });

  it('returns yellow if failures fall between thresholds (e.g. 25%)', async () => {
    const fourEntities = [
      ...entities,
      {
        ...entities[0],
        metadata: { ...entities[0].metadata, name: 'comp3' },
      },
      {
        ...entities[0],
        metadata: { ...entities[0].metadata, name: 'comp4' },
      },
    ];

    mockSonarUtils.getSonarQubeFacts
      .mockResolvedValueOnce({ quality_gate: 'ERROR' }) // 1 fail
      .mockResolvedValueOnce({ quality_gate: 'OK' })
      .mockResolvedValueOnce({ quality_gate: 'OK' })
      .mockResolvedValueOnce({ quality_gate: 'OK' });

    const result = await determineSonarQubeColor(
      fourEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('yellow');
  });

  it('returns red if failures hit red threshold', async () => {
    mockSonarUtils.getSonarQubeFacts
      .mockResolvedValueOnce({ quality_gate: 'ERROR' }) // 50%
      .mockResolvedValueOnce({ quality_gate: 'OK' });

    const result = await determineSonarQubeColor(
      entities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('red');
  });

  it('returns gray on error', async () => {
    mockSonarUtils.getSonarQubeFacts.mockRejectedValue(new Error('oops'));
    const result = await determineSonarQubeColor(
      entities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockSonarUtils,
    );
    expect(result.color).toBe('gray');
  });
});

describe('SonarQubeTrafficLight component', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockEntities: Entity[];

  beforeEach(() => {
    mockEntities = [
      {
        apiVersion: 'v1',
        kind: 'Component',
        metadata: {
          name: 'comp1',
          namespace: 'default',
          annotations: { 'sonarcloud.io/enabled': 'true' },
        },
        spec: { system: 'test-system' },
      },
    ];

    mockCatalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue(mockSystemEntity),
    };

    mockTechInsightsApi = {};

    const mockInstance = {
      getSonarQubeFacts: jest.fn().mockResolvedValue({ quality_gate: 'OK' }),
    };
    (SonarCloudUtils as jest.Mock).mockImplementation(() => mockInstance);
  });

  const renderComponent = (entities = mockEntities, onClick?: () => void) => {
    return render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );
  };

  it('renders green traffic light when quality gates pass', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('base-traffic-light')).toHaveAttribute(
        'data-color',
        'green',
      );
    });
  });

  it('renders gray for empty entity list', async () => {
    renderComponent([]);

    await waitFor(() => {
      expect(screen.getByTestId('base-traffic-light')).toHaveAttribute(
        'data-color',
        'gray',
      );
    });
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();

    renderComponent(mockEntities, onClick);

    const light = await screen.findByTestId('base-traffic-light');
    light.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('re-fetches on entity prop change', async () => {
    const { rerender } = render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeTrafficLight entities={mockEntities} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('base-traffic-light')).toHaveAttribute(
        'data-color',
        'green',
      );
    });

    const newEntities = [
      {
        ...mockEntities[0],
        metadata: { ...mockEntities[0].metadata, name: 'comp2' },
      },
    ];

    rerender(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <SonarQubeTrafficLight entities={newEntities} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('base-traffic-light')).toBeInTheDocument();
    });
  });
});
