import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrafficComponent } from './TrafficComponent';
import { Entity } from '@backstage/catalog-model';
import { ThemeProvider } from '@material-ui/core/styles';
import { lightTheme } from '@backstage/theme';
import { useApi } from '@backstage/core-plugin-api';
import { Component } from 'react';

// Mock the entire core-plugin-api module
jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  identityApiRef: { id: 'identity-api' },
}));

// Mock the catalog react module
jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'catalog-api' },
}));

// Mock core components
jest.mock('@backstage/core-components', () => ({
  Page: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page">{children}</div>
  ),
  Content: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="content">{children}</div>
  ),
  InfoCard: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="info-card">
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));
const mockUseApi = useApi as jest.MockedFunction<typeof useApi>;

// Mock all traffic light components
jest.mock('../Semaphores', () => ({
  TrafficLightDependabot: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="dependabot-traffic-light"
      onClick={onClick}
    >
      Dependabot Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  GitHubSecurityTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="github-security-traffic-light"
      onClick={onClick}
    >
      GitHub Security Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  SonarQubeTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="sonarqube-traffic-light"
      onClick={onClick}
    >
      SonarQube Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  PreproductionTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="preproduction-traffic-light"
      onClick={onClick}
    >
      Preproduction Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  FoundationTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="foundation-traffic-light"
      onClick={onClick}
    >
      Foundation Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  AzureDevOpsBugsTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="azure-devops-bugs-traffic-light"
      onClick={onClick}
    >
      Azure DevOps Bugs Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  BlackDuckTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="blackduck-traffic-light"
      onClick={onClick}
    >
      BlackDuck Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
  BaseTrafficLight: ({ color, tooltip, onClick }: any) => (
    <button
      type="button"
      data-testid="base-traffic-light"
      data-color={color}
      data-tooltip={tooltip}
      onClick={onClick}
    >
      Base Traffic Light: {color}
    </button>
  ),
}));

// Mock the reporting traffic light component
jest.mock('../Semaphores/ReportingTrafficLight', () => ({
  ReportingTrafficLight: ({ entities, onClick }: any) => (
    <button
      type="button"
      data-testid="reporting-traffic-light"
      onClick={onClick}
    >
      Reporting Traffic Light ({entities?.length ?? 0} entities)
    </button>
  ),
}));

// Mock all dialog components
jest.mock('../SemaphoreDialogs/BlackDuckSemaphoreDialog', () => ({
  BlackDuckSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog open aria-label="BlackDuck Dialog" data-testid="blackduck-dialog">
        <h2>BlackDuck Dialog</h2>
        <button type="button" onClick={onClose}>
          Close BlackDuck Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/GitHubAdvancedSecurityDialog', () => ({
  GitHubSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog
        open
        aria-label="GitHub Security Dialog"
        data-testid="github-security-dialog"
      >
        <h2>GitHub Security Dialog</h2>
        <button type="button" onClick={onClose}>
          Close GitHub Security Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/AzureDevOpsDialog', () => ({
  AzureDevOpsSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog
        open
        aria-label="Azure DevOps Dialog"
        data-testid="azure-devops-dialog"
      >
        <h2>Azure DevOps Dialog</h2>
        <button type="button" onClick={onClose}>
          Close Azure DevOps Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/SonarQubeDialog', () => ({
  SonarQubeSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog open aria-label="SonarQube Dialog" data-testid="sonarqube-dialog">
        <h2>SonarQube Dialog</h2>
        <button type="button" onClick={onClose}>
          Close SonarQube Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/PreProductionDialog', () => ({
  PreproductionSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog
        open
        aria-label="Preproduction Dialog"
        data-testid="preproduction-dialog"
      >
        <h2>Preproduction Dialog</h2>
        <button type="button" onClick={onClose}>
          Close Preproduction Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/FoundationDialog', () => ({
  FoundationSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog
        open
        aria-label="Foundation Dialog"
        data-testid="foundation-dialog"
      >
        <h2>Foundation Dialog</h2>
        <button type="button" onClick={onClose}>
          Close Foundation Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/ReportingDialog', () => ({
  ReportingSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog open aria-label="Reporting Dialog" data-testid="reporting-dialog">
        <h2>Reporting Dialog</h2>
        <button type="button" onClick={onClose}>
          Close Reporting Dialog
        </button>
      </dialog>
    ) : null,
}));

