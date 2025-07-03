import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Filters } from './Filters';
import { useState } from 'react';

describe('Filters component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all system options', async () => {
    render(
      <Filters
        allSystems={['System A', 'System B', 'System C']}
        selectedSystem="System A"
        onSystemChange={() => {}}
        repoSearch=""
        onRepoSearchChange={() => {}}
      />,
    );

    // Open the select dropdown (async click)
    await userEvent.click(screen.getByLabelText(/system/i));

    // Now check options are in the DOM (use findByRole to wait)
    for (const system of ['System A', 'System B', 'System C']) {
      expect(
        await screen.findByRole('option', { name: system }),
      ).toBeInTheDocument();
    }
  });

  test('calls onSystemChange when a system is selected', async () => {
    const onSystemChange = jest.fn();

    render(
      <Filters
        allSystems={['System A', 'System B', 'System C']}
        selectedSystem="System A"
        onSystemChange={onSystemChange}
        repoSearch=""
        onRepoSearchChange={() => {}}
      />,
    );

    // Open dropdown menu first
    await userEvent.click(screen.getByLabelText(/system/i));

    // Now click on the option
    await userEvent.click(screen.getByRole('option', { name: 'System B' }));

    // Check callback was called with correct value
    expect(onSystemChange).toHaveBeenCalledWith('System B');
  });
  test('calls onRepoSearchChange when typing in search input', async () => {
    const onRepoSearchChange = jest.fn();

    const Wrapper = () => {
      const [repoSearch, setRepoSearch] = useState('');
      return (
        <Filters
          allSystems={['System A', 'System B']}
          selectedSystem="System A"
          onSystemChange={() => {}}
          repoSearch={repoSearch}
          onRepoSearchChange={val => {
            onRepoSearchChange(val);
            setRepoSearch(val);
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByLabelText('Search Repo');

    await userEvent.type(input, 'test');

    expect(onRepoSearchChange).toHaveBeenCalledTimes(4);
    expect(onRepoSearchChange).toHaveBeenNthCalledWith(1, 't');
    expect(onRepoSearchChange).toHaveBeenNthCalledWith(2, 'te');
    expect(onRepoSearchChange).toHaveBeenNthCalledWith(3, 'tes');
    expect(onRepoSearchChange).toHaveBeenNthCalledWith(4, 'test');
  });
});
