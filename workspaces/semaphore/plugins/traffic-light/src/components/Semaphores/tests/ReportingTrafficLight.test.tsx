import { render, screen, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ReportingTrafficLight } from '../ReportingTrafficLight';
import { determineSemaphoreColor } from '../../utils';
import { ReportingUtils } from '../../../utils/reportingUtils';

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

// Mock ReportingUtils
jest.mock('../../../utils/reportingUtils', () => ({
  ReportingUtils: jest.fn().mockImplementation(() => ({
    getReportingPipelineChecks: jest.fn(),
  })),
}));

// Mock determineSemaphoreColor utility
jest.mock('../../utils', () => ({
  determineSemaphoreColor: jest.fn(),
}));

describe('ReportingTrafficLight Component', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockReportingUtils: any;
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
          name: 'test-1',
          namespace: 'default',
        },
        spec: {
          system: 'my-system',
        },
      },
    ];

    mockSystemEntity = {
      metadata: {
        annotations: {
          'reporting-check-threshold-red': '0.5',
        },
      },
    };

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    (ReportingUtils as jest.Mock).mockImplementation(() => {
      mockReportingUtils = {
        getReportingPipelineChecks: jest.fn().mockResolvedValue({
          successRateCheck: true,
        }),
      };
      return mockReportingUtils;
    });

    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'green',
      reason: 'All reporting checks passed',
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
        <ReportingTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );
  };

  it('renders with initial white color and loading message', () => {
    renderComponent();
    const light = screen.getByTestId('base-traffic-light');
    expect(light).toHaveAttribute('data-color', 'white');
    expect(light).toHaveAttribute(
      'data-tooltip',
      'Loading Reporting pipeline data...',
    );
  });

  it('sets gray when no entities are passed', async () => {
    renderComponent([]);
    await waitFor(() => {
      const light = screen.getByTestId('base-traffic-light');
      expect(light).toHaveAttribute('data-color', 'gray');
      expect(light).toHaveAttribute('data-tooltip', 'No entities selected');
    });
  });

  it('fetches system entity and passes custom threshold', async () => {
    renderComponent();
    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'my-system',
      });
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 1, 0.5);
    });
  });

  it('uses default threshold when annotation is missing', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValueOnce({ metadata: {} });
    renderComponent();
    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 1, 0.33);
    });
  });

  it('counts failures correctly and sets traffic light', async () => {
    mockReportingUtils.getReportingPipelineChecks.mockResolvedValueOnce({
      successRateCheck: false,
    });
    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'red',
      reason: 'Reporting failures detected',
    });

    renderComponent();

    await waitFor(() => {
      const light = screen.getByTestId('base-traffic-light');
      expect(light).toHaveAttribute('data-color', 'red');
      expect(light).toHaveAttribute(
        'data-tooltip',
        'Reporting failures detected',
      );
    });
  });

  it('calls onClick when traffic light is clicked', async () => {
    const onClick = jest.fn();
    renderComponent(mockEntities, onClick);

    const light = await screen.findByTestId('base-traffic-light');
    light.click();

    expect(onClick).toHaveBeenCalled();
  });
});