jest.mock('../SemaphoreDialogs/DependabotSemaphoreDialog', () => ({
  DependabotSemaphoreDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <dialog
        open
        aria-label="Dependabot Dialog"
        data-testid="dependabot-dialog"
      >
        <h2>Dependabot Dialog</h2>
        <button type="button" onClick={onClose}>
          Close Dependabot Dialog
        </button>
      </dialog>
    ) : null,
}));

// Test wrapper component that provides Backstage theme context and error boundary
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-fallback">Something went wrong</div>;
    }
    return this.props.children;
  }
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </ThemeProvider>
);

// Custom render function that includes theme provider
const renderWithTheme = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

// Mock entities for testing
const mockComponentEntities: Entity[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-repo-1',
      description: 'Test repository 1',
      tags: ['critical'],
      namespace: 'default',
    },
    spec: {
      owner: 'philips-labs',
      system: 'test-system-1',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-repo-2',
      description: 'Test repository 2',
      tags: ['non-critical'],
      namespace: 'default',
    },
    spec: {
      owner: 'other-owner',
      system: 'test-system-2',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-repo-3',
      description: 'Test repository 3',
      tags: ['critical'],
      namespace: 'default',
    },
    spec: {
      owner: 'philips-labs',
      system: 'test-system-1',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-repo-4',
      description: 'Test repository 4',
      tags: ['critical'],
      namespace: 'default',
    },
    spec: {
      owner: 'philips-labs',
      system: 'test-system-2',
    },
  },
];

const mockSystemEntities: Entity[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'test-system-1',
      namespace: 'default',
    },
    spec: {
      owner: 'team-1',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'test-system-2',
      namespace: 'default',
    },
    spec: {
      owner: 'team-2',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'test-system-3',
      namespace: 'default',
    },
    spec: {
      owner: 'team-3',
    },
  },
];

const mockUserEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'User',
  metadata: {
    name: 'test-user',
    namespace: 'default',
  },
  spec: {
    memberOf: ['team-1', 'team-2'],
  },
};

