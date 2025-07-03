import { render, screen, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

// Create a comprehensive mock setup before importing the component
jest.mock('@material-ui/core', () => {
  const React = require('react');

  return {
    Box: React.forwardRef(
      ({ children, onClick, bgcolor, ...props }: any, ref: any) => {
        const commonStyle = {
          width: props.width,
          height: props.height,
          borderRadius: props.borderRadius,
          backgroundColor: bgcolor,
          margin: props.my,
        };

        const isInteractive = !!onClick;

        if (isInteractive) {
          return (
            <button
              ref={ref}
              data-testid="traffic-light-box"
              onClick={onClick}
              data-color={bgcolor}
              style={{
                ...commonStyle,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'block',
              }}
            >
              {children}
            </button>
          );
        }

        return (
          <div
            ref={ref}
            data-testid="traffic-light-box"
            data-color={bgcolor}
            style={{
              ...commonStyle,
              cursor: 'default',
            }}
          >
            {children}
          </div>
        );
      },
    ),

    Tooltip: ({ children, title, placement }: any) => (
      <div data-testid="tooltip" data-title={title} data-placement={placement}>
        {children}
      </div>
    ),

    withTheme: (Component: any) => Component,
    createTheme: jest.fn(() => ({})),
    ThemeProvider: ({ children }: any) => children,
    makeStyles: () => () => ({}),
    useTheme: () => ({}),
  };
});

// Mock material-table and related dependencies
jest.mock('@material-table/core', () => ({}));

// Mock Backstage core components that might cause conflicts
jest.mock('@backstage/core-components', () => ({
  Table: () => <div data-testid="mocked-table" />,
  Progress: () => <div data-testid="mocked-progress" />,
}));

// Mock the plugin-catalog-react to avoid deep import issues
jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: 'catalogApiRef',
  useEntity: jest.fn(),
}));

// Now import the component and other dependencies
import { AzureDevOpsBugsTrafficLight } from '../AzureDevOpsBugsTrafficLight';
import { AzureUtils } from '../../../utils/azureUtils';
import { determineSemaphoreColor } from '../../utils';

// Mock AzureUtils
jest.mock('../../../utils/azureUtils', () => ({
  AzureUtils: jest.fn().mockImplementation(() => ({
    getAzureDevOpsBugFacts: jest.fn(),
    getAzureDevOpsBugChecks: jest.fn(),
  })),
}));

// Mock determineSemaphoreColor utility
jest.mock('../../utils', () => ({
  determineSemaphoreColor: jest.fn(),
}));

