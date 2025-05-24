import { useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { generateSummaries } from '../../utils/createAISummary';
import { postSummaries } from '../../utils/saveToDatabase';

import { keyframes } from '@emotion/react';

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

import { GoogleGenAI } from '@google/genai';

import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import IconButton from '@mui/material/IconButton';
import { SummaryPerRepo } from '../../utils/types';
import { getReposBySystem } from '../../utils/getReposBySystem';
import { getCommitMessagesBySystem } from '../../utils/getCommitMessagesBySystem';

type MessagesBySystem = Record<string, SummaryPerRepo[]>;

export const CommitMessageTestPage = () => {
  const catalogApi = useApi(catalogApiRef);
  const techInsightsApi = useApi(techInsightsApiRef);
  const [messagesBySystem, setMessagesBySystem] =
    useState<MessagesBySystem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSystem, setSelectedSystem] = useState<string>('All');
  const [repoSearch, setRepoSearch] = useState<string>('');
  const { fetch } = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const fetchSummaries = async () => {
    const { items: entities } = await catalogApi.getEntities({
      filter: { kind: 'Component' },
    });
    const systemToEntityRefs = getReposBySystem(entities);
    const commitMessagesBySystem = await getCommitMessagesBySystem(
      techInsightsApi,
      systemToEntityRefs,
    );

    const apiBaseUrl = await discoveryApi.getBaseUrl('ai-plugin');

    const today = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch(`${apiBaseUrl}/summaries?date=${today}`);

      if (res.ok) {
        const data: Record<string, SummaryPerRepo[]> = await res.json();
        if (Object.keys(data).length > 0) {
          setMessagesBySystem(data);
          setLoading(false);
          return;
        }
      } else {
        console.warn('GET /summaries returned non-OK status:', res.status);
      }
    } catch (err) {
      console.error('Error fetching summaries:', err);
    }

    const ai = new GoogleGenAI({
      apiKey: 'AIzaSyC7PNqPNPlfa7v4obQm70xSr_XEfG1ySwA',
    });

    const result = await generateSummaries(ai, commitMessagesBySystem);
    postSummaries(result, today, apiBaseUrl, fetch);
    setMessagesBySystem(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const allSystems = ['All', ...Object.keys(messagesBySystem ?? {})];

  const getFilteredMessages = (): MessagesBySystem => {
    if (!messagesBySystem) return {};
    const result: MessagesBySystem = {};

    for (const [system, repos] of Object.entries(messagesBySystem)) {
      // System filter
      if (selectedSystem !== 'All' && system !== selectedSystem) continue;

      result[system] = repos; // include even if empty
    }

    return result;
  };

  const filteredMessages = getFilteredMessages();

  const handleDownload = (system: string) => {
    const data = messagesBySystem?.[system]
      ?.map(repo => `${repo.repoName}:\n${repo.summary}\n\n`)
      .join('');

    const blob = new Blob([data ?? ''], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${system}-summaries.txt`;
    link.click();
  };

  return (
    <Box sx={{ padding: 4 }}>
      {/* Header + Refresh */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}
      >
        <Typography variant="h4" color="text.primary" sx={{ flexGrow: 1 }}>
          AI Generated Release Notes
        </Typography>
        <IconButton
          onClick={fetchSummaries}
          aria-label="refresh"
          sx={{
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            boxShadow: 'none',
            padding: 1,
          }}
        >
          <RefreshIcon
            sx={{
              animation: loading ? `${spin} 1s linear infinite` : 'none',
            }}
          />
        </IconButton>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, marginBottom: 4 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="system-filter-label">System</InputLabel>
          <Select
            labelId="system-filter-label"
            value={selectedSystem}
            label="System"
            onChange={e => setSelectedSystem(e.target.value)}
          >
            {allSystems.map(system => (
              <MenuItem key={system} value={system}>
                {system}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Search Repo"
          variant="outlined"
          value={repoSearch}
          onChange={e => setRepoSearch(e.target.value)}
        />
      </Box>

      {/* Content */}
      {loading || !messagesBySystem ? (
        <Box display="flex" justifyContent="center" alignItems="center" mt={5}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading release notes...</Typography>
        </Box>
      ) : Object.keys(filteredMessages).length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No systems match your filters.
        </Typography>
      ) : (
      <Box sx={{ paddingBottom: '20px' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',      // 1 column on small screens
              sm: '1fr',      // 1 column on small-medium screens
              md: '1fr 1fr',  // 2 columns on medium and larger
            },
            gap: 2,
          }}
        >
          {Object.entries(filteredMessages).map(([system, repos]) => (
            <Card
              key={system}
              elevation={3}
              sx={{
                width: '100%',
                height: '180mm',
                position: 'relative',
              }}
            >
              {/* Download Button */}
              <IconButton
                onClick={() => handleDownload(system)}
                aria-label="download"
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                  width: 40,
                  height: 40,
                  padding: 1,
                }}
              >
                <DownloadIcon />
              </IconButton>

              <CardContent
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <Typography variant="h4" color="#83a2f2" gutterBottom>
                  {system}
                </Typography>

                <Box
                  sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {repos.length === 0 ? (
                    <Typography variant="body1" color="text.secondary">
                      No new releases.
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        backgroundColor: '#fff',
                        borderRadius: 2,
                        padding: 2,
                        boxShadow: 1,
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      {repos
                        .filter(repo =>
                          repo.repoName
                            .toLowerCase()
                            .includes(repoSearch.toLowerCase()),
                        )
                        .map(({ repoName, summary }) => (
                          <Box key={repoName} sx={{ marginBottom: 2 }}>
                            <Typography
                              variant="h5"
                              color="black"
                              gutterBottom
                            >
                              {repoName}
                            </Typography>
                            <Typography
                              variant="body1"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                fontSize: '1.2rem',
                                lineHeight: '1.5',
                                color: 'black',
                              }}
                            >
                              {summary}
                            </Typography>
                          </Box>
                        ))}
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
      )}
    </Box>
  );
};
