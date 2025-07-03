import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThresholdDialog } from '../TresholdDialogComponent';

describe('ThresholdDialog', () => {
  // Mock functions for the props that the component expects.
  const mockOnClose = jest.fn();
  const mockOnExited = jest.fn();
  const mockSetThresholds = jest.fn();

  // Default props to be used in tests. Can be overridden.
  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onExited: mockOnExited,
    activeItem: 'SonarQube',
    thresholds: {},
    setThresholds: mockSetThresholds,
  };

  // Helper function to get an input field based on its visible label text.
  // This is a robust way to handle Material-UI's TextField structure.
  const getByLabel = (labelText: string | RegExp) => {
    const allElements = screen.getAllByText(labelText);
    const label = allElements.find(el => el.tagName.toLowerCase() === 'label');
    if (!label) {
      throw new Error(`Could not find a label element with text: ${labelText}`);
    }
    const formControl = label.closest('.MuiFormControl-root') as HTMLElement;
    if (!formControl) {
      throw new Error(
        `Could not find a MuiFormControl-root for label: ${labelText}`,
      );
    }
    return within(formControl).getByRole('spinbutton');
  };

  // Clear all mocks before each test to ensure a clean state.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dialog with the correct title when open', () => {
    render(<ThresholdDialog {...defaultProps} />);
    expect(
      screen.getByText('Set Thresholds for SonarQube'),
    ).toBeInTheDocument();
  });

  it('does not render the dialog when open is false', () => {
    render(<ThresholdDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Set Thresholds for SonarQube')).toBeNull();
  });

  it('renders the correct number of metric fields for the active item', () => {
    render(<ThresholdDialog {...defaultProps} activeItem="SonarQube" />);
    // Use the robust helper to find each input.
    expect(getByLabel('Bugs')).toBeInTheDocument();
    expect(getByLabel('Vulnerabilities')).toBeInTheDocument();
    expect(getByLabel('Code Smells')).toBeInTheDocument();
    expect(getByLabel('Code Coverage %')).toBeInTheDocument();
  });

  it('displays existing threshold values in the fields', () => {
    const thresholds = {
      SonarQube: {
        Bugs: '5',
        'Code Coverage %': '75',
      },
    };
    render(<ThresholdDialog {...defaultProps} thresholds={thresholds} />);
    // Assert the value of the inputs found via the helper.
    expect(getByLabel('Bugs')).toHaveValue(5);
    expect(getByLabel('Code Coverage %')).toHaveValue(75);
  });

  it('displays placeholder values for metrics with default thresholds', () => {
    render(<ThresholdDialog {...defaultProps} activeItem="SonarQube" />);
    // Assert the placeholder of the inputs found via the helper.
    expect(getByLabel('Bugs')).toHaveAttribute('placeholder', '0');
    expect(getByLabel('Code Coverage %')).toHaveAttribute('placeholder', '80');
  });

  it('calls setThresholds when a user types in a field', async () => {
    render(<ThresholdDialog {...defaultProps} activeItem="BlackDuck" />);
    const criticalRisksInput = getByLabel('Critical security risks');

    // Simulate a user typing '10' into the input field.
    // await userEvent.clear(criticalRisksInput); // Clear first
    // await userEvent.type(criticalRisksInput, '10');

    fireEvent.change(criticalRisksInput, { target: { value: '10' } });

    // Verify that the setThresholds function was called.
    expect(mockSetThresholds).toHaveBeenCalledTimes(1);

    // To test the final state update, we can inspect the last call.
    const updater = mockSetThresholds.mock.calls[0][0];
    const previousState = { BlackDuck: { 'High security risks': '5' } };
    const newState = updater(previousState);

    // The new state should have the updated value for the correct metric.
    expect(newState).toEqual({
      BlackDuck: {
        'High security risks': '5',
        'Critical security risks': '10',
      },
    });
  });

  it('calls onClose when the Cancel button is clicked', async () => {
    render(<ThresholdDialog {...defaultProps} />);
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Save button is clicked', async () => {
    render(<ThresholdDialog {...defaultProps} />);
    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders the correct metric field for an item with one metric', () => {
    render(<ThresholdDialog {...defaultProps} activeItem="Fortify" />);
    expect(getByLabel('Security Issues')).toBeInTheDocument();
  });

  it('renders no metric fields if the active item has none defined', () => {
    render(<ThresholdDialog {...defaultProps} activeItem="UnknownItem" />);
    // For an item with no metrics, no number inputs (role 'spinbutton') should be rendered.
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});
