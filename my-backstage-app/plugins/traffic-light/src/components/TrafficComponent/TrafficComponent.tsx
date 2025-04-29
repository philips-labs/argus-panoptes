import React, { useState } from 'react';
import {
  Typography,
  Grid,
  Box,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@material-ui/core';
import {
  Header,
  Page,
  Content,
  HeaderLabel,
  InfoCard,
} from '@backstage/core-components';
import { RepoFetchComponent } from '../RepoFetchComponent';

const TrafficLight = ({ color }: { color: 'red' | 'green' | 'yellow' }) => (
  <Box my={1} width={20} height={20} borderRadius="50%" bgcolor={color} />
);

export const TrafficComponent = () => {
  const [repos, setRepos] = useState<{ name: string; description: string }[]>(
    [],
  );
  const [selectedRepo, setSelectedRepo] = useState('');
  const selected = repos.find(r => r.name === selectedRepo);

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
                  <TrafficLight color="green" />
                  <Typography variant="subtitle1">BlackDuck</Typography>
                  <TrafficLight color="red" />
                  <Typography variant="subtitle1">Fortify</Typography>
                  <TrafficLight color="yellow" />
                </InfoCard>
              </Grid>

              {/* Software Quality */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Software Quality">
                  <Typography variant="subtitle1">SonarQube</Typography>
                  <TrafficLight color="green" />
                  <Typography variant="subtitle1">CodeScene</Typography>
                  <TrafficLight color="red" />
                </InfoCard>
              </Grid>

              {/* Reporting Pipelines */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Reporting Pipelines">
                  <Typography variant="subtitle1">
                    Reporting Pipeline
                  </Typography>
                  <TrafficLight color="green" />
                </InfoCard>
              </Grid>

              {/* Environment */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Pre-Production Environment status">
                  <Typography variant="subtitle1">
                    Pre-Production pipelines
                  </Typography>
                  <TrafficLight color="green" />
                </InfoCard>
              </Grid>

              {/* Foundation pipelines */}
              <Grid item xs={12} md={6}>
                <InfoCard title="Foundation pipelines">
                  <Typography variant="subtitle1">
                    Foundation Pipelines
                  </Typography>
                  <TrafficLight color="green" />
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
