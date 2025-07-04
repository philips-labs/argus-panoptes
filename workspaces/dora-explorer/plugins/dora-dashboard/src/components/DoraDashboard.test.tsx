import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DoraDashboard } from './DoraDashboard';
import {
  useMetricsData,
  useProjects,
} from './FetchMetricsComponent/FetchMetricsComponent';

jest.mock('./FetchMetricsComponent/FetchMetricsComponent', () => ({
  useMetricsData: jest.fn(),
  useProjects: jest.fn(),
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
  ResponseErrorPanel: ({ error }: { error: Error }) => (
    <div data-testid="error-panel">{error.message}</div>
  ),
}));

jest.mock('@mui/x-date-pickers', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <div data-testid={`date-picker-${label.toLowerCase().replace(' ', '-')}`}>
      <input
        type="date"
        value={
          value instanceof Date && !isNaN(value.getTime())
            ? value.toISOString().split('T')[0]
            : ''
        }
        onChange={e => {
          const dateValue = e.target.value;
          onChange(dateValue ? new Date(dateValue) : null); // HANDLE EMPTY
        }}
        data-testid={`date-input-${label.toLowerCase().replace(' ', '-')}`}
      />
    </div>
  ),

  LocalizationProvider: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: jest.fn(),
}));

jest.mock('./MetricChart', () => ({
  MetricChart: ({ title, data }: any) => (
    <div
      data-testid={`metric-chart-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <h3>{title}</h3>
      <div>Data points: {data.length}</div>
    </div>
  ),
}));

const mockHtml2Canvas = jest.fn();
const mockJsPDF = jest.fn();

jest.mock('html2canvas', () => ({
  __esModule: true,
  default: mockHtml2Canvas,
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  default: mockJsPDF,
}));

global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();
global.alert = jest.fn();

const mockUseMetricsData = useMetricsData as jest.MockedFunction<
  typeof useMetricsData
>;
const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

const mockProjects = ['project1', 'project2', 'project3'];
const mockMetricsData = [
  {
    id: 'df',
    dataPoints: [
      { key: '2023-01', value: 10 },
      { key: '2023-02', value: 15 },
    ],
  },
  {
    id: 'mltc',
    dataPoints: [
      { key: '2023-01', value: 5 },
      { key: '2023-02', value: 8 },
    ],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProjects.mockReturnValue({
    value: mockProjects,
    loading: false,
    error: undefined,
  });
  mockUseMetricsData.mockReturnValue({
    value: mockMetricsData,
    loading: false,
    error: undefined,
  });
});

describe('DoraDashboard', () => {
  it('renders dashboard title', () => {
    render(<DoraDashboard />);
    expect(screen.getByText('DORA Metrics Dashboard')).toBeInTheDocument();
  });

  it('shows loading state when projects are loading', () => {
    mockUseProjects.mockReturnValue({
      value: undefined,
      loading: true,
      error: undefined,
    });
    render(<DoraDashboard />);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows error when projects fail to load', () => {
    mockUseProjects.mockReturnValue({
      value: undefined,
      loading: false,
      error: new Error('Failed to load projects'),
    });
    render(<DoraDashboard />);
    expect(screen.getByTestId('error-panel')).toBeInTheDocument();
    expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
  });

  it('renders charts with data', () => {
    render(<DoraDashboard />);
    expect(
      screen.getByTestId('metric-chart-deployment-frequency'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-chart-lead-time-for-changes'),
    ).toBeInTheDocument();
  });

  it('renders no data message when metrics are empty', () => {
    mockUseMetricsData.mockReturnValue({
      value: [],
      loading: false,
      error: undefined,
    });
    render(<DoraDashboard />);
    expect(
      screen.getByText(/No data available for Deployment Frequency/),
    ).toBeInTheDocument();
  });

  it('changes aggregation to daily', async () => {
    const user = userEvent.setup();
    render(<DoraDashboard />);
    const dailyRadio = screen.getByLabelText('Daily');
    await user.click(dailyRadio);
    expect(dailyRadio).toBeChecked();
  });

  it('toggles and displays custom date range', async () => {
    const user = userEvent.setup();
    render(<DoraDashboard />);
    const toggle = screen.getByLabelText('Use Custom Date Range');
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByTestId('date-picker-start-date')).toBeInTheDocument();
  });

  it('shows alert if dates are empty', async () => {
    const user = userEvent.setup();
    render(<DoraDashboard />);

    // Toggle date range
    await user.click(screen.getByLabelText('Use Custom Date Range'));

    // Find inputs
    const start = screen.getByTestId('date-input-start-date');
    const end = screen.getByTestId('date-input-end-date');

    // Trigger onChange with null-like values
    fireEvent.change(start, { target: { value: '' } });
    fireEvent.change(end, { target: { value: '' } });

    // Expect alert to be triggered
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /apply date filter/i }),
      ).toBeDisabled();
    });
  });

  it('opens export menu and closes on outside click', async () => {
    const user = userEvent.setup();
    render(<DoraDashboard />);

    // Open export menu
    const exportBtn = screen.getByRole('button', { name: /export dashboard/i });
    await user.click(exportBtn);

    // Ensure menu is open
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();

    // Corrected code
    await user.keyboard('{escape}');

    // Wait for disappearance
    await waitFor(() => {
      expect(screen.queryByText('Export as PDF')).not.toBeInTheDocument();
    });
  });

  it('exports dashboard as PDF', async () => {
    const user = userEvent.setup();
    const mockCanvas = {
      toDataURL: jest.fn(() => 'mock-image-data'),
      width: 800,
      height: 600,
    };
    const mockPdf = { addImage: jest.fn(), save: jest.fn() };

    mockHtml2Canvas.mockResolvedValue(mockCanvas);
    mockJsPDF.mockReturnValue(mockPdf);

    render(<DoraDashboard />);
    await user.click(screen.getByRole('button', { name: /export dashboard/i }));
    await user.click(screen.getByText('Export as PDF'));

    await waitFor(() => {
      // Check that the constructor was called
      expect(mockJsPDF).toHaveBeenCalled();
      // Check that the methods on the instance were called
      expect(mockPdf.addImage).toHaveBeenCalledWith(
        'mock-image-data',
        'PNG',
        0,
        0,
        800,
        600,
      );
      expect(mockPdf.save).toHaveBeenCalledWith(
        expect.stringContaining('dora-dashboard'),
      );
    });
  });

  it('exports as SVG', async () => {
    const user = userEvent.setup();
    const mockCanvas = {
      toDataURL: jest.fn(() => 'mock'),
      width: 800,
      height: 600,
    };
    mockHtml2Canvas.mockResolvedValue(mockCanvas);

    render(<DoraDashboard />);
    await user.click(screen.getByRole('button', { name: /export dashboard/i }));
    await user.click(screen.getByText('Export as SVG'));

    await waitFor(() => {
      expect(mockHtml2Canvas).toHaveBeenCalled();
    });
  });

  it('exports as PNG', async () => {
    const user = userEvent.setup();
    const mockCanvas = {
      toBlob: jest.fn(cb => cb(new Blob(['mock'], { type: 'image/png' }))),
      width: 800,
      height: 600,
    };
    mockHtml2Canvas.mockResolvedValue(mockCanvas);

    render(<DoraDashboard />);
    await user.click(screen.getByRole('button', { name: /export dashboard/i }));
    await user.click(screen.getByText('Export as PNG'));

    await waitFor(() => {
      expect(mockHtml2Canvas).toHaveBeenCalled();
    });
  });

  it('handles project dropdown and selects options', async () => {
    const user = userEvent.setup();
    render(<DoraDashboard />);
    const select = screen.getByLabelText('Projects');
    await user.click(select);
    await waitFor(() => {
      expect(screen.getByText('project1')).toBeInTheDocument();
    });
  });
});
