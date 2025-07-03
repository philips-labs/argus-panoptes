import { render, screen, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { FoundationTrafficLight } from '../FoundationTrafficLight';
import { determineSemaphoreColor } from '../../utils';
import { FoundationUtils } from '../../../utils/foundationUtils';

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

jest.mock('../../../utils/foundationUtils', () => ({
  FoundationUtils: jest.fn().mockImplementation(() => ({
    getFoundationPipelineChecks: jest.fn(),
  })),
}));

jest.mock('../../utils', () => ({
  determineSemaphoreColor: jest.fn(),
}));

describe('FoundationTrafficLight', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockFoundationUtils: any;
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
          name: 'test-service',
          namespace: 'default',
        },
        spec: {
          system: 'some-system',
        },
      },
    ];

    mockSystemEntity = {
      metadata: {
        annotations: {
          'foundation-check-threshold-red': '0.5',
          'foundation-configured-repositories': 'test-service',
        },
      },
    };

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);

    mockFoundationUtils = {
      getFoundationPipelineChecks: jest.fn().mockResolvedValue({
        successRateCheck: true,
      }),
    };

    (FoundationUtils as jest.Mock).mockImplementation(
      () => mockFoundationUtils,
    );

    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'green',
      reason: 'All foundation checks passed',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (entities = mockEntities, onClick?: () => void) =>
    render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <FoundationTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );

  it('shows initial loading state', () => {
    renderComponent();
    const light = screen.getByTestId('base-traffic-light');
    expect(light).toHaveAttribute('data-color', 'white');
    expect(light).toHaveAttribute(
      'data-tooltip',
      'Loading Foundation pipeline data...',
    );
  });

  it('handles empty entities', async () => {
    renderComponent([]);
    await waitFor(() => {
      const light = screen.getByTestId('base-traffic-light');
      expect(light).toHaveAttribute('data-color', 'gray');
      expect(light).toHaveAttribute('data-tooltip', 'No entities selected');
    });
  });

  it('uses system annotation threshold and configured repos', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'some-system',
      });

      expect(
        mockFoundationUtils.getFoundationPipelineChecks,
      ).toHaveBeenCalledWith(mockTechInsightsApi, {
        kind: 'Component',
        namespace: 'default',
        name: 'test-service',
      });

      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 1, 0.5);
    });
  });

  it('falls back to default threshold when not present', async () => {
    mockCatalogApi.getEntityByRef.mockResolvedValueOnce({
      metadata: { annotations: {} },
    });
    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(0, 1, 0.33);
    });
  });

  it('filters entities by configured repositories', async () => {
    mockEntities.push({
      ...mockEntities[0],
      metadata: { name: 'not-configured', namespace: 'default' },
    });

    renderComponent(mockEntities);

    await waitFor(() => {
      expect(
        mockFoundationUtils.getFoundationPipelineChecks,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockFoundationUtils.getFoundationPipelineChecks,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'test-service' }),
      );
    });
  });

  it('uses all entities when no configured repos annotation is present', async () => {
    delete mockSystemEntity.metadata.annotations[
      'foundation-configured-repositories'
    ];

    renderComponent();

    await waitFor(() => {
      expect(
        mockFoundationUtils.getFoundationPipelineChecks,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('shows gray when no configured repos match entities', async () => {
    mockSystemEntity.metadata.annotations[
      'foundation-configured-repositories'
    ] = 'nonexistent';

    renderComponent();
    await waitFor(() => {
      const light = screen.getByTestId('base-traffic-light');
      expect(light).toHaveAttribute('data-color', 'gray');
      expect(light).toHaveAttribute(
        'data-tooltip',
        'No configured repositories found for foundation checks',
      );
    });
  });

  it('handles API failure gracefully', async () => {
    mockFoundationUtils.getFoundationPipelineChecks.mockRejectedValue(
      new Error('Failure'),
    );

    renderComponent();

    await waitFor(() => {
      const light = screen.getByTestId('base-traffic-light');
      expect(light).toHaveAttribute('data-color', 'gray');
      expect(light).toHaveAttribute(
        'data-tooltip',
        'Error fetching foundation pipeline data',
      );
    });
  });

  it('handles click event if onClick is provided', async () => {
    const onClick = jest.fn();

    renderComponent(mockEntities, onClick);

    const light = await screen.findByTestId('base-traffic-light');

    light.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('counts failures correctly', async () => {
    mockFoundationUtils.getFoundationPipelineChecks.mockResolvedValueOnce({
      successRateCheck: false,
    });
    (determineSemaphoreColor as jest.Mock).mockReturnValue({
      color: 'red',
      reason: 'Many failures',
    });

    renderComponent();

    await waitFor(() => {
      expect(determineSemaphoreColor).toHaveBeenCalledWith(1, 1, 0.5);
      const light = screen.getByTestId('base-traffic-light');
      expect(light).toHaveAttribute('data-color', 'red');
      expect(light).toHaveAttribute('data-tooltip', 'Many failures');
    });
  });
});
