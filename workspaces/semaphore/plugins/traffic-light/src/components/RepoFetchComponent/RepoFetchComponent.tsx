import { FC, useEffect } from 'react';

interface Props {
  onData: (repos: { name: string; description: string }[]) => void;
}

export const RepoFetchComponent: FC<Props> = ({ onData }) => {
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/orgs/philips-labs/repos',
        );
        const data = await response.json();

        // console.log('Full repo data:', data);

        const simplified = data.map((repo: any) => ({
          name: repo.name,
          description: repo.description || 'No description',
        }));

        onData(simplified); // This must be a function
      } catch (err) {
        // console.error('Failed to fetch repos:', err);
      }
    };

    fetchRepos();
  }, [onData]);

  return null;
};
