import { render, screen, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { PreproductionTrafficLight } from '../PreproductionTrafficLight';
import { PreproductionUtils } from '../../../utils/preproductionUtils';
import { determineSemaphoreColor } from '../../utils';

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

// Mock PreproductionUtils
jest.mock('../../../utils/preproductionUtils', () => ({
  PreproductionUtils: jest.fn().mockImplementation(() => ({
    getPreproductionPipelineChecks: jest.fn(),
  })),
}));

// Mock determineSemaphoreColor utility
jest.mock('../../utils', () => ({
  determineSemaphoreColor: jest.fn(),
}));

describe('PreproductionTrafficLight Component', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockEntities: Entity[];
  let mockSystemEntity: any;

  beforeEach(() => {
    mockCatalogApi = {
      getEntityByRef: jest.fn(),
    };

    mockTechInsightsApi = {};

    mockEntities = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'test-component-1',
          namespace: 'default',
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
        },
        spec: {
          system: 'test-system',
        },
      } as Entity,
    ];

    mockSystemEntity = {
      metadata: {
        annotations: {
          'preproduction-check-threshold-red': '0.33',
          'preproduction-configured-repositories':
            'test-component-1,test-component-2,test-component-3',
        },
      },
    };

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    // Mock PreproductionUtils instance
    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    // Mock determineSemaphoreColor
    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'green',
      reason: 'All preproduction pipeline checks passing',
    });
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
        <PreproductionTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );
  };

  it('should render with initial white color and loading message', () => {
    renderComponent();

    const trafficLight = screen.getByTestId('base-traffic-light');
    expect(trafficLight).toHaveAttribute('data-color', 'white');
    expect(trafficLight).toHaveAttribute(
      'data-tooltip',
      'Loading Preproduction pipeline data...',
    );
  });

  it('should update to gray when no entities are provided', async () => {
    renderComponent([]);

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
      expect(trafficLight).toHaveAttribute(
        'data-tooltip',
        'No entities selected',
      );
    });
  });

  it('should update to green when all checks pass', async () => {
    renderComponent();

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'green');
      expect(trafficLight).toHaveAttribute(
        'data-tooltip',
        'All preproduction pipeline checks passing',
      );
    });
  });

  it('should fetch system entity with correct parameters', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'test-system',
      });
    });
  });

  it('should handle string system names correctly', async () => {
    const entityWithStringSystem = {
      ...mockEntities[0],
      spec: {
        system: 'string-system-name',
      },
    };

    renderComponent([entityWithStringSystem]);

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'string-system-name',
      });
    });
  });

  it('should handle non-string system names correctly', async () => {
    const entityWithNonStringSystem = {
      ...mockEntities[0],
      spec: {
        system: { name: 'object-system-name' },
      },
    };

    renderComponent([entityWithNonStringSystem]);

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: '[object Object]',
      });
    });
  });

  it('should use default threshold when system annotation is missing', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValue({
      metadata: {
        annotations: {
          'preproduction-configured-repositories':
            'test-component-1,test-component-2,test-component-3',
        },
      },
    });

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: false,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );
    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(3, 3, 0.33);
    });
  });

  it('should use custom threshold from system annotation', async () => {
    mockSystemEntity.metadata.annotations['preproduction-check-threshold-red'] =
      '0.5';
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: false,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();
    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(3, 3, 0.5);
    });
  });

  it('should filter entities based on configured repositories', async () => {
    mockSystemEntity.metadata.annotations[
      'preproduction-configured-repositories'
    ] = 'test-component-1,test-component-3';
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledWith(mockTechInsightsApi, {
        kind: 'Component',
        namespace: 'default',
        name: 'test-component-1',
      });
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledWith(mockTechInsightsApi, {
        kind: 'Component',
        namespace: 'default',
        name: 'test-component-3',
      });
    });
  });

  it('should use all entities when no configured repositories are specified', async () => {
    mockSystemEntity.metadata.annotations = {
      'preproduction-check-threshold-red': '0.33',
    };
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledTimes(3);
    });
  });

  it('should handle empty configured repositories list', async () => {
    mockSystemEntity.metadata.annotations[
      'preproduction-configured-repositories'
    ] = '  ,  ,  ';
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledTimes(3);
    });
  });

  it('should return gray when no configured repositories match entities', async () => {
    mockSystemEntity.metadata.annotations[
      'preproduction-configured-repositories'
    ] = 'non-existent-repo-1,non-existent-repo-2';
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    renderComponent();

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
      expect(trafficLight).toHaveAttribute(
        'data-tooltip',
        'No configured repositories found for preproduction checks',
      );
    });
  });

  it('should proceed with default values when system entity fetch fails', async () => {
    mockCatalogApi.getEntityByRef.mockRejectedValue(
      new Error('System entity not found'),
    );

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledTimes(3);
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 3, 0.33);
    });
  });

  it('should handle entities without system spec', async () => {
    const entitiesWithoutSystem = [
      {
        ...mockEntities[0],
        spec: {},
      },
    ];

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent(entitiesWithoutSystem);
    await waitFor(() => {
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledTimes(1);
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 1, 0.33);
    });
  });

  it('should handle entities without namespace', async () => {
    const entitiesWithoutNamespace = [
      {
        ...mockEntities[0],
        metadata: {
          name: 'test-component-1',
        },
        spec: {
          system: 'test-system',
        },
      },
    ];

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent(entitiesWithoutNamespace);

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'test-system',
      });
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledWith(mockTechInsightsApi, {
        kind: 'Component',
        namespace: 'default',
        name: 'test-component-1',
      });
    });
  });

  it('should count failures correctly', async () => {
    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest
        .fn()
        .mockResolvedValueOnce({ successRateCheck: false })
        .mockResolvedValueOnce({ successRateCheck: true })
        .mockResolvedValueOnce({ successRateCheck: false }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(2, 3, 0.33);
    });
  });

  it('should handle API errors gracefully', async () => {
    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest
        .fn()
        .mockRejectedValue(new Error('API Error')),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
      expect(trafficLight).toHaveAttribute(
        'data-tooltip',
        'Error fetching preproduction pipeline data',
      );
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

  it('should create PreproductionUtils instance with memoization', async () => {
    renderComponent();

    expect(PreproductionUtils).toHaveBeenCalledTimes(1);
  });

  it('should handle whitespace in configured repositories annotation', async () => {
    mockSystemEntity.metadata.annotations[
      'preproduction-configured-repositories'
    ] = ' test-component-1 , test-component-2 , test-component-3 ';
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(
        mockPreproductionUtilsInstance.getPreproductionPipelineChecks,
      ).toHaveBeenCalledTimes(3);
    });
  });

  it('should pass correct determineSemaphoreColor parameters for different scenarios', async () => {
    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'yellow',
      reason: 'Some checks failing',
    });

    const mockPreproductionUtilsInstance = {
      getPreproductionPipelineChecks: jest
        .fn()
        .mockResolvedValueOnce({ successRateCheck: true })
        .mockResolvedValueOnce({ successRateCheck: false })
        .mockResolvedValueOnce({ successRateCheck: true }),
    };
    (PreproductionUtils as jest.Mock).mockImplementation(
      () => mockPreproductionUtilsInstance,
    );

    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(1, 3, 0.33);
      const trafficLight = screen.getByTestId('base-traffic-light');
      expect(trafficLight).toHaveAttribute('data-color', 'yellow');
      expect(trafficLight).toHaveAttribute(
        'data-tooltip',
        'Some checks failing',
      );
    });
  });
});
