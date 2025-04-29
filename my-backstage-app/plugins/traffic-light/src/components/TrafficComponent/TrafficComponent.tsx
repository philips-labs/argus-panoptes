import React, { useState, useEffect } from 'react';
import {
  Typography,
  Grid,
  Box,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Tooltip,
} from '@material-ui/core';
import {
  Header,
  Page,
  Content,
  HeaderLabel,
  InfoCard,
} from '@backstage/core-components';
import { RepoFetchComponent } from '../RepoFetchComponent';

import { fetchRepoStatus, StatusResponse } from '../api/mockStatusApi';

const TrafficLight = ({ color }: { color: 'red' | 'green' | 'yellow' }) => (
  <Box my={1} width={20} height={20} borderRadius="50%" bgcolor={color} />
);

export const TrafficComponent = () => {
  const [repos, setRepos] = useState<{ name: string; description: string }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);

  const selected = repos.find(r => r.name === selectedRepo);

  useEffect(() => {
    if (selectedRepo) {
      fetchRepoStatus(selectedRepo).then(data => setStatusData(data));
    }
  }, [selectedRepo]);

  return (
    <Page themeId="tool">
      <Header title="Traffic light plugin" subtitle="">
        <Box width={300} ml={4}>
          <FormControl fullWidth size="small" variant="outlined">
            <InputLabel id="repo-select-label">Repository</InputLabel>
            <Select
              labelId="repo-select-label"
              value={selectedRepo}
              onChange={e => setSelectedRepo(e.target.value as string)}
              label="Repository"
            >
              {repos.map(repo => (
                <MenuItem key={repo.name} value={repo.name}>
                  {repo.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Header>

      <Content>
        {selected && (
          <>
            {/* Repo Info */}
            <Box mb={4}>
              <InfoCard title="GitHub Repository">
                <Typography variant="h6">{selected.name}</Typography>
                <Typography variant="body2">{selected.description}</Typography>
              </InfoCard>
            </Box>

            <Grid container spacing={3}>
              {/* Security */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Security Checks">
                  <Typography variant="subtitle1">Dependabot</Typography>
                  <Tooltip title={statusData?.Dependabot?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.Dependabot?.color || 'yellow'} />
                    </div>
                  </Tooltip>

                  <Typography variant="subtitle1">BlackDuck</Typography>
                  <Tooltip title={statusData?.BlackDuck?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.BlackDuck?.color || 'yellow'} />
                    </div>
                  </Tooltip>

                  <Typography variant="subtitle1">Fortify</Typography>
                  <Tooltip title={statusData?.Fortify?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.Fortify?.color || 'yellow'} />
                    </div>
                  </Tooltip>
                </InfoCard>
              </Grid>

              {/* Software Quality */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Software Quality">
                  <Typography variant="subtitle1">SonarQube</Typography>
                  <Tooltip title={statusData?.SonarQube?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.SonarQube?.color || 'yellow'} />
                    </div>
                  </Tooltip>

                  <Typography variant="subtitle1">CodeScene</Typography>
                  <Tooltip title={statusData?.CodeScene?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.CodeScene?.color || 'yellow'} />
                    </div>
                  </Tooltip>
                </InfoCard>
              </Grid>

              {/* Reporting Pipelines */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Reporting Pipelines">
                  <Typography variant="subtitle1">Reporting Pipeline</Typography>
                  <Tooltip title={statusData?.['Reporting Pipeline']?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.['Reporting Pipeline']?.color || 'yellow'} />
                    </div>
                  </Tooltip>
                </InfoCard>
              </Grid>

              {/* Pre-Production Environment */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Pre-Production Environment Status">
                  <Typography variant="subtitle1">Pre-Production pipelines</Typography>
                  <Tooltip title={statusData?.['Pre-Production pipelines']?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.['Pre-Production pipelines']?.color || 'yellow'} />
                    </div>
                  </Tooltip>
                </InfoCard>
              </Grid>

              {/* Foundation Pipelines */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Foundation Pipelines">
                  <Typography variant="subtitle1">Foundation Pipelines</Typography>
                  <Tooltip title={statusData?.['Foundation Pipelines']?.reason || ''}>
                    <div>
                      <TrafficLight color={statusData?.['Foundation Pipelines']?.color || 'yellow'} />
                    </div>
                  </Tooltip>
                </InfoCard>
              </Grid>
            </Grid>
          </>
        )}

        {/* Hidden fetcher */}
        <RepoFetchComponent onData={setRepos} />
      </Content>
    </Page>
  );
};
