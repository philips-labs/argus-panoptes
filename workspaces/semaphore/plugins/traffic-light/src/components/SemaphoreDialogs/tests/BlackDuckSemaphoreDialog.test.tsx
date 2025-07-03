import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiRegistry } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ApiProvider } from '@backstage/core-app-api';
import { BlackDuckSemaphoreDialog } from '../BlackDuckSemaphoreDialog';
import { BlackDuckUtils } from '../../../utils/blackDuckUtils';
import { determineBlackDuckColor } from '../../Semaphores/BlackDuckTrafficLight';
import { Entity } from '@backstage/catalog-model';

// Mock the utility modules
jest.mock('../../../utils/blackDuckUtils');
jest.mock('../../Semaphores/BlackDuckTrafficLight');

// Mock the BaseSemaphoreDialog component
jest.mock('../BaseSemaphoreDialogs', () => ({
  BaseSemaphoreDialog: ({
    open,
    onClose,
    title,
    data,
    isLoading,
    renderMetrics,
  }: any) => (
    <div data-testid="base-semaphore-dialog">
      <div data-testid="dialog-title">{title}</div>
      <div data-testid="dialog-open">{open.toString()}</div>
      <div data-testid="dialog-loading">{isLoading.toString()}</div>
      <div data-testid="dialog-color">{data.color}</div>
      <div data-testid="dialog-summary">{data.summary}</div>
      <div data-testid="dialog-details-count">{data.details.length}</div>
      {renderMetrics && (
        <div data-testid="rendered-metrics">{renderMetrics()}</div>
      )}
      <button data-testid="close-button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

const mockTechInsightsApi = {
  getFacts: jest.fn(),
};

const mockCatalogApi = {
  getEntities: jest.fn(),
  getEntityByRef: jest.fn(),
};

const mockBlackDuckUtils = {
  getBlackDuckFacts: jest.fn(),
  getTop5CriticalBlackDuckRepos: jest.fn(),
};

const MockedBlackDuckUtils = BlackDuckUtils as jest.MockedClass<
  typeof BlackDuckUtils
>;
const mockedDetermineBlackDuckColor =
  determineBlackDuckColor as jest.MockedFunction<
    typeof determineBlackDuckColor
  >;

// Test data
const mockEntity: Entity = {
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
    type: 'service',
  },
};

const mockEntityWithoutBlackDuck: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-component-no-bd',
    namespace: 'default',
  },
  spec: {
    type: 'service',
  },
};

const mockBlackDuckFacts = {
  security_risks_critical: 5,
  security_risks_high: 10,
  security_risks_medium: 15,
};

const mockTop5Repos = [
  {
    entity: mockEntity,
    security_risks_critical: 5,
    security_risks_high: 0,
    security_risks_medium: 0,
  },
  {
    entity: {
      ...mockEntity,
      metadata: { ...mockEntity.metadata, name: 'repo-2' },
    },
    security_risks_critical: 0,
    security_risks_high: 8,
    security_risks_medium: 0,
  },
];

const theme = createTheme();

const createWrapper = () => {
  const apis = TestApiRegistry.from(
    [techInsightsApiRef, mockTechInsightsApi],
    [catalogApiRef, mockCatalogApi],
  );

  return ({ children }: { children: React.ReactNode }) => (
    <ApiProvider apis={apis}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ApiProvider>
  );
};

describe('BlackDuckSemaphoreDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup BlackDuckUtils mock
    MockedBlackDuckUtils.mockImplementation(() => mockBlackDuckUtils as any);

    // Default mock implementations
    mockBlackDuckUtils.getBlackDuckFacts.mockResolvedValue(mockBlackDuckFacts);
    mockBlackDuckUtils.getTop5CriticalBlackDuckRepos.mockResolvedValue(
      mockTop5Repos,
    );
    mockedDetermineBlackDuckColor.mockResolvedValue({
      color: 'red',
      reason: 'Critical security risks found.',
    });
  });

  describe('Initial State', () => {
    it('renders with default props when dialog is closed', () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog open={false} onClose={mockOnClose} />
        </Wrapper>,
      );

      expect(screen.getByTestId('dialog-open')).toHaveTextContent('false');
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('BlackDuck');
    });
  });

  describe('Data Fetching', () => {
    it('fetches BlackDuck data when dialog opens with entities', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockBlackDuckUtils.getBlackDuckFacts).toHaveBeenCalledWith(
          mockTechInsightsApi,
          {
            kind: 'Component',
            namespace: 'default',
            name: 'test-component',
          },
        );
      });
    });

    it('filters entities to only those with BlackDuck enabled', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();
      const entities = [mockEntity, mockEntityWithoutBlackDuck];

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={entities}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockBlackDuckUtils.getBlackDuckFacts).toHaveBeenCalledTimes(1);
        expect(mockBlackDuckUtils.getBlackDuckFacts).toHaveBeenCalledWith(
          mockTechInsightsApi,
          expect.objectContaining({ name: 'test-component' }),
        );
      });
    });

    it('handles case when no entities have BlackDuck enabled', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntityWithoutBlackDuck]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
      });
    });

    it('handles API errors gracefully', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      mockBlackDuckUtils.getBlackDuckFacts.mockRejectedValue(
        new Error('API Error'),
      );

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
      });
    });
  });

  describe('Data Processing', () => {
    it('correctly aggregates security risk totals', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      const multipleEntities = [
        mockEntity,
        {
          ...mockEntity,
          metadata: { ...mockEntity.metadata, name: 'entity-2' },
        },
      ];
      mockBlackDuckUtils.getBlackDuckFacts
        .mockResolvedValueOnce(mockBlackDuckFacts)
        .mockResolvedValueOnce({
          security_risks_critical: 3,
          security_risks_high: 7,
          security_risks_medium: 12,
        });

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={multipleEntities}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-loading')).toHaveTextContent('false');
      });

      // Check if metrics are displayed correctly
      const metricsContainer = screen.getByTestId('rendered-metrics');
      expect(metricsContainer).toHaveTextContent('8'); // 5 + 3 critical
      expect(metricsContainer).toHaveTextContent('17'); // 10 + 7 high
      expect(metricsContainer).toHaveTextContent('27'); // 15 + 12 medium
    });

    it('creates correct issue details for critical risks', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '2',
        );
      });
    });

    it('determines correct color based on traffic light logic', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      mockedDetermineBlackDuckColor.mockResolvedValue({
        color: 'red',
        reason: 'Critical security risks found.',
      });

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
      });
    });

    it('shows appropriate summary for yellow status', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      mockedDetermineBlackDuckColor.mockResolvedValue({
        color: 'yellow',
        reason: 'Security risks need to be addressed before release.',
      });

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('yellow');
      });
    });

    it('shows appropriate summary for green status', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      mockedDetermineBlackDuckColor.mockResolvedValue({
        color: 'green',
        reason: 'No critical security risks were found.',
      });

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('green');
      });
    });
  });

  describe('UI Rendering', () => {
    it('renders metrics with correct styling classes', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        const metricsContainer = screen.getByTestId('rendered-metrics');
        expect(metricsContainer).toBeInTheDocument();
        expect(metricsContainer).toHaveTextContent('Critical Security Risks');
        expect(metricsContainer).toHaveTextContent('High Security Risks');
        expect(metricsContainer).toHaveTextContent('Medium Security Risks');
      });
    });

    it('passes correct props to BaseSemaphoreDialog', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('BlackDuck');
      expect(screen.getByTestId('dialog-open')).toHaveTextContent('true');

      // Test onClose callback
      const closeButton = screen.getByTestId('close-button');
      closeButton.click();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty entities array', () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog open onClose={mockOnClose} entities={[]} />
        </Wrapper>,
      );

      expect(mockBlackDuckUtils.getBlackDuckFacts).not.toHaveBeenCalled();
    });

    it('handles entities without namespace', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      const entityWithoutNamespace: Entity = {
        ...mockEntity,
        metadata: {
          ...mockEntity.metadata,
          namespace: undefined,
        },
      };

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[entityWithoutNamespace]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockBlackDuckUtils.getBlackDuckFacts).toHaveBeenCalledWith(
          mockTechInsightsApi,
          expect.objectContaining({ namespace: 'default' }),
        );
      });
    });

    it('handles missing security risk data', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      mockBlackDuckUtils.getBlackDuckFacts.mockResolvedValue({
        security_risks_critical: undefined,
        security_risks_high: null,
        security_risks_medium: 0,
      });

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        const metricsContainer = screen.getByTestId('rendered-metrics');
        expect(metricsContainer).toHaveTextContent('0'); // Should handle undefined/null values
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('does not fetch data when dialog is closed', () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open={false}
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      expect(mockBlackDuckUtils.getBlackDuckFacts).not.toHaveBeenCalled();
    });

    it('refetches data when entities change', async () => {
      const Wrapper = createWrapper();
      const mockOnClose = jest.fn();

      const { rerender } = render(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockBlackDuckUtils.getBlackDuckFacts).toHaveBeenCalledTimes(1);
      });

      const newEntity = {
        ...mockEntity,
        metadata: { ...mockEntity.metadata, name: 'new-entity' },
      };

      rerender(
        <Wrapper>
          <BlackDuckSemaphoreDialog
            open
            onClose={mockOnClose}
            entities={[newEntity]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockBlackDuckUtils.getBlackDuckFacts).toHaveBeenCalledTimes(2);
      });
    });
  });
});
