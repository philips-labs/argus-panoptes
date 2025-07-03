import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshIcon from '@mui/icons-material/Refresh';
import { keyframes } from '@emotion/react';
import { generateSummaries } from '../../utils/createAISummary';
import { postSummaries } from '../../utils/saveToDatabase';
import { getReposBySystem } from '../../utils/getReposBySystem';
import { getCommitMessagesBySystem } from '../../utils/getCommitMessagesBySystem';
import { SummaryPerRepo } from '../../utils/types';
import { SummaryGrid } from './SummaryGrid';
import { Filters } from './Filters';

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

type MessagesBySystem = Record<string, SummaryPerRepo[]>;

export const AISummaries = () => {
  const catalogApi = useApi(catalogApiRef);
  const techInsightsApi = useApi(techInsightsApiRef);
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [messagesBySystem, setMessagesBySystem] =
    useState<MessagesBySystem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSystem, setSelectedSystem] = useState<string>('All');
  const [repoSearch, setRepoSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Memoize today to prevent unnecessary recalculations
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const callAI = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiBaseUrl = await discoveryApi.getBaseUrl('ai-plugin');
      const { items: entities } = await catalogApi.getEntities({
        filter: { kind: 'Component' },
      });

      const systemToEntityRefs = getReposBySystem(entities);
      const commitMessagesBySystem = await getCommitMessagesBySystem(
        techInsightsApi,
        systemToEntityRefs,
      );

      const result = await generateSummaries(
        commitMessagesBySystem,
        apiBaseUrl,
        fetchApi.fetch,
      );

      await postSummaries(result, today, apiBaseUrl, fetchApi.fetch);
      setMessagesBySystem(result);
    } catch {
      setError('Failed to generate AI summaries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [today, discoveryApi, catalogApi, techInsightsApi, fetchApi]);

  const fetchSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiBaseUrl = await discoveryApi.getBaseUrl('ai-plugin');
      const { items: systems } = await catalogApi.getEntities({
        filter: { kind: 'System' },
      });

      const res = await fetchApi.fetch(`${apiBaseUrl}/summaries?date=${today}`);

      if (res.ok) {
        const data: Record<string, SummaryPerRepo[]> = await res.json();

        // Ensure all systems have an entry
        for (const entity of systems) {
          const systemName = entity.metadata.name;
          if (!(systemName in data)) {
            data[systemName] = [];
          }
        }

        setMessagesBySystem(data);

        const hasAnyData = Object.values(data).some(repos => repos.length > 0);
        if (!hasAnyData) {
          await callAI(); // generate AI if summaries are empty
        }
      } else {
        throw new Error(
          `Failed to fetch summaries: ${res.status} ${res.statusText}`,
        );
      }
    } catch {
      setError('Failed to fetch summaries. Generating new ones...');
      await callAI(); // fallback in case of failure
    } finally {
      setLoading(false);
    }
  }, [today, discoveryApi, catalogApi, fetchApi, callAI]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const allSystems = useMemo(
    () => ['All', ...Object.keys(messagesBySystem ?? {})],
    [messagesBySystem],
  );

  const getFilteredMessages = useCallback((): MessagesBySystem => {
    if (!messagesBySystem) return {};

    const result: MessagesBySystem = {};
    for (const [system, repos] of Object.entries(messagesBySystem)) {
      if (selectedSystem !== 'All' && system !== selectedSystem) continue;
      result[system] = repos;
    }
    return result;
  }, [messagesBySystem, selectedSystem]);

  const filteredMessages = useMemo(
    () => getFilteredMessages(),
    [getFilteredMessages],
  );

  const handleDownload = useCallback(
    (system: string) => {
      const data = messagesBySystem?.[system]
        ?.map(repo => `${repo.repoName}:\n${repo.summary}\n\n`)
        .join('');

      const blob = new Blob([data ?? ''], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${system}-summaries.txt`;
      link.click();
    },
    [messagesBySystem],
  );

  // Conditional rendering function to avoid nested ternary
  const renderContent = useCallback(() => {
    if (loading || !messagesBySystem) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" mt={5}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading release notes...</Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" mt={5}>
          <Typography variant="body1" color="error">
            {error}
          </Typography>
        </Box>
      );
    }

    if (Object.keys(filteredMessages).length === 0) {
      return (
        <Typography variant="body1" color="text.secondary">
          No systems match your filters.
        </Typography>
      );
    }

    return (
      <SummaryGrid
        filteredMessages={filteredMessages}
        repoSearch={repoSearch}
        handleDownload={handleDownload}
      />
    );
  }, [
    loading,
    messagesBySystem,
    error,
    filteredMessages,
    repoSearch,
    handleDownload,
  ]);

  return (
    <Box sx={{ padding: 4 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}
      >
        <Typography variant="h4" color="text.primary" sx={{ flexGrow: 1 }}>
          AI Generated Release Notes
        </Typography>
        <IconButton
          onClick={callAI}
          disabled={loading}
          aria-label="refresh"
          sx={{
            backgroundColor: 'transparent',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
            padding: 1,
          }}
        >
          <RefreshIcon
            sx={{ animation: loading ? `${spin} 1s linear infinite` : 'none' }}
          />
        </IconButton>
      </Box>

      <Filters
        allSystems={allSystems}
        selectedSystem={selectedSystem}
        onSystemChange={setSelectedSystem}
        repoSearch={repoSearch}
        onRepoSearchChange={setRepoSearch}
      />

      {renderContent()}
    </Box>
  );
};