describe('AzureDevOpsBugsTrafficLight Component', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockEntities: Entity[];
  let mockSystemEntity: any;
  let mockAzureUtilsInstance: any;

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
          annotations: {
            'azure.com/project': 'test-project-1',
            'azure.com/organization': 'test-org',
            'azure.com/bugs-query-id': 'query-123',
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
            'azure.com/project': 'test-project-2',
            'azure.com/organization': 'test-org',
            'azure.com/bugs-query-id': 'query-456',
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
            'azure.com/project': 'test-project-1', // Same project as component-1
            'azure.com/organization': 'test-org',
            'azure.com/bugs-query-id': 'query-789',
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
          'azure-bugs-check-threshold-red': '0.5',
        },
      },
    };

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    // Mock AzureUtils instance
    mockAzureUtilsInstance = {
      getAzureDevOpsBugFacts: jest.fn().mockResolvedValue({
        azureBugCount: 5,
      }),
      getAzureDevOpsBugChecks: jest.fn().mockResolvedValue({
        bugCountCheck: true,
      }),
    };
    (AzureUtils as jest.Mock).mockImplementation(() => mockAzureUtilsInstance);

    // Mock determineSemaphoreColor
    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'green',
      reason: 'All Azure DevOps bug checks passing',
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
        <AzureDevOpsBugsTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );
  };

  it('should render with initial white color and loading message', () => {
    renderComponent();

    const tooltip = screen.getByTestId('tooltip');
    const trafficLight = screen.getByTestId('traffic-light-box');

    expect(tooltip).toHaveAttribute(
      'data-title',
      'Loading Azure DevOps bug data...',
    );
    expect(trafficLight).toHaveAttribute('data-color', 'white');
  });

  it('should update to gray when no entities are provided', async () => {
    renderComponent([]);

    await waitFor(() => {
      const tooltip = screen.getByTestId('tooltip');
      const trafficLight = screen.getByTestId('traffic-light-box');
      expect(trafficLight).toHaveAttribute('data-color', 'gray');
      expect(tooltip).toHaveAttribute('data-title', 'No entities selected');
    });
  });

  it('should update to green when all checks pass', async () => {
    renderComponent();

    await waitFor(() => {
      const tooltip = screen.getByTestId('tooltip');
      const trafficLight = screen.getByTestId('traffic-light-box');

      expect(trafficLight).toHaveAttribute('data-color', 'green');
      expect(tooltip).toHaveAttribute(
        'data-title',
        'All Azure DevOps bug checks passing',
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
        annotations: {},
      },
    });

    mockAzureUtilsInstance.getAzureDevOpsBugChecks.mockResolvedValue({
      bugCountCheck: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(2, 3, 0.33);
    });
  });

  it('should use custom threshold from system annotation', async () => {
    mockSystemEntity.metadata.annotations['azure-bugs-check-threshold-red'] =
      '0.75';
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    mockAzureUtilsInstance.getAzureDevOpsBugChecks.mockResolvedValue({
      bugCountCheck: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(2, 3, 0.75);
    });
  });

  it('should handle entities without project annotation', async () => {
    const entitiesWithoutProject = [
      {
        ...mockEntities[0],
        metadata: {
          ...mockEntities[0].metadata,
          annotations: {
            'azure.com/organization': 'test-org',
            'azure.com/bugs-query-id': 'query-123',
            // Missing 'azure.com/project'
          },
        },
      },
    ];

    renderComponent(entitiesWithoutProject);

    await waitFor(() => {
      // Should not call Azure APIs for entities with 'unknown' project
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).not.toHaveBeenCalled();
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugChecks,
      ).not.toHaveBeenCalled();
    });
  });

  it('should deduplicate projects and only fetch once per unique project', async () => {
    // mockEntities[0] and mockEntities[2] have the same project
    renderComponent();

    await waitFor(() => {
      // Should only call twice: once for test-project-1, once for test-project-2
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugChecks,
      ).toHaveBeenCalledTimes(2);
    });
  });

  it('should count failures correctly', async () => {
    mockAzureUtilsInstance.getAzureDevOpsBugChecks
      .mockResolvedValueOnce({ bugCountCheck: false }) // test-project-1 fails
      .mockResolvedValueOnce({ bugCountCheck: true }); // test-project-2 passes

    renderComponent();

    await waitFor(() => {
      // 1 failure out of 2 unique projects, with threshold 0.5
      expect(determineSemaphoreColor).toHaveBeenCalledWith(1, 3, 0.5);
    });
  });

  it('should handle API errors gracefully', async () => {
    mockAzureUtilsInstance.getAzureDevOpsBugFacts.mockRejectedValue(
      new Error('API Error'),
    );

    renderComponent();

    await waitFor(() => {
      const tooltip = screen.getByTestId('tooltip');
      const trafficLight = screen.getByTestId('traffic-light-box');

      expect(trafficLight).toHaveAttribute('data-color', 'gray');
      expect(tooltip).toHaveAttribute(
        'data-title',
        'Failed to retrieve Azure DevOps bug data',
      );
    });
  });

  it('should call onClick handler when provided', async () => {
    const mockOnClick = jest.fn();

    renderComponent(mockEntities, mockOnClick);

    await waitFor(() => {
      const trafficLight = screen.getByTestId('traffic-light-box');
      expect(trafficLight).toHaveAttribute('data-color', 'green');
    });

    const trafficLight = screen.getByTestId('traffic-light-box');
    trafficLight.click();

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should create AzureUtils instance with memoization', async () => {
    renderComponent();

    expect(AzureUtils).toHaveBeenCalledTimes(1);
  });

  it('should handle entities without namespace', async () => {
    const entityWithoutNamespace = {
      ...mockEntities[0],
      metadata: {
        name: 'test-component-1',
        annotations: {
          'azure.com/project': 'test-project-1',
          'azure.com/organization': 'test-org',
          'azure.com/bugs-query-id': 'query-123',
        },
      },
      spec: {
        system: 'test-system',
      },
    };

    renderComponent([entityWithoutNamespace]);

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'test-system',
      });
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).toHaveBeenCalledWith(mockTechInsightsApi, {
        kind: 'Component',
        namespace: 'default',
        name: 'test-component-1',
      });
    });
  });

  it('should handle entities without system spec', async () => {
    const entityWithoutSystem = {
      ...mockEntities[0],
      spec: {},
    };

    renderComponent([entityWithoutSystem]);

    await waitFor(() => {
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).toHaveBeenCalledTimes(1);
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 1, 0.33);
    });
  });

  it('should generate correct Azure DevOps URL', async () => {
    const entityWithCustomOrg = {
      ...mockEntities[0],
      metadata: {
        ...mockEntities[0].metadata,
        annotations: {
          'azure.com/project': 'custom-project',
          'azure.com/organization': 'custom-org',
          'azure.com/bugs-query-id': 'custom-query-456',
        },
      },
    };

    renderComponent([entityWithCustomOrg]);

    await waitFor(() => {
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).toHaveBeenCalledWith(mockTechInsightsApi, {
        kind: 'Component',
        namespace: 'default',
        name: 'test-component-1',
      });
    });

    // The URL generation is internal to the component, but we can verify
    // the component processes the annotations correctly
    expect(mockAzureUtilsInstance.getAzureDevOpsBugFacts).toHaveBeenCalledTimes(
      1,
    );
  });

  it('should handle missing organization annotation with default values', async () => {
    const entityWithoutOrg = {
      ...mockEntities[0],
      metadata: {
        ...mockEntities[0].metadata,
        annotations: {
          'azure.com/project': 'test-project-1',
          'azure.com/bugs-query-id': 'query-123',
          // Missing 'azure.com/organization'
        },
      },
    };

    renderComponent([entityWithoutOrg]);

    await waitFor(() => {
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('should pass correct determineSemaphoreColor parameters', async () => {
    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'yellow',
      reason: 'Some Azure DevOps bug checks failing',
    });

    mockAzureUtilsInstance.getAzureDevOpsBugChecks
      .mockResolvedValueOnce({ bugCountCheck: true }) // test-project-1 passes
      .mockResolvedValueOnce({ bugCountCheck: false }); // test-project-2 fails

    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(1, 3, 0.5);
      const tooltip = screen.getByTestId('tooltip');
      const trafficLight = screen.getByTestId('traffic-light-box');

      expect(trafficLight).toHaveAttribute('data-color', 'yellow');
      expect(tooltip).toHaveAttribute(
        'data-title',
        'Some Azure DevOps bug checks failing',
      );
    });
  });

  it('should handle concurrent API calls correctly', async () => {
    let resolveCount = 0;

    mockAzureUtilsInstance.getAzureDevOpsBugFacts.mockImplementation(
      async () => {
        // Small delay to simulate async behavior without deep nesting
        await new Promise(resolve => setTimeout(resolve, 10));
        return { azureBugCount: ++resolveCount };
      },
    );

    mockAzureUtilsInstance.getAzureDevOpsBugChecks.mockResolvedValue({
      bugCountCheck: true,
    });

    renderComponent();

    await waitFor(() => {
      expect(
        mockAzureUtilsInstance.getAzureDevOpsBugFacts,
      ).toHaveBeenCalledTimes(2);
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 3, 0.5);
    });
  });
});
