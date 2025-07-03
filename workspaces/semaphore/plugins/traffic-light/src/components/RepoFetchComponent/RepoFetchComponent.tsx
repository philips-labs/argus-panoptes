import { useEffect } from 'react';

interface Props {
  onData: (repos: { name: string; description: string }[]) => void;
}

export const RepoFetchComponent: React.FC<Props> = ({ onData }) => {
  useEffect(() => {
    const fetchRepos = async () => {
      const response = await fetch(
        'https://api.github.com/orgs/philips-labs/repos',
      );
      const data = await response.json();

      const simplified = data.map((repo: any) => ({
        name: repo.name,
        description: repo.description ?? 'No description',
      }));

      onData(simplified); // This must be a function
    };

    fetchRepos();
  }, [onData]);

  return null;
};
