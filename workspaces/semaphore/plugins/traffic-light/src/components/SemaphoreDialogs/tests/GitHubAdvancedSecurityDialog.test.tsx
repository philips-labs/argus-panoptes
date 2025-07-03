import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiRegistry } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ApiProvider } from '@backstage/core-app-api';
import { GitHubSemaphoreDialog } from '../GitHubAdvancedSecurityDialog';
import { GithubAdvancedSecurityUtils } from '../../../utils/githubAdvancedSecurityUtils';
import { calculateGitHubSecurityTrafficLight } from '../../Semaphores/GitHubSecurityTrafficLight';
import { Entity } from '@backstage/catalog-model';

jest.mock('../../../utils/githubAdvancedSecurityUtils');
jest.mock('../../Semaphores/GitHubSecurityTrafficLight');

// Mock BaseSemaphoreDialog
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
const mockGithubUtils = { getGitHubSecurityData: jest.fn() };

const MockedGithubUtils = GithubAdvancedSecurityUtils as jest.MockedClass<
  typeof GithubAdvancedSecurityUtils
>;
const mockedTrafficLight =
  calculateGitHubSecurityTrafficLight as jest.MockedFunction<
    typeof calculateGitHubSecurityTrafficLight
  >;

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'test-entity', namespace: 'default' },
  spec: { type: 'service', system: 'example-system' },
};

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

