import { render, screen, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  BlackDuckTrafficLight,
  determineBlackDuckColor,
} from '../BlackDuckTrafficLight';
import { BlackDuckUtils } from '../../../utils/blackDuckUtils';

// Mock the BaseTrafficLight component
jest.mock('../BaseTrafficLight', () => ({
  BaseTrafficLight: ({ color, tooltip, onClick }: any) => (
    <button
      type="button"
      data-testid="base-traffic-light"
      data-color={color}
      data-tooltip={tooltip}
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: '50%',
        width: '50px',
        height: '50px',
        backgroundColor: color ?? 'gray',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      Traffic Light: {color}
    </button>
  ),
}));

// Mock BlackDuckUtils
jest.mock('../../../utils/blackDuckUtils', () => ({
  BlackDuckUtils: jest.fn().mockImplementation(() => ({
    getBlackDuckChecks: jest.fn(),
  })),
}));

describe('determineBlackDuckColor', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockBlackDuckUtils: any;
  let mockEntities: Entity[];
  let mockSystemEntity: any;

  beforeEach(() => {
    mockCatalogApi = {
      getEntityByRef: jest.fn(),
    };

    mockTechInsightsApi = {};

    mockBlackDuckUtils = {
      getBlackDuckChecks: jest.fn(),
    };

    mockEntities = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-component-1',
          namespace: 'default',
          annotations: {
            'tech-insights.io/blackduck-enabled': 'true',
          },
        },
        spec: {
          system: 'test-system',
        },
      } as Entity,
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-component-2',
          namespace: 'default',
          annotations: {
            'tech-insights.io/blackduck-enabled': 'true',
          },
        },
        spec: {
          system: 'test-system',
        },
      } as Entity,
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-component-3',
          namespace: 'default',
          annotations: {
            'tech-insights.io/blackduck-enabled': 'true',
          },
        },
        spec: {
          system: 'test-system',
        },
      } as Entity,
    ];

    mockSystemEntity = {
      metadata: {
        annotations: {
          'tech-insights.io/blackduck-critical-check-percentage': '34',
        },
      },
    };

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return gray when no entities are provided', async () => {
    const result = await determineBlackDuckColor(
      [],
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('gray');
  });

  it('should return gray when no entities have BlackDuck enabled', async () => {
    const entitiesWithoutBlackDuck = [
      {
        ...mockEntities[0],
        metadata: {
          ...mockEntities[0].metadata,
          annotations: {},
        },
      },
    ];

    const result = await determineBlackDuckColor(
      entitiesWithoutBlackDuck,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('gray');
  });

  it('should return gray when system metadata is missing', async () => {
    const entitiesWithoutSystem = [
      {
        ...mockEntities[0],
        spec: {},
      },
    ];

    const result = await determineBlackDuckColor(
      entitiesWithoutSystem,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('gray');
  });

  it('should return green when all checks pass for all entities', async () => {
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('green');
  });

  it('should return red when critical security check fails', async () => {
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: false,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('red');
  });

  it('should return red when more than 1/3 of entities fail a check (default threshold)', async () => {
    // With 3 entities and 34% threshold, 2 failures should be red
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('red');
  });

  it('should return yellow when some checks fail but below critical threshold', async () => {
    // With 3 entities and 34% threshold, 1 failure should be yellow
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('yellow');
  });

  it('should use default threshold when system annotations are missing', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValue({
      metadata: { annotations: {} },
    });

    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });

    // Default threshold is 33% and 1 > 0.99 => should be red
    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('red');
  });

  it('should handle custom threshold values', async () => {
    // Set threshold to 50%
    mockCatalogApi.getEntityByRef.mockResolvedValue({
      metadata: {
        annotations: {
          'tech-insights.io/blackduck-critical-check-percentage': '50',
        },
      },
    });

    // With 3 entities and 50% threshold, 1 failure (33%) should be yellow
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('yellow');
  });

  it('should return red when multiple check types exceed threshold', async () => {
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: false,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: false,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: false,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('red');
  });

  it('should return gray on error fetching BlackDuck data', async () => {
    mockBlackDuckUtils.getBlackDuckChecks.mockRejectedValue(
      new Error('API Error'),
    );

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('gray');
  });

  it('should handle string system names', async () => {
    const entityWithStringSystem = {
      ...mockEntities[0],
      spec: {
        system: 'test-system',
      },
    };

    mockBlackDuckUtils.getBlackDuckChecks.mockResolvedValue({
      criticalSecurityCheck: true,
      highSecurityCheck: true,
      mediumSecurityCheck: true,
    });

    await determineBlackDuckColor(
      [entityWithStringSystem],
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
      kind: 'system',
      namespace: 'default',
      name: 'test-system',
    });
  });

  it('should handle mixed check results correctly', async () => {
    // Entity 1: all pass, Entity 2: medium fails, Entity 3: high fails
    mockBlackDuckUtils.getBlackDuckChecks
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: false,
      })
      .mockResolvedValueOnce({
        criticalSecurityCheck: true,
        highSecurityCheck: false,
        mediumSecurityCheck: true,
      });

    const result = await determineBlackDuckColor(
      mockEntities,
      mockCatalogApi,
      mockTechInsightsApi,
      mockBlackDuckUtils,
    );

    expect(result.color).toEqual('yellow');
  });
});

