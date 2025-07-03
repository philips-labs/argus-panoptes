import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiRegistry } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ApiProvider } from '@backstage/core-app-api';
import { FoundationSemaphoreDialog } from '../FoundationDialog';
import { determineSemaphoreColor } from '../../utils';
import { FoundationUtils } from '../../../utils/foundationUtils';
import { Entity } from '@backstage/catalog-model';

jest.mock('../../../utils/foundationUtils');
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
const mockFoundationUtils = {
  getFoundationPipelineFacts: jest.fn(),
  getFoundationPipelineChecks: jest.fn(),
};

const MockedFoundationUtils = FoundationUtils as jest.MockedClass<
  typeof FoundationUtils
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
      'foundation-check-threshold-red': '0.5',
      'foundation-configured-repositories': 'mock-service',
    },
  },
};

describe('FoundationSemaphoreDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedFoundationUtils.mockImplementation(() => mockFoundationUtils as any);

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);
    mockFoundationUtils.getFoundationPipelineFacts.mockResolvedValue({
      successWorkflowRunsCount: 8,
      failureWorkflowRunsCount: 2,
    });
    mockFoundationUtils.getFoundationPipelineChecks.mockResolvedValue({
      successRateCheck: false,
    });
    mockedDetermineSemaphoreColor.mockReturnValue({
      color: 'red',
      reason: 'Below acceptable success rate.',
    });
  });

  it('renders and fetches data successfully', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        'Below acceptable success rate.',
      );
      expect(screen.getByTestId('rendered-metrics')).toBeInTheDocument();
    });
  });

  it('shows gray color when no configured repos are found', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();
    mockCatalogApi.getEntityByRef.mockResolvedValue({
      ...mockSystemEntity,
      metadata: { annotations: {} },
    });

    render(
      <Wrapper>
        <FoundationSemaphoreDialog open onClose={mockOnClose} entities={[]} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
    });
  });

  it('handles API failure gracefully', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();
    mockFoundationUtils.getFoundationPipelineFacts.mockRejectedValue(
      new Error('API failure'),
    );

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
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
        <FoundationSemaphoreDialog
          open={false}
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    expect(
      mockFoundationUtils.getFoundationPipelineFacts,
    ).not.toHaveBeenCalled();
  });

  it('triggers onClose when close button is clicked', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('close-button');
    closeBtn.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders lowest success rate repos sorted and with correct data', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    mockFoundationUtils.getFoundationPipelineFacts.mockImplementation(
      async (_, ref) => {
        if (ref.name === 'repo-a')
          return { successWorkflowRunsCount: 2, failureWorkflowRunsCount: 8 };
        if (ref.name === 'repo-b')
          return { successWorkflowRunsCount: 7, failureWorkflowRunsCount: 3 };
        return { successWorkflowRunsCount: 0, failureWorkflowRunsCount: 0 };
      },
    );
    mockFoundationUtils.getFoundationPipelineChecks.mockResolvedValue({
      successRateCheck: false,
    });

    const entityA = {
      ...mockEntity,
      metadata: {
        ...mockEntity.metadata,
        name: 'repo-a',
        annotations: { 'github.com/project-slug': 'org/repo-a' },
      },
    };
    const entityB = {
      ...mockEntity,
      metadata: {
        ...mockEntity.metadata,
        name: 'repo-b',
        annotations: { 'github.com/project-slug': 'org/repo-b' },
      },
    };
    const configEntity = {
      ...mockSystemEntity,
      metadata: {
        ...mockSystemEntity.metadata,
        annotations: {
          'foundation-configured-repositories': 'repo-a,repo-b',
        },
      },
    };

    mockCatalogApi.getEntityByRef.mockResolvedValue(configEntity);

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[entityA, entityB]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveTextContent('repo-a');
      expect(links[0]).toHaveAttribute(
        'href',
        'https://github.com/org/repo-a/actions',
      );
      expect(screen.getByText(/Success Rate: 20%/)).toBeInTheDocument();
    });
  });

  it('uses default threshold when annotation is not a number', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    mockCatalogApi.getEntityByRef.mockResolvedValue({
      ...mockSystemEntity,
      metadata: {
        ...mockSystemEntity.metadata,
        annotations: {
          'foundation-check-threshold-red': 'invalid-number',
          'foundation-configured-repositories': 'mock-service',
        },
      },
    });

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
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

  it('falls back to all entities if no configured repositories', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    mockCatalogApi.getEntityByRef.mockResolvedValue({
      ...mockSystemEntity,
      metadata: {
        ...mockSystemEntity.metadata,
        annotations: {
          'foundation-check-threshold-red': '0.4',
        },
      },
    });

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
      expect(screen.getByTestId('rendered-metrics')).toBeInTheDocument();
    });
  });

  it('handles entity with no system defined gracefully', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    const entityWithoutSystem = {
      ...mockEntity,
      spec: {},
    };

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[entityWithoutSystem]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
    });
  });

  it('handles entities with no github annotation', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    const entityWithoutGithub = {
      ...mockEntity,
      metadata: {
        ...mockEntity.metadata,
        annotations: {},
      },
    };

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[entityWithoutGithub]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const link = screen.getByText('mock-service');
      expect(link.getAttribute('href')).toBe('#');
    });
  });

  it('renders correct summary for yellow color', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    mockedDetermineSemaphoreColor.mockReturnValue({
      color: 'yellow',
      reason: 'Moderate failure rate.',
    });

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('yellow');
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        /Moderate failure rate\. Issues should be addressed/,
      );
    });
  });

  it('renders correct summary for green color', async () => {
    const Wrapper = createWrapper();
    const mockOnClose = jest.fn();

    mockedDetermineSemaphoreColor.mockReturnValue({
      color: 'green',
      reason: 'Everything looks good.',
    });

    render(
      <Wrapper>
        <FoundationSemaphoreDialog
          open
          onClose={mockOnClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('green');
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        /Everything looks good\. Code quality is good/,
      );
    });
  });
});
