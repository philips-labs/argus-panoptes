import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiRegistry } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ApiProvider } from '@backstage/core-app-api';
import { PreproductionSemaphoreDialog } from '../PreProductionDialog';
import { determineSemaphoreColor } from '../../utils';
import { PreproductionUtils } from '../../../utils/preproductionUtils';
import { Entity } from '@backstage/catalog-model';

jest.mock('../../../utils/preproductionUtils');
jest.mock('../../utils');
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

const mockTechInsightsApi = { getFacts: jest.fn() };
const mockCatalogApi = { getEntityByRef: jest.fn() };
const mockPreprodUtils = {
  getPreproductionPipelineFacts: jest.fn(),
  getPreproductionPipelineChecks: jest.fn(),
};

const MockedPreproductionUtils = PreproductionUtils as jest.MockedClass<
  typeof PreproductionUtils
>;
const mockedDetermineSemaphoreColor =
  determineSemaphoreColor as jest.MockedFunction<
    typeof determineSemaphoreColor
  >;

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

const mockEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'mock-service',
    namespace: 'default',
  },
  spec: {
    type: 'service',
    system: 'mock-system',
  },
};

const mockSystemEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'mock-system',
    namespace: 'default',
    annotations: {
      'preproduction-check-threshold-red': '0.5',
      'preproduction-configured-repositories': 'mock-service',
    },
  },
};

describe('PreproductionSemaphoreDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedPreproductionUtils.mockImplementation(() => mockPreprodUtils as any);

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);
    mockPreprodUtils.getPreproductionPipelineFacts.mockResolvedValue({
      successWorkflowRunsCount: 6,
      failureWorkflowRunsCount: 4,
    });
    mockPreprodUtils.getPreproductionPipelineChecks.mockResolvedValue({
      successRateCheck: false,
    });
    mockedDetermineSemaphoreColor.mockReturnValue({
      color: 'red',
      reason: 'High failure rate detected.',
    });
  });

  it('renders and fetches data successfully', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    render(
      <Wrapper>
        <PreproductionSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        'High failure rate detected.',
      );
      expect(screen.getByTestId('rendered-metrics')).toBeInTheDocument();
    });
  });

  it('shows gray color when no configured repos found', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();
    mockCatalogApi.getEntityByRef.mockResolvedValue({
      ...mockSystemEntity,
      metadata: { annotations: {} },
    });

    render(
      <Wrapper>
        <PreproductionSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
    });
  });

  it('handles API failure gracefully', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();
    mockPreprodUtils.getPreproductionPipelineFacts.mockRejectedValue(
      new Error('API failure'),
    );

    render(
      <Wrapper>
        <PreproductionSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        /Failed to load metrics/,
      );
    });
  });

  it('does not fetch data when dialog is closed', () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    render(
      <Wrapper>
        <PreproductionSemaphoreDialog
          open={false}
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    expect(
      mockPreprodUtils.getPreproductionPipelineFacts,
    ).not.toHaveBeenCalled();
  });

  it('triggers onClose when close button is clicked', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    render(
      <Wrapper>
        <PreproductionSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    const closeBtn = screen.getByTestId('close-button');
    closeBtn.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