describe('BlackDuckTrafficLight Component', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockEntities: Entity[];

  beforeEach(() => {
    mockCatalogApi = {
      getEntityByRef: jest.fn().mockResolvedValue({
        metadata: {
          annotations: {
            'tech-insights.io/blackduck-critical-check-percentage': '34',
          },
        },
      }),
    };

    mockTechInsightsApi = {};

    mockEntities = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-component',
          namespace: 'default',
          annotations: {
            'tech-insights.io/blackduck-enabled': 'true',
          },
        },
        spec: {
          system: 'test-system',
        },
      } as Entity,
    ];

    // Mock BlackDuckUtils instance
    const mockBlackDuckUtilsInstance = {
      getBlackDuckChecks: jest.fn().mockResolvedValue({
        criticalSecurityCheck: true,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      }),
    };
    (BlackDuckUtils as jest.Mock).mockImplementation(
      () => mockBlackDuckUtilsInstance,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (
    entities: Entity[] = mockEntities,
    onClick?: () => void,
  ) => {
    return render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <BlackDuckTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );
  };

  it('should update to green when all checks pass', async () => {
    renderComponent();

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'green');
    });
  });

  it('should update to red when critical security check fails', async () => {
    const mockBlackDuckUtilsInstance = {
      getBlackDuckChecks: jest.fn().mockResolvedValue({
        criticalSecurityCheck: false,
        highSecurityCheck: true,
        mediumSecurityCheck: true,
      }),
    };
    (BlackDuckUtils as jest.Mock).mockImplementation(
      () => mockBlackDuckUtilsInstance,
    );

    renderComponent();
    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'red');
    });
  });

  it('should handle empty entities array', async () => {
    renderComponent([]);

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
    });
  });

  it('should handle entities without BlackDuck enabled', async () => {
    const entitiesWithoutBlackDuck = [
      {
        ...mockEntities[0],
        metadata: {
          ...mockEntities[0].metadata,
          annotations: {},
        },
      },
    ];

    renderComponent(entitiesWithoutBlackDuck);

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
    });
  });

  it('should handle API errors gracefully', async () => {
    const mockBlackDuckUtilsInstance = {
      getBlackDuckChecks: jest.fn().mockRejectedValue(new Error('API Error')),
    };
    (BlackDuckUtils as jest.Mock).mockImplementation(
      () => mockBlackDuckUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
    });
  });

  it('should call onClick handler when provided', async () => {
    const mockOnClick = jest.fn();
    renderComponent(mockEntities, mockOnClick);

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'green');
    });

    const trafficLight = screen.getByTestId('base-traffic-light');

    trafficLight.click();

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch data when entities prop changes', async () => {
    const component: ReturnType<typeof render> = renderComponent();

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'green');
    });

    // Change entities
    const newEntities = [
      {
        ...mockEntities[0],
        metadata: {
          ...mockEntities[0].metadata,
          name: 'different-component',
        },
      },
    ];

    component.rerender(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <BlackDuckTrafficLight entities={newEntities} />
      </TestApiProvider>,
    );

    // Should update with new data
    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'green');
    });
  });

  it('should create BlackDuckUtils instance with memoization', async () => {
    renderComponent();

    expect(BlackDuckUtils).toHaveBeenCalledTimes(1);
  });

  it('should handle entities without system metadata', async () => {
    const entitiesWithoutSystem = [
      {
        ...mockEntities[0],
        spec: {},
      },
    ];
    renderComponent(entitiesWithoutSystem);

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
    });
  });
});
