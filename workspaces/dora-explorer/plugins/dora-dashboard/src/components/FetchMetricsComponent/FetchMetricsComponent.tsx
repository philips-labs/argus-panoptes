import { useState, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';

// Type definitions for DORA metrics data
export type DataPoint = {
  key: string;
  value: number;
  date?: Date;
};

export type MetricData = {
  id: string;
  dataPoints: DataPoint[];
};

// DORA metrics configuration
const METRIC_TYPES = [
  { id: 'df', label: 'Deploy Freq Avg' },
  { id: 'mltc', label: 'Lead Time Median' },
  { id: 'cfr', label: 'Change Failure Rate' },
  { id: 'mttr', label: 'Time to Restore' },
];

/**
 * Custom hook to fetch available projects from the DORA dashboard API
 * Uses Backstage's discovery API to get the correct base URL !!!!
 */
export function useProjects() {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);

  return useAsync(async (): Promise<string[]> => {
    try {
      // Get the base URL for the dora-dashboard plugin
      const apiBaseUrl = await discoveryApi.getBaseUrl('dora-dashboard');
      const url = `${apiBaseUrl}/projects`;

      // Use Backstage's authenticated fetch ! - inspect go to network and see the headers
      const response = await fetch(url);

      if (!response.ok) {
        return [];
      }

      const projects = await response.json();
      return Array.isArray(projects) ? projects : [];
    } catch (error) {
      return [];
    }
  }, []);
}

/**
 * Custom hook to fetch DORA metrics data with configurable aggregation and date ranges
 * @param aggregation - 'daily' or 'monthly' data aggregation
 * @param startDate - Optional start date (defaults based on aggregation)
 * @param endDate - Optional end date (defaults to current date)
 * @param projects - Array of project names to fetch metrics for
 */
export function useMetricsData(
  aggregation: 'daily' | 'monthly' = 'monthly',
  startDate?: Date,
  endDate?: Date,
  projects: string[] = ['project1'],
) {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);

  return useAsync(async (): Promise<MetricData[]> => {
    // Skip API calls if no projects are selected
    if (projects.length === 0) {
      return [];
    }

    try {
      // Set default date ranges based on aggregation type
      const getDefaultDates = () => {
        const end = new Date();
        const start = new Date();

        if (aggregation === 'daily') {
          // Daily: last 14 days
          start.setDate(start.getDate() - 14);
        } else {
          // Monthly: last 6 months
          start.setMonth(start.getMonth() - 6);
        }

        return { start, end };
      };

      const { start: defaultStart, end: defaultEnd } = getDefaultDates();
      const start = startDate ?? defaultStart;
      const end = endDate ?? defaultEnd;

      // Convert dates to Unix timestamps for API
      const startTimestamp = Math.floor(start.getTime() / 1000);
      const endTimestamp = Math.floor(end.getTime() / 1000);
      const projectParam = projects.join(',');

      const apiBaseUrl = await discoveryApi.getBaseUrl('dora-dashboard');

      // Fetch all metrics in parallel
      const results = await Promise.all(
        METRIC_TYPES.map(async metric => {
          const url = `${apiBaseUrl}/metrics/${metric.id}/${aggregation}/${startTimestamp}/${endTimestamp}?projects=${projectParam}`;

          try {
            const response = await fetch(url);

            if (!response.ok) {
              return {
                id: metric.id,
                dataPoints: [],
              };
            }

            const json = await response.json();

            // Transform API response to DataPoint format
            const dataPoints: DataPoint[] = (json || []).map((dp: any) => {
              let date: Date | undefined;

              if (dp.data_key) {
                if (aggregation === 'daily') {
                  // Daily format: YYYY-MM-DD
                  date = new Date(`${dp.data_key}T00:00:00`);
                } else {
                  // Monthly format: YYYY-MM
                  date = new Date(`${dp.data_key}-01T00:00:00`);
                }
              }

              return {
                key: dp.data_key,
                value: dp.data_value,
                date: date,
              };
            });

            // Sort data points by date for consistent ordering
            dataPoints.sort((a, b) => {
              if (!a.date || !b.date) return 0;
              return a.date.getTime() - b.date.getTime();
            });

            return {
              id: metric.id,
              dataPoints,
            };
          } catch (error) {
            return {
              id: metric.id,
              dataPoints: [],
            };
          }
        }),
      );

      return results;
    } catch (error) {
      return [];
    }
  }, [
    aggregation,
    startDate?.getTime(),
    endDate?.getTime(),
    JSON.stringify(projects),
  ]);
}

/**
 * Example component demonstrating how to fetch and display DORA metrics data
 * This component provides a UI for selecting projects, aggregation type, and viewing the raw data
 */
