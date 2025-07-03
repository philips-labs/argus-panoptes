import { render, screen } from '@testing-library/react';
import { TrafficLightPage } from './TrafficLightPage';

describe('TrafficLightPage', () => {
  it('renders without crashing', () => {
    render(<TrafficLightPage />);
    expect(screen.getByText('Traffic Light Plugin')).toBeInTheDocument();
    expect(
      screen.getByText('Welcome to the Traffic Light plugin page!'),
    ).toBeInTheDocument();
  });

  it('contains an h1 heading', () => {
    render(<TrafficLightPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Traffic Light Plugin');
  });

  it('contains a welcome paragraph', () => {
    render(<TrafficLightPage />);
    const paragraph = screen.getByText(
      /welcome to the traffic light plugin page!/i,
    );
    expect(paragraph).toBeInTheDocument();
  });
});
