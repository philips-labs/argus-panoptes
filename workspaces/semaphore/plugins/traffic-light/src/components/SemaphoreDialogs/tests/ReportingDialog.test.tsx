import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiRegistry } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ApiProvider } from '@backstage/core-app-api';
import { ReportingSemaphoreDialog } from '../ReportingDialog';
import { ReportingUtils } from '../../../utils/reportingUtils';
import { determineSemaphoreColor } from '../../utils';
import { Entity } from '@backstage/catalog-model';
import { act } from 'react';

// Mock dependencies
jest.mock('../../../utils/reportingUtils');
jest.mock('../../utils');

// Create a mocked version of the PipelineMetricsUtils with functions that can be customized per test
const mockProcessEntities = jest.fn();
const mockGetSystemConfig = jest.fn();
const mockAggregateMetrics = jest.fn();
const mockBuildSemaphoreData = jest.fn();
const mockGetLowestSuccessRepos = jest.fn();
const mockRenderPipelineMetrics = jest.fn();

jest.mock('../../../utils/PipelineMetricsUtils', () => ({
  getSystemConfig: (...args: any[]) => mockGetSystemConfig(...args),
  processEntities: (...args: any[]) => mockProcessEntities(...args),
  aggregateMetrics: (...args: any[]) => mockAggregateMetrics(...args),
  buildSemaphoreData: (...args: any[]) => mockBuildSemaphoreData(...args),
  getLowestSuccessRepos: (...args: any[]) => mockGetLowestSuccessRepos(...args),
  renderPipelineMetrics: (...args: any[]) => mockRenderPipelineMetrics(...args),
}));

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
      {renderMetrics && (
        <div data-testid="rendered-metrics">{renderMetrics()}</div>
      )}
      <button data-testid="close-button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

const mockTechInsightsApi = { getFacts: jest.fn(), getChecks: jest.fn() };
const mockCatalogApi = { getEntityByRef: jest.fn() };
const mockReportingUtils = {
  getReportingPipelineFacts: jest.fn().mockResolvedValue({
    successfulRuns: 5,
    failedRuns: 5,
  }),
  getReportingPipelineChecks: jest.fn().mockResolvedValue({
    successRateCheck: false,
  }),
};

const MockedReportingUtils = ReportingUtils as jest.MockedClass<
  typeof ReportingUtils
>;
const mockedDetermineColor = determineSemaphoreColor as jest.MockedFunction<
  typeof determineSemaphoreColor
>;

const mockEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'test-service', namespace: 'default' },
  spec: { type: 'service', system: 'test-system' },
};

const theme = createTheme();
const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const apis = TestApiRegistry.from(
    [techInsightsApiRef, mockTechInsightsApi],
    [catalogApiRef, mockCatalogApi],
  );
  return (
    <ApiProvider apis={apis}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ApiProvider>
  );
};

describe('ReportingSemaphoreDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedReportingUtils.mockImplementation(() => mockReportingUtils as any);
    mockedDetermineColor.mockReturnValue({
      color: 'red',
      reason: 'Too many failures',
    });

    // Default mock implementations for the successful case
    mockGetSystemConfig.mockResolvedValue({
      redThreshold: 0.33,
      configuredRepoNames: [],
    });
    mockProcessEntities.mockResolvedValue([
      {
        name: 'test-service',
        url: 'https://github.com/test/test-service/actions',
        successRate: 50,
        successWorkflowRunsCount: 5,
        failureWorkflowRunsCount: 5,
        failedCheck: true,
      },
    ]);
    mockAggregateMetrics.mockReturnValue({
      totalSuccess: 5,
      totalFailure: 5,
      totalRuns: 10,
      successRate: 50,
    });
    mockBuildSemaphoreData.mockReturnValue({
      color: 'red',
      summary: 'Too many failures. Critical attention required.',
      metrics: {
        totalSuccess: 5,
        totalFailure: 5,
        totalRuns: 10,
        successRate: 50,
      },
      details: [],
    });
    mockGetLowestSuccessRepos.mockReturnValue([
      {
        name: 'test-service',
        url: 'https://github.com/test/test-service/actions',
        successRate: 50,
      },
    ]);
    mockRenderPipelineMetrics.mockReturnValue(<div>Mocked metrics</div>);
  });

  it('renders closed dialog correctly', () => {
    render(
      <Wrapper>
        <ReportingSemaphoreDialog open={false} onClose={jest.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('dialog-open')).toHaveTextContent('false');
    expect(screen.getByTestId('dialog-title')).toHaveTextContent(
      'Reporting Pipeline Insights',
    );
  });

  it('loads and displays metrics', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(
        <Wrapper>
          <ReportingSemaphoreDialog
            open
            onClose={onClose}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );
    });

    await waitFor(() => {
      expect(mockGetSystemConfig).toHaveBeenCalled();
      expect(mockProcessEntities).toHaveBeenCalled();
    });

    expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
    expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
      'Too many failures. Critical attention required.',
    );
    expect(screen.getByTestId('dialog-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('rendered-metrics')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    // Set up the utility to throw an error for this specific test
    mockProcessEntities.mockRejectedValueOnce(new Error('API error'));

    // Reset the buildSemaphoreData mock to prevent it from being called
    // if there's an error, it shouldn't reach this function
    mockBuildSemaphoreData.mockClear();

    await act(async () => {
      render(
        <Wrapper>
          <ReportingSemaphoreDialog
            open
            onClose={jest.fn()}
            entities={[mockEntity]}
          />
        </Wrapper>,
      );
    });

    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
      // Use a partial text match instead of exact match
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        /Failed to load metrics/,
      );
    });

    // Verify processEntities was called but threw an error
    expect(mockProcessEntities).toHaveBeenCalled();
    // Verify buildSemaphoreData was not called after the error
    expect(mockBuildSemaphoreData).not.toHaveBeenCalled();
  });

  it('does not fetch if dialog is closed', () => {
    render(
      <Wrapper>
        <ReportingSemaphoreDialog
          open={false}
          onClose={jest.fn()}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );
    expect(mockGetSystemConfig).not.toHaveBeenCalled();
    expect(mockProcessEntities).not.toHaveBeenCalled();
  });

  it('invokes onClose when close button is clicked', async () => {
    const onClose = jest.fn();

    render(
      <Wrapper>
        <ReportingSemaphoreDialog
          open
          onClose={onClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    screen.getByTestId('close-button').click();
    expect(onClose).toHaveBeenCalled();
  });
});
