import { render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { GithubAdvancedSecurityUtils } from '../../../utils/githubAdvancedSecurityUtils';
import { GitHubSecurityTrafficLight } from '../GitHubSecurityTrafficLight';
import { Entity } from '@backstage/catalog-model';

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

jest.mock('../../../utils/githubAdvancedSecurityUtils', () => ({
  GithubAdvancedSecurityUtils: jest.fn(),
}));

describe('GitHubSecurityTrafficLight', () => {
  let mockCatalogApi: any;
  let mockTechInsightsApi: any;
  let mockGitHubUtils: any;
  let mockEntities: Entity[];

  beforeEach(() => {
    jest.clearAllMocks();

    mockCatalogApi = {
      getEntityByRef: jest.fn(),
    };
    mockTechInsightsApi = {};

    mockEntities = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'my-entity', namespace: 'default' },
        spec: { system: 'my-system' },
      },
    ];

    mockGitHubUtils = {
      getGitHubSecurityData: jest.fn().mockResolvedValue({
        criticalCheck: false,
        highCheck: false,
        mediumCheck: false,
        lowCheck: false,
        secretCheck: false,
      }),
    };

    (GithubAdvancedSecurityUtils as jest.Mock).mockImplementation(
      () => mockGitHubUtils,
    );

    mockCatalogApi.getEntityByRef.mockResolvedValue({
      metadata: {
        annotations: {},
      },
    });
  });

  const renderComponent = (entities = mockEntities, onClick?: () => void) => {
    return render(
      <TestApiProvider
        apis={[
          [catalogApiRef, mockCatalogApi],
          [techInsightsApiRef, mockTechInsightsApi],
        ]}
      >
        <GitHubSecurityTrafficLight entities={entities} onClick={onClick} />
      </TestApiProvider>,
    );
  };

  it('shows initial loading state', () => {
    renderComponent();
    const loadingIndicator = screen.getByTitle(
      'Loading GitHub Security data...',
    );
    expect(loadingIndicator).toBeInTheDocument();
  });

  it('renders green traffic light when all security checks pass', async () => {
    renderComponent();
    await waitFor(() => {
      const greenIndicator = screen.getByTitle(
        'All GitHub security checks passed for all entities',
      );
      expect(greenIndicator).toBeInTheDocument();
    });
  });

  it('renders red traffic light when critical issues exist', async () => {
    mockGitHubUtils.getGitHubSecurityData.mockResolvedValue({
      criticalCheck: true,
      highCheck: false,
      mediumCheck: false,
      lowCheck: false,
      secretCheck: false,
    });

    renderComponent();

    await waitFor(() => {
      const redIndicator = screen.getByTitle(
        /Critical severity issues are exceeded/,
      );
      expect(redIndicator).toBeInTheDocument();
    });
  });

  it('renders yellow traffic light when medium/low issues exceed thresholds', async () => {
    mockGitHubUtils.getGitHubSecurityData.mockResolvedValue({
      criticalCheck: false,
      highCheck: false,
      mediumCheck: true,
      lowCheck: true,
      secretCheck: false,
    });

    renderComponent();

    await waitFor(() => {
      const yellowIndicator = screen.getByTitle(
        /Medium severity issues are exceeded/,
      );
      expect(yellowIndicator).toBeInTheDocument();
    });
  });

  it('renders red traffic light when secret scanning issues exist', async () => {
    mockGitHubUtils.getGitHubSecurityData.mockResolvedValue({
      criticalCheck: false,
      highCheck: false,
      mediumCheck: false,
      lowCheck: false,
      secretCheck: true,
    });

    renderComponent();

    await waitFor(() => {
      const redSecret = screen.getByTitle(
        /Secret scanning issues are exceeded/,
      );
      expect(redSecret).toBeInTheDocument();
    });
  });

  it('shows error state when API call fails', async () => {
    mockCatalogApi.getEntityByRef.mockRejectedValue(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      const errorDiv = screen.getByTitle(
        'Failed to retrieve GitHub Security data',
      );
      expect(errorDiv).toBeInTheDocument();
    });
  });

  it('shows error state when GitHub security data fetch fails', async () => {
    mockGitHubUtils.getGitHubSecurityData.mockRejectedValue(
      new Error('GitHub API Error'),
    );

    renderComponent();

    await waitFor(() => {
      const errorDiv = screen.getByTitle(
        'Failed to retrieve GitHub Security data',
      );
      expect(errorDiv).toBeInTheDocument();
    });
  });

  it('calls onClick when clicked', async () => {
    const handleClick = jest.fn();

    renderComponent(mockEntities, handleClick);

    await waitFor(() => {
      const clickable = screen.getByTitle(
        'All GitHub security checks passed for all entities',
      );
      expect(clickable).toBeInTheDocument();
      clickable.click();
      expect(handleClick).toHaveBeenCalled();
    });
  });

  it('fetches system entity with correct parameters', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'my-system',
      });
    });
  });

  it('handles string system names correctly', async () => {
    const entityWithStringSystem = {
      ...mockEntities[0],
      spec: { system: 'string-system-name' },
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

  it('calls GitHub utils with correct entity reference', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockGitHubUtils.getGitHubSecurityData).toHaveBeenCalledWith(
        mockTechInsightsApi,
        {
          kind: 'Component',
          namespace: 'default',
          name: 'my-entity',
        },
      );
    });
  });

  it('handles entities without namespace', async () => {
    const entitiesWithoutNamespace = [
      {
        ...mockEntities[0],
        metadata: { name: 'test-component-1' },
        spec: { system: 'test-system' },
      },
    ];

    renderComponent(entitiesWithoutNamespace);

    await waitFor(() => {
      expect(mockCatalogApi.getEntityByRef).toHaveBeenCalledWith({
        kind: 'System',
        namespace: 'default',
        name: 'test-system',
      });
      expect(mockGitHubUtils.getGitHubSecurityData).toHaveBeenCalledWith(
        mockTechInsightsApi,
        {
          kind: 'Component',
          namespace: 'default',
          name: 'test-component-1',
        },
      );
    });
  });

  it('creates GithubAdvancedSecurityUtils instance correctly', async () => {
    renderComponent();
    expect(GithubAdvancedSecurityUtils).toHaveBeenCalledTimes(1);
  });
});
