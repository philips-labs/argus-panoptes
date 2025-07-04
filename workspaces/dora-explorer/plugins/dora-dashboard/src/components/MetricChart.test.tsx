import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MetricChart } from './MetricChart';

// Format values based on metric type
function formatValue(metricType: string, value: any): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  switch (metricType) {
    case 'df':
      return String(numValue);
    case 'mltc':
      return numValue.toFixed(1);
    case 'mttr':
      return numValue.toFixed(1);
    case 'cfr':
      return `${(numValue * 100).toFixed(1)}%`;
    default:
      return String(numValue);
  }
}

// Mock the BarChart
jest.mock('@mui/x-charts/BarChart', () => ({
  BarChart: jest.fn(({ series, xAxis, yAxis, height, margin, grid }) => (
    <div
      data-testid="bar-chart"
      data-series={JSON.stringify(series)}
      data-x-axis={JSON.stringify(xAxis)}
      data-y-axis={JSON.stringify(yAxis)}
      data-height={height}
      data-margin={JSON.stringify(margin)}
      data-grid={JSON.stringify(grid)}
    >
      Mock BarChart
    </div>
  )),
}));

const mockData = [
  { label: 'Week 1', value: 10 },
  { label: 'Week 2', value: 15 },
  { label: 'Week 3', value: 8 },
];

const renderWithTheme = (component: React.ReactElement, darkMode = false) => {
  const theme = createTheme({
    palette: { mode: darkMode ? 'dark' : 'light' },
  });
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('MetricChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders title and bar chart', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={mockData} />);
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('shows description when provided', () => {
      renderWithTheme(
        <MetricChart title="Test" data={mockData} description="Some desc" />,
      );
      expect(screen.getByText('Some desc')).toBeInTheDocument();
    });

    it('hides description when not provided', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={mockData} />);
      expect(screen.queryByText('Some desc')).not.toBeInTheDocument();
    });

    it('uses default color', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={mockData} />);
      const series = JSON.parse(
        screen.getByTestId('bar-chart').getAttribute('data-series') ?? '[]',
      );
      expect(series[0].color).toBe('#00e5ff');
    });

    it('applies custom color', () => {
      renderWithTheme(
        <MetricChart title="Test" data={mockData} color="#ff0000" />,
      );
      const series = JSON.parse(
        screen.getByTestId('bar-chart').getAttribute('data-series') ?? '[]',
      );
      expect(series[0].color).toBe('#ff0000');
    });
  });

  describe('Theme Integration', () => {
    it('renders dark mode correctly', () => {
      const { container } = renderWithTheme(
        <MetricChart title="Test Chart" data={mockData} />,
        true,
      );
      const paper = container.querySelector('.MuiPaper-root');
      expect(paper).toHaveStyle('background-color: #1e1e1e');
    });

    it('renders light mode', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={mockData} />);
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
    });
  });

  describe('Data Mapping', () => {
    it('maps data to chart correctly', () => {
      renderWithTheme(<MetricChart title="Test" data={mockData} />);
      const chart = screen.getByTestId('bar-chart');
      const series = JSON.parse(chart.getAttribute('data-series') ?? '[]');
      const xAxis = JSON.parse(chart.getAttribute('data-x-axis') ?? '[]');
      expect(series[0].data).toEqual([10, 15, 8]);
      expect(xAxis[0].data).toEqual(['Week 1', 'Week 2', 'Week 3']);
    });

    it('handles empty dataset', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={[]} />);
      const chart = screen.getByTestId('bar-chart');
      const series = JSON.parse(chart.getAttribute('data-series') ?? '[]');
      expect(series[0].data).toEqual([]);
    });
  });

  describe('Y-Axis Configurations', () => {
    it.each([
      ['Deployment Frequency', ''],
      ['Lead Time for Changes', 'Hours'],
      ['Time to Restore Service', 'Hours'],
      ['Change Failure Rate', ''],
      ['Unknown Metric', 'Value'],
    ])('sets y-axis for %s', (title, expectedLabel) => {
      renderWithTheme(<MetricChart title={title} data={mockData} />);
      const chart = screen.getByTestId('bar-chart');
      const yAxis = JSON.parse(chart.getAttribute('data-y-axis') ?? '[]');
      expect(yAxis[0].label).toBe(expectedLabel);
      expect(yAxis[0].tickLabelStyle.fontSize).toBe(10);
    });

    it('sets x-axis config', () => {
      renderWithTheme(<MetricChart title="Test" data={mockData} />);
      const chart = screen.getByTestId('bar-chart');
      const xAxis = JSON.parse(chart.getAttribute('data-x-axis') ?? '[]');
      expect(xAxis[0].label).toBe('Date Range');
    });
  });

  describe('Chart Settings', () => {
    it('sets chart size and margin', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={mockData} />);
      const chart = screen.getByTestId('bar-chart');
      expect(chart.getAttribute('data-height')).toBe('240');
      expect(chart).toHaveAttribute(
        'data-margin',
        JSON.stringify({ top: 30, left: 50, bottom: 26, right: 4 }),
      );
    });

    it('enables horizontal grid', () => {
      renderWithTheme(<MetricChart title="Test Chart" data={mockData} />);
      const chart = screen.getByTestId('bar-chart');
      expect(chart).toHaveAttribute(
        'data-grid',
        JSON.stringify({ horizontal: true }),
      );
    });
  });
});

describe('formatValue utility', () => {
  it('formats Deployment Frequency', () => {
    expect(formatValue('df', 10)).toBe('10');
    expect(formatValue('df', null)).toBe('N/A');
  });

  it('formats Lead Time for Changes', () => {
    expect(formatValue('mltc', 10.25)).toBe('10.3');
  });

  it('formats Time to Restore Service', () => {
    expect(formatValue('mttr', 1.23)).toBe('1.2');
  });

  it('formats Change Failure Rate', () => {
    expect(formatValue('cfr', 0.15)).toBe('15.0%');
    expect(formatValue('cfr', 0)).toBe('0.0%');
  });

  it('handles invalid values', () => {
    expect(formatValue('df', undefined)).toBe('N/A');
    expect(formatValue('df', 'bad')).toBe('N/A');
    expect(formatValue('df', '10.5')).toBe('10.5');
  });

  it('defaults unknown metric to string value', () => {
    expect(formatValue('unknown', 10.5)).toBe('10.5');
  });
});