export const FetchMetricsComponent = () => {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [aggregation, setAggregation] = useState<'daily' | 'monthly'>(
    'monthly',
  );
  const [shouldFetch, setShouldFetch] = useState(false);

  // Fetch available projects on component mount
  const {
    value: availableProjects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjects();

  // Auto-select first project when projects are loaded
  useEffect(() => {
    if (
      availableProjects &&
      availableProjects.length > 0 &&
      selectedProjects.length === 0
    ) {
      setSelectedProjects([availableProjects[0]]);
    }
  }, [availableProjects, selectedProjects.length]);

  // Handle project selection changes
  const handleProjectChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedProjects(typeof value === 'string' ? value.split(',') : value);
  };

  // Handle aggregation type changes
  const handleAggregationChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setAggregation(event.target.value as 'daily' | 'monthly');
    setShouldFetch(false); // Reset fetch state when changing aggregation
  };

  // Trigger data fetch
  const handleFetch = () => {
    setShouldFetch(true);
  };

  // Reset fetch state
  const handleReset = () => {
    setShouldFetch(false);
  };

  // Only fetch metrics when user explicitly requests it
  const { value, loading, error } = useMetricsData(
    aggregation,
    undefined,
    undefined,
    shouldFetch ? selectedProjects : [],
  );

  // Render the data display content
  const renderContent = () => {
    if (!shouldFetch) {
      return (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Click "Fetch Data" to load metrics for the selected projects with{' '}
          {aggregation} aggregation.
        </Typography>
      );
    }

    if (loading) return <div>Loading {aggregation} data...</div>;
    if (error) return <div>Error: {error.message}</div>;

    if (!value || value.length === 0) {
      return <div>No data available</div>;
    }

    // Transform data for display - combine all metrics by time period
    const allKeys = new Set<string>();
    const metricMaps = value.map(metric => {
      const map: Record<string, number> = {};
      for (const dp of metric.dataPoints) {
        map[dp.key] = dp.value;
        allKeys.add(dp.key);
      }
      return map;
    });

    // Create rows with all metrics for each time period
    const rows = Array.from(allKeys).map(key => {
      const row: { key: string; [metric: string]: number | string } = { key };
      METRIC_TYPES.forEach((metric, i) => {
        row[metric.label] = metricMaps[i][key] ?? 0;
      });
      return row;
    });

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Fetched Data ({aggregation === 'daily' ? 'Daily' : 'Monthly'}{' '}
          Aggregation)
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Projects: {selectedProjects.join(', ')} | Data points: {rows.length}
        </Typography>
        <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
          <pre style={{ overflow: 'auto', fontSize: '12px' }}>
            {JSON.stringify(rows, null, 2)}
          </pre>
        </Paper>
      </Box>
    );
  };

  // Handle loading and error states for projects
  if (projectsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body1">Loading available projects...</Typography>
      </Box>
    );
  }

  if (projectsError) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body1" color="error">
          Error loading projects: {projectsError.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        DORA Metrics Example Fetch Component
      </Typography>

      <Typography variant="body1" sx={{ mb: 2 }}>
        This component demonstrates how to fetch DORA metrics data. For visual
        charts, use <strong>DoraDashboard</strong>.
      </Typography>

      <Box sx={{ mb: 3 }}>
        {/* Aggregation Selection */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Data Aggregation
          </Typography>
          <RadioGroup
            row
            value={aggregation}
            onChange={handleAggregationChange}
          >
            <FormControlLabel value="daily" control={<Radio />} label="Daily" />
            <FormControlLabel
              value="monthly"
              control={<Radio />}
              label="Monthly"
            />
          </RadioGroup>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {aggregation === 'daily'
              ? 'Daily view shows last 14 days by default'
              : 'Monthly view shows last 6 months by default'}
          </Typography>
        </Box>

        {/* Project Selection */}
        <FormControl fullWidth sx={{ mb: 2, maxWidth: 400 }}>
          <InputLabel id="project-select-label">Select Projects</InputLabel>
          <Select
            labelId="project-select-label"
            multiple
            value={selectedProjects}
            onChange={handleProjectChange}
            input={<OutlinedInput label="Select Projects" />}
            renderValue={selected => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map(project => (
                  <Chip key={project} label={project} size="small" />
                ))}
              </Box>
            )}
          >
            {(availableProjects || []).map(project => (
              <MenuItem key={project} value={project}>
                {project}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleFetch}
            disabled={selectedProjects.length === 0}
          >
            Fetch {aggregation === 'daily' ? 'Daily' : 'Monthly'} Data
          </Button>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={!shouldFetch}
          >
            Reset
          </Button>
        </Box>
      </Box>

      {/* Data Display */}
      {renderContent()}
    </Box>
  );
};