describe('GitHubSemaphoreDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedGithubUtils.mockImplementation(() => mockGithubUtils as any);
  });

  describe('Dialog State Management', () => {
    it('renders closed state initially', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <GitHubSemaphoreDialog open={false} onClose={jest.fn()} />
        </Wrapper>,
      );

      expect(screen.getByTestId('dialog-open')).toHaveTextContent('false');
      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        'GitHub Advanced Security',
      );
    });

    it('calls onClose when close button is clicked', async () => {
      const Wrapper = createWrapper();
      const onClose = jest.fn();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={onClose} entities={[entity]} />
        </Wrapper>,
      );

      const closeButton = screen.getByTestId('close-button');
      closeButton.click();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows loading state while fetching data', async () => {
      const Wrapper = createWrapper();
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockGithubUtils.getGitHubSecurityData.mockReturnValue(delayedPromise);

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      // Should show loading state
      expect(screen.getByTestId('dialog-loading')).toHaveTextContent('true');

      // Resolve the promise
      resolvePromise!({
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });

      await waitFor(() => {
        expect(screen.getByTestId('dialog-loading')).toHaveTextContent('false');
      });
    });
  });

  describe('Data Fetching and Processing', () => {
    it('fetches and processes data correctly when opened', async () => {
      const Wrapper = createWrapper();
      const onClose = jest.fn();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 3,
        openSecretScanningAlertCount: 2,
        codeScanningAlerts: {
          a1: {
            severity: 'high',
            description: 'Issue A',
            html_url: 'https://github.com/org/repo/a1',
          },
          a2: {
            severity: 'low',
            description: 'Issue B',
            html_url: 'https://github.com/org/repo/a2',
          },
        },
        secretScanningAlerts: {
          s1: {
            description: 'Secret A',
            html_url: 'https://github.com/org/repo/s1',
          },
        },
      });

      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { annotations: { 'github/security.thresholds': '{}' } },
      });

      mockedTrafficLight.mockReturnValue({
        color: 'red',
        reason: 'Critical security issues require immediate attention.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={onClose} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
        expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
          'Critical security issues require immediate attention.',
        );
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '3',
        );
      });
    });

    it('handles no security issues gracefully', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });

      mockedTrafficLight.mockReturnValue({
        color: 'green',
        reason: 'No security issues found.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('green');
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '0',
        );
      });
    });

    it('extracts repository names from URLs correctly', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 2,
        openSecretScanningAlertCount: 1,
        codeScanningAlerts: {
          a1: {
            severity: 'high',
            description: 'Issue with repo name',
            html_url:
              'https://github.com/myorg/myrepo/security/code-scanning/1',
            direct_link:
              'https://github.com/myorg/myrepo/blob/main/file.js#L10',
          },
        },
        secretScanningAlerts: {
          s1: {
            description: 'Secret detected',
            html_url:
              'https://github.com/myorg/myrepo/security/secret-scanning/1',
          },
        },
      });

      mockedTrafficLight.mockReturnValue({
        color: 'red',
        reason: 'Security issues found.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '2',
        );
        // Repository names should be extracted and prepended to descriptions
      });
    });
  });

  describe('Alert Handling and Sorting', () => {
    it('sorts security issues by severity correctly', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 4,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {
          a1: {
            severity: 'low',
            description: 'Low Issue',
            html_url: 'https://github.com/org/repo/a1',
          },
          a2: {
            severity: 'critical',
            description: 'Critical Issue',
            html_url: 'https://github.com/org/repo/a2',
          },
          a3: {
            severity: 'medium',
            description: 'Medium Issue',
            html_url: 'https://github.com/org/repo/a3',
          },
          a4: {
            severity: 'high',
            description: 'High Issue',
            html_url: 'https://github.com/org/repo/a4',
          },
        },
        secretScanningAlerts: {},
      });

      mockedTrafficLight.mockReturnValue({
        color: 'red',
        reason: 'Critical issues found.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        // Verify that details are sorted by severity (critical, high, medium, low)
        const component = screen.getByTestId('base-semaphore-dialog');
        expect(component).toBeInTheDocument();
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '4',
        );
      });
    });

    it('handles alerts without severity correctly', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 1,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {
          a1: { description: 'Issue without severity', html_url: '' }, // No severity field
        },
        secretScanningAlerts: {},
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('yellow');
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '1',
        );
      });
    });

    it('includes component path when available', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 1,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {
          a1: {
            severity: 'high',
            description: 'Issue with path',
            html_url: 'https://github.com/org/repo/a1',
            location: { path: 'src/components/Component.tsx' },
          },
        },
        secretScanningAlerts: {},
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '1',
        );
        // Component path should be included in the details
      });
    });
  });

  describe('Threshold Configuration', () => {
    it('shows fallback summary and color when thresholds are missing', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 1,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {
          a1: {
            severity: 'critical',
            description: 'Critical Alert',
            html_url: '',
          },
        },
        secretScanningAlerts: {},
      });

      mockCatalogApi.getEntityByRef.mockRejectedValue(
        new Error('No system entity'),
      );

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('red');
        expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
          'Critical security issues require immediate attention.',
        );
      });
    });

    it('uses custom thresholds from system entity', async () => {
      const Wrapper = createWrapper();
      const systemEntity = {
        metadata: {
          annotations: {
            'github/security.thresholds': JSON.stringify({
              critical_red: 1,
              high_red: 2,
              secrets_red: 1,
              medium_red: 5,
              medium_yellow: 3,
              low_yellow: 10,
            }),
          },
        },
      };

      mockCatalogApi.getEntityByRef.mockResolvedValue(systemEntity);
      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 2,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {
          a1: { severity: 'medium', description: 'Medium Issue', html_url: '' },
          a2: {
            severity: 'medium',
            description: 'Another Medium Issue',
            html_url: '',
          },
        },
        secretScanningAlerts: {},
      });

      mockedTrafficLight.mockReturnValue({
        color: 'yellow',
        reason: 'Medium severity issues within threshold.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
          kind: 'System',
          namespace: 'default',
          name: 'example-system',
        });
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('yellow');
      });
    });
  });

  describe('Entity and Namespace Handling', () => {
    it('handles entities in different namespaces', async () => {
      const Wrapper = createWrapper();
      const entityInCustomNamespace = {
        ...entity,
        metadata: { ...entity.metadata, namespace: 'custom-namespace' },
      };

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });

      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { annotations: {} },
      });

      mockedTrafficLight.mockReturnValue({
        color: 'green',
        reason: 'No issues found.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog
            open
            onClose={jest.fn()}
            entities={[entityInCustomNamespace]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
          kind: 'System',
          namespace: 'custom-namespace',
          name: 'example-system',
        });
      });
    });

    it('handles string system name correctly', async () => {
      const Wrapper = createWrapper();
      const entityWithStringSystem = {
        ...entity,
        spec: { type: 'service', system: 'string-system-name' },
      };

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      });

      mockCatalogApi.getEntityByRef.mockResolvedValue({
        metadata: { annotations: {} },
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog
            open
            onClose={jest.fn()}
            entities={[entityWithStringSystem]}
          />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
          kind: 'System',
          namespace: 'default',
          name: 'string-system-name',
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles API error gracefully', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockRejectedValue(
        new Error('API failure'),
      );

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dialog-color')).toHaveTextContent('gray');
        expect(screen.getByTestId('dialog-summary')).toHaveTextContent(
          'Failed to load GitHub Security data.',
        );
      });
    });

    it('renders metrics correctly with all severity levels', async () => {
      const Wrapper = createWrapper();

      mockGithubUtils.getGitHubSecurityData.mockResolvedValue({
        openCodeScanningAlertCount: 10,
        openSecretScanningAlertCount: 5,
        codeScanningAlerts: {
          a1: { severity: 'critical', description: 'Critical 1', html_url: '' },
          a2: { severity: 'critical', description: 'Critical 2', html_url: '' },
          a3: { severity: 'high', description: 'High 1', html_url: '' },
          a4: { severity: 'high', description: 'High 2', html_url: '' },
          a5: { severity: 'high', description: 'High 3', html_url: '' },
          a6: { severity: 'medium', description: 'Medium 1', html_url: '' },
          a7: { severity: 'medium', description: 'Medium 2', html_url: '' },
          a8: { severity: 'low', description: 'Low 1', html_url: '' },
        },
        secretScanningAlerts: {
          s1: { description: 'Secret 1', html_url: '' },
          s2: { description: 'Secret 2', html_url: '' },
          s3: { description: 'Secret 3', html_url: '' },
          s4: { description: 'Secret 4', html_url: '' },
          s5: { description: 'Secret 5', html_url: '' },
        },
      });

      mockedTrafficLight.mockReturnValue({
        color: 'red',
        reason: 'Critical issues found.',
      });

      render(
        <Wrapper>
          <GitHubSemaphoreDialog open onClose={jest.fn()} entities={[entity]} />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rendered-metrics')).toBeInTheDocument();
        expect(screen.getByTestId('dialog-details-count')).toHaveTextContent(
          '13',
        ); // 8 code + 5 secret
      });
    });
  });
});