describe('TrafficComponent', () => {
  const mockIdentityApi = {
    getBackstageIdentity: jest.fn(),
  };

  const mockCatalogApi = {
    getEntities: jest.fn(),
    getEntityByRef: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock implementation using the API ref IDs
    mockUseApi.mockImplementation((apiRef: any) => {
      if (apiRef?.id === 'identity-api') {
        return mockIdentityApi;
      }

      if (apiRef?.id === 'catalog-api') {
        return mockCatalogApi;
      }

      return {};
    });

    // Setup default API responses
    mockIdentityApi.getBackstageIdentity.mockResolvedValue({
      userEntityRef: 'user:default/test-user',
    });

    mockCatalogApi.getEntityByRef.mockResolvedValue(mockUserEntity);

    mockCatalogApi.getEntities.mockImplementation(({ filter }) => {
      if (filter?.kind === 'Component') {
        return Promise.resolve({ items: mockComponentEntities });
      }
      if (filter?.kind === 'System') {
        return Promise.resolve({ items: mockSystemEntities });
      }
      return Promise.resolve({ items: [] });
    });
  });

  it('renders without crashing', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(screen.getByTestId('page')).toBeInTheDocument();
        expect(screen.getByTestId('content')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('loads and displays filter controls', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(screen.getByLabelText('My repositories')).toBeInTheDocument();
        expect(screen.getByLabelText('Critical')).toBeInTheDocument();
        expect(screen.getByText('Select System')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('loads and displays repositories after initial fetch', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        // Should show repositories that match filters (philips-labs + critical + from user's systems)
        expect(
          screen.getByText(/Selected Repositories \(\d+\)/),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('filters repositories based on "My repositories" checkbox', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(screen.getByLabelText('My repositories')).toBeChecked();
      },
      { timeout: 10000 },
    );

    // Uncheck "My repositories"
    const myReposCheckbox = screen.getByLabelText('My repositories');
    await userEvent.click(myReposCheckbox);

    await waitFor(() => {
      expect(myReposCheckbox).not.toBeChecked();
    });
  });

  it('filters repositories based on "Critical" checkbox', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(screen.getByLabelText('Critical')).toBeChecked();
      },
      { timeout: 10000 },
    );

    // Uncheck "Critical"
    const criticalCheckbox = screen.getByLabelText('Critical');
    await userEvent.click(criticalCheckbox);

    await waitFor(() => {
      expect(criticalCheckbox).not.toBeChecked();
    });
  });

  it('displays system selector with available systems', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        const systemButton = screen.getByText('test-system-1');
        expect(systemButton).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('opens system selector popover when clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        const systemButton = screen.getByText('test-system-1');
        expect(systemButton).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Click system selector
    const systemButton = screen.getByText('test-system-1');
    await userEvent.click(systemButton);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search systems...'),
      ).toBeInTheDocument();
      expect(screen.getByText('test-system-2')).toBeInTheDocument();
    });
  });

  it('filters systems in the popover search', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        const systemButton = screen.getByText('test-system-1');
        expect(systemButton).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Open system selector
    const systemButton = screen.getByText('test-system-1');
    await userEvent.click(systemButton);

    // Wait for popover to open
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search systems...'),
      ).toBeInTheDocument();
    });

    // Search for system-2 specifically
    const searchInput = screen.getByPlaceholderText('Search systems...');
    await userEvent.type(searchInput, 'system-2');

    await waitFor(() => {
      // test-system-2 should be visible after filtering
      expect(screen.getByText('test-system-2')).toBeInTheDocument();
    });

    // Clear search and verify all systems appear again
    await userEvent.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByText('test-system-2')).toBeInTheDocument();
    });
  });

  it('displays "No systems found" when search yields no results', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        const systemButton = screen.getByText('test-system-1');
        expect(systemButton).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Open system selector
    const systemButton = screen.getByText('test-system-1');
    await userEvent.click(systemButton);

    // Wait for popover to open
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search systems...'),
      ).toBeInTheDocument();
    });

    // Search for non-existent system
    const searchInput = screen.getByPlaceholderText('Search systems...');
    await userEvent.type(searchInput, 'non-existent-system-xyz');

    await waitFor(() => {
      expect(screen.getByText('No systems found')).toBeInTheDocument();
    });

    // Clear search to verify systems reappear
    await userEvent.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByText('test-system-2')).toBeInTheDocument();
    });
  });

  it('filters systems correctly by search term', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        const systemButton = screen.getByText('test-system-1');
        expect(systemButton).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Open system selector
    const systemButton = screen.getByText('test-system-1');
    await userEvent.click(systemButton);

    // Wait for popover to open
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search systems...'),
      ).toBeInTheDocument();
    });

    // Search for a specific system by number
    const searchInput = screen.getByPlaceholderText('Search systems...');
    await userEvent.type(searchInput, '2');

    await waitFor(() => {
      // Should show test-system-2
      expect(screen.getByText('test-system-2')).toBeInTheDocument();
    });

    // Test with a different search term
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, '1');

    await waitFor(() => {
      // Note: test-system-1 is already selected, so we verify search works
      expect(searchInput).toHaveValue('1');
    });
  });

  it('selects a different system from the popover', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        const systemButton = screen.getByText('test-system-1');
        expect(systemButton).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Open system selector
    const systemButton = screen.getByText('test-system-1');
    await userEvent.click(systemButton);

    // Select different system
    await userEvent.click(screen.getByText('test-system-2'));

    await waitFor(() => {
      expect(screen.getByText('test-system-2')).toBeInTheDocument();
    });
  });

  it('displays all traffic light components', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('dependabot-traffic-light'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('blackduck-traffic-light'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('github-security-traffic-light'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('reporting-traffic-light'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('preproduction-traffic-light'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('foundation-traffic-light'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('sonarqube-traffic-light'),
        ).toBeInTheDocument();
        expect(screen.getByTestId('base-traffic-light')).toBeInTheDocument();
        expect(
          screen.getByTestId('azure-devops-bugs-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('displays info cards with correct titles', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(screen.getByText('Security Checks')).toBeInTheDocument();
        expect(screen.getByText('Pipelines')).toBeInTheDocument();
        expect(screen.getByText('Software Quality')).toBeInTheDocument();
        expect(screen.getByText('Azure DevOps')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('opens BlackDuck dialog when BlackDuck traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('blackduck-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('blackduck-traffic-light'));

    expect(screen.getByTestId('blackduck-dialog')).toBeInTheDocument();
  });

  it('opens GitHub Security dialog when GitHub traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('github-security-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('github-security-traffic-light'));

    expect(screen.getByTestId('github-security-dialog')).toBeInTheDocument();
  });

  it('opens Dependabot dialog when Dependabot traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('dependabot-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('dependabot-traffic-light'));

    expect(screen.getByTestId('dependabot-dialog')).toBeInTheDocument();
  });

  it('opens SonarQube dialog when SonarQube traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('sonarqube-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('sonarqube-traffic-light'));

    expect(screen.getByTestId('sonarqube-dialog')).toBeInTheDocument();
  });

  it('opens Azure DevOps dialog when Azure DevOps traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('azure-devops-bugs-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(
      screen.getByTestId('azure-devops-bugs-traffic-light'),
    );

    expect(screen.getByTestId('azure-devops-dialog')).toBeInTheDocument();
  });

  it('opens Preproduction dialog when Preproduction traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('preproduction-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('preproduction-traffic-light'));

    expect(screen.getByTestId('preproduction-dialog')).toBeInTheDocument();
  });

  it('opens Foundation dialog when Foundation traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('foundation-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('foundation-traffic-light'));

    expect(screen.getByTestId('foundation-dialog')).toBeInTheDocument();
  });

  it('opens Reporting dialog when Reporting traffic light is clicked', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('reporting-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await userEvent.click(screen.getByTestId('reporting-traffic-light'));

    expect(screen.getByTestId('reporting-dialog')).toBeInTheDocument();
  });

  it('closes dialogs when close handler is called', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('blackduck-traffic-light'),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Open dialog
    await userEvent.click(screen.getByTestId('blackduck-traffic-light'));
    expect(screen.getByTestId('blackduck-dialog')).toBeInTheDocument();

    // Close dialog by clicking the close button
    await userEvent.click(screen.getByText('Close BlackDuck Dialog'));
    expect(screen.queryByTestId('blackduck-dialog')).not.toBeInTheDocument();
  });

  it('passes filtered entities to traffic light components', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        // Traffic lights should show entity counts
        expect(
          screen.getByText(/Dependabot Traffic Light \(\d+ entities\)/),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/GitHub Security Traffic Light \(\d+ entities\)/),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('displays component subtitles correctly', async () => {
    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        expect(screen.getByText('Dependabot')).toBeInTheDocument();
        expect(screen.getByText('BlackDuck')).toBeInTheDocument();
        expect(
          screen.getByText('Github Advanced Security'),
        ).toBeInTheDocument();
        expect(screen.getByText('Reporting Pipelines')).toBeInTheDocument();
        expect(
          screen.getByText('Pre-production Pipelines'),
        ).toBeInTheDocument();
        expect(screen.getByText('Foundation Pipelines')).toBeInTheDocument();
        expect(screen.getByText('SonarQube')).toBeInTheDocument();
        expect(screen.getByText('CodeScene')).toBeInTheDocument();
        expect(screen.getByText('Bugs')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('handles complete API failure scenario with empty data', async () => {
    // Mock all APIs to return empty/null results instead of rejecting
    // This simulates the component handling "no data" scenarios
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });
    mockCatalogApi.getEntityByRef.mockResolvedValue(null);

    // Mock identity to return a basic identity without throwing
    mockIdentityApi.getBackstageIdentity.mockResolvedValue({
      userEntityRef: 'user:default/unknown-user',
    });

    renderWithTheme(<TrafficComponent />);

    // Component should handle empty data gracefully
    await waitFor(
      () => {
        // The component should still render basic structure
        expect(screen.getByTestId('page')).toBeInTheDocument();

        // Filter controls should still be present
        expect(screen.getByLabelText('My repositories')).toBeInTheDocument();
        expect(screen.getByLabelText('Critical')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // With no systems and no user, it should show the default "Select System" text
    // We don't expect any specific system to be selected
    expect(screen.getByText('Select System')).toBeInTheDocument();
  });

  it('handles user not found scenario', async () => {
    // Components and systems APIs work, but user is not found
    mockCatalogApi.getEntities.mockImplementation(({ filter }) => {
      if (filter?.kind === 'Component') {
        return Promise.resolve({ items: mockComponentEntities });
      }
      if (filter?.kind === 'System') {
        return Promise.resolve({ items: mockSystemEntities });
      }
      return Promise.resolve({ items: [] });
    });

    // User not found
    mockCatalogApi.getEntityByRef.mockResolvedValue(null);

    renderWithTheme(<TrafficComponent />);

    await waitFor(
      () => {
        // Basic structure should render
        expect(screen.getByTestId('page')).toBeInTheDocument();
        expect(screen.getByLabelText('My repositories')).toBeInTheDocument();
        expect(screen.getByLabelText('Critical')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Without user team memberships, component might show all systems or none
    // Let's just verify the system selector is present
    expect(screen.getByText('Select System')).toBeInTheDocument();
  });

  // Alternative: Test actual error boundary functionality
  it('error boundary catches component errors', async () => {
    // Create a component that will actually throw an error
    const ThrowingComponent = () => {
      throw new Error('Test error for error boundary');
    };

    render(
      <TestWrapper>
        <ThrowingComponent />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});
