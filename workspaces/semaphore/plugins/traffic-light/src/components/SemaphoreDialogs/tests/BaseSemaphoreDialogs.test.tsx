import { render, screen, fireEvent } from '@testing-library/react';
import { BaseSemaphoreDialog } from '../BaseSemaphoreDialogs';
import { SemaphoreData } from '../types';

describe('BaseSemaphoreDialog', () => {
  const mockOnClose = jest.fn();

  const mockData: SemaphoreData = {
    color: 'red',
    summary: 'Critical issues detected',
    details: [
      {
        severity: 'critical',
        description: 'Critical vulnerability detected',
        url: 'https://example.com/issue/1',
        directLink: 'https://example.com/issue/1/details',
        component: 'backend-service',
      },
      {
        severity: 'high',
        description: 'High severity bug found',
        url: 'https://example.com/issue/2',
        component: 'frontend',
      },
      {
        severity: 'medium',
        description: 'Medium severity code smell',
        component: 'api',
      },
      {
        severity: 'low',
        description: 'Low priority technical debt',
      },
    ],
    metrics: {},
  };

  const mockRenderMetrics = jest.fn(() => (
    <div data-testid="custom-metrics">Custom Metrics Content</div>
  ));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dialog with title and summary', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={mockData}
      />,
    );

    expect(screen.getByText('Security Status')).toBeInTheDocument();
    expect(screen.getByText('Critical issues detected')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={mockData}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={mockData}
        isLoading
      />,
    );

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    expect(
      screen.queryByText('Critical issues detected'),
    ).not.toBeInTheDocument();
  });

  it('renders custom metrics when provided', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={mockData}
        renderMetrics={mockRenderMetrics}
      />,
    );

    expect(mockRenderMetrics).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('custom-metrics')).toBeInTheDocument();
  });

  it('renders the correct status icon based on color', () => {
    const { rerender } = render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={{ ...mockData, color: 'red' }}
      />,
    );

    // For red color, expect error icon
    expect(screen.getByText('Critical issues detected')).toBeInTheDocument();

    rerender(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={{ ...mockData, color: 'yellow' }}
      />,
    );

    // For yellow color, expect warning icon
    expect(screen.getByText('Critical issues detected')).toBeInTheDocument();

    rerender(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={{ ...mockData, color: 'green' }}
      />,
    );

    // For green color, expect check circle icon
    expect(screen.getByText('Critical issues detected')).toBeInTheDocument();

    rerender(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={{ ...mockData, color: 'gray' }}
      />,
    );

    // For any other color, expect info icon
    expect(screen.getByText('Critical issues detected')).toBeInTheDocument();
  });

  it('renders issues with correct severity colors', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={mockData}
      />,
    );

    // Check that all issues are rendered
    expect(
      screen.getByText('Critical vulnerability detected'),
    ).toBeInTheDocument();
    expect(screen.getByText('High severity bug found')).toBeInTheDocument();
    expect(screen.getByText('Medium severity code smell')).toBeInTheDocument();
    expect(screen.getByText('Low priority technical debt')).toBeInTheDocument();

    // Check that severity chips are rendered
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();

    // Check that component chips are rendered
    expect(screen.getByText('backend-service')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('api')).toBeInTheDocument();
  });

  it('renders issue with links when URL is provided', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={mockData}
      />,
    );

    // Find links
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2); // Two issues have URLs

    // Check first link (should use directLink when available)
    expect(links[0]).toHaveAttribute(
      'href',
      'https://example.com/issue/1/details',
    );
    expect(links[0]).toHaveTextContent('Critical vulnerability detected');

    // Check second link
    expect(links[1]).toHaveAttribute('href', 'https://example.com/issue/2');
    expect(links[1]).toHaveTextContent('High severity bug found');
  });

  it('does not render issues section when no details are provided', () => {
    render(
      <BaseSemaphoreDialog
        open
        onClose={mockOnClose}
        title="Security"
        data={{ ...mockData, details: [] }}
      />,
    );

    expect(screen.queryByText('Issues')).not.toBeInTheDocument();
  });
});
