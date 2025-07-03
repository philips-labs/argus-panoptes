import { getSeverityColorHex, Severity } from '../types';

describe('getSeverityColorHex', () => {
  // Test cases for each defined severity level.
  const testCases: [Severity, string][] = [
    ['critical', '#d32f2f'],
    ['high', '#f44336'],
    ['medium', '#ff9800'],
    ['low', '#2196f3'],
  ];

  // Use it.each to run the same test logic for each severity level.
  it.each(testCases)(
    'should return the correct color for %s severity',
    (severity, expectedColor) => {
      // Call the function with the severity and expect the correct hex color.
      expect(getSeverityColorHex(severity)).toBe(expectedColor);
    },
  );

  it('should return the default color for an unknown severity', () => {
    // We cast an invalid string to the Severity type to test the default case.
    const unknownSeverity = 'unknown' as Severity;

    // Expect the function to return the gray fallback color.
    expect(getSeverityColorHex(unknownSeverity)).toBe('#757575');
  });
});
