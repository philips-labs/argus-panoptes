import { determineSemaphoreColor } from './utils';

describe('determineSemaphoreColor', () => {
  it('returns green when there are no failures', () => {
    const result = determineSemaphoreColor(0, 5, 0.5);
    expect(result.color).toBe('green');
    expect(result.reason).toMatch(/All 5 entities passed the check/);
  });

  it('returns red when failures exceed red threshold', () => {
    const result = determineSemaphoreColor(3, 5, 0.5); // 3 > 2.5 threshold
    expect(result.color).toBe('red');
    expect(result.reason).toMatch(
      /3 out of 5 entities failed.*threshold of 50.0%/,
    );
  });

  it('returns yellow when failures are within threshold', () => {
    const result = determineSemaphoreColor(2, 5, 0.5); // 2 == 2.5, so not exceeding
    expect(result.color).toBe('yellow');
    expect(result.reason).toMatch(
      /2 out of 5 entities failed.*threshold of 50.0%/,
    );
  });

  it('returns red when a single failure exceeds threshold with 1 total entity', () => {
    const result = determineSemaphoreColor(1, 1, 0.5); // 1 > 0.5
    expect(result.color).toBe('red');
    expect(result.reason).toMatch(
      /1 out of 1 entity failed.*threshold of 50.0%/,
    );
  });

  it('returns correct singular/plural wording for one entity', () => {
    const green = determineSemaphoreColor(0, 1, 0.5);
    expect(green.reason).toMatch(/1 entity passed/);

    const red = determineSemaphoreColor(1, 1, 0.5);
    expect(red.reason).toMatch(/1 out of 1 entity failed/);
  });
});
