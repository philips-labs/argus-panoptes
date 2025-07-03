import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { AzureDevOpsSemaphoreDialog } from '../AzureDevOpsDialog';
import { AzureUtils } from '../../../utils/azureUtils';
import { determineSemaphoreColor } from '../../utils';
import { Entity } from '@backstage/catalog-model';

jest.mock('../../../utils/azureUtils');
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
const mockAzureUtils = {
  getAzureDevOpsBugFacts: jest.fn(),
  getAzureDevOpsBugChecks: jest.fn(),
};

const MockedAzureUtils = AzureUtils as jest.MockedClass<typeof AzureUtils>;
const mockedDetermineSemaphoreColor =
  determineSemaphoreColor as jest.MockedFunction<
    typeof determineSemaphoreColor
  >;

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

const mockEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'comp1',
    namespace: 'default',
    annotations: {
      'azure.com/project': 'projA',
      'azure.com/organization': 'orgX',
      'azure.com/bugs-query-id': 'query123',
    },
  },
  spec: { type: 'service', system: 'sysA' },
};

const mockSystemEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'sysA',
    namespace: 'default',
    annotations: {
      'azure-bugs-check-threshold-red': '0.4',
    },
  },
};

describe('AzureDevOpsSemaphoreDialog', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(msg => {
      if (
        typeof msg === 'string' &&
        msg.includes('Warning: findDOMNode is deprecated')
      ) {
        return;
      }
    });
    jest.clearAllMocks();
    MockedAzureUtils.mockImplementation(() => mockAzureUtils as any);
    mockCatalogApi.getEntityByRef.mockResolvedValue(mockSystemEntity);
    mockAzureUtils.getAzureDevOpsBugFacts.mockResolvedValue({
      azureBugCount: 7,
    });
    mockAzureUtils.getAzureDevOpsBugChecks.mockResolvedValue({
      bugCountCheck: false,
    });
    mockedDetermineSemaphoreColor.mockReturnValue({ color: 'red', reason: '' });
  });

  it('renders closed dialog correctly', () => {
    render(
      <Wrapper>
        <AzureDevOpsSemaphoreDialog
          open={false}
          onClose={jest.fn()}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );
    expect(screen.getByTestId('dialog-open')).toHaveTextContent('false');
    expect(screen.getByTestId('dialog-title')).toHaveTextContent(
      'Azure Bug Insights',
    );
  });

  it('fetches, displays metrics & computes color when opened', async () => {
    render(
      <Wrapper>
        <AzureDevOpsSemaphoreDialog
          open
          onClose={jest.fn()}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(mockAzureUtils.getAzureDevOpsBugFacts).toHaveBeenCalled();
      expect(mockAzureUtils.getAzureDevOpsBugChecks).toHaveBeenCalled();
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'System',
          name: 'sysA',
        }),
      );
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
      expect(screen.getByTestId('dialog-summary')).toBeInTheDocument();
      expect(screen.getByTestId('rendered-metrics')).toBeInTheDocument();
    });
  });

  it('handles no entities case', () => {
    render(
      <Wrapper>
        <AzureDevOpsSemaphoreDialog open onClose={jest.fn()} entities={[]} />
      </Wrapper>,
    );
    expect(mockAzureUtils.getAzureDevOpsBugFacts).not.toHaveBeenCalled();
    expect(mockAzureUtils.getAzureDevOpsBugChecks).not.toHaveBeenCalled();
  });

  it('handles API failure case', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockAzureUtils.getAzureDevOpsBugFacts.mockRejectedValue(new Error('fail'));

    render(
      <Wrapper>
        <AzureDevOpsSemaphoreDialog
          open
          onClose={jest.fn()}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
      expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
        'Failed to load metrics.',
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = jest.fn();

    render(
      <Wrapper>
        <AzureDevOpsSemaphoreDialog
          open
          onClose={onClose}
          entities={[mockEntity]}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('close-button')).toBeInTheDocument();
    screen.getByTestId('close-button').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
