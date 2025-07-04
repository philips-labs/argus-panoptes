import { useState, useEffect, useRef } from 'react';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Paper from '@mui/material/Paper';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import CircularProgress from '@mui/material/CircularProgress';
import { FileDownload, PictureAsPdf, ImageOutlined } from '@mui/icons-material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import {
  useMetricsData,
  useProjects,
} from './FetchMetricsComponent/FetchMetricsComponent';
import { MetricChart } from './MetricChart';
import { SelectChangeEvent } from '@mui/material/Select';

// Metric types
type MetricType = {
  id: string;
  label: string;
  description: string;
  color: string;
};

// Aggregation options
type AggregationType = 'daily' | 'monthly';

const METRIC_TYPES: MetricType[] = [
  {
    id: 'df',
    label: 'Deployment Frequency',
    description: 'How often code is deployed to production',
    color: '#4caf50',
  },
  {
    id: 'mltc',
    label: 'Lead Time for Changes',
    description: 'Time it takes for code to go from commit to production',
    color: '#2196f3',
  },
  {
    id: 'cfr',
    label: 'Change Failure Rate',
    description: 'Percentage of deployments causing a failure in production',
    color: '#f44336',
  },
  {
    id: 'mttr',
    label: 'Time to Restore Service',
    description: 'How long it takes to recover from failures',
    color: '#ff9800',
  },
];

const AGGREGATION_OPTIONS = [
  { value: 'daily', label: 'Daily', defaultDays: 30 },
  { value: 'monthly', label: 'Monthly', defaultDays: 180 }, // ~6 months
];

export const DoraDashboard = () => {
  const [aggregation, setAggregation] = useState<AggregationType>('monthly');
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Add state to control dropdown open/close
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  // Set default date ranges based on aggregation type
  const getDefaultDateRange = (aggType: AggregationType) => {
    const endDate = new Date();
    const startDate = new Date();
    const defaultDays =
      AGGREGATION_OPTIONS.find(opt => opt.value === aggType)?.defaultDays || 30;
    startDate.setDate(startDate.getDate() - defaultDays);
    return { startDate, endDate };
  };

  const [startDate, setStartDate] = useState<Date | null>(
    () => getDefaultDateRange('monthly').startDate,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    () => getDefaultDateRange('monthly').endDate,
  );
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [filterDates, setFilterDates] = useState<{ start?: Date; end?: Date }>(
    {},
  );

  // Update date range when aggregation changes
  useEffect(() => {
    if (!useCustomDateRange) {
      const { startDate: newStart, endDate: newEnd } =
        getDefaultDateRange(aggregation);
      setStartDate(newStart);
      setEndDate(newEnd);
    }
  }, [aggregation, useCustomDateRange]);

  // Fetch available projects
  const {
    value: availableProjects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjects();

  // Set default project selection when projects are loaded
  useEffect(() => {
    if (
      availableProjects &&
      availableProjects.length > 0 &&
      selectedProjects.length === 0
    ) {
      setSelectedProjects(availableProjects);
    }
  }, [availableProjects, selectedProjects.length]);

  const {
    value: metricsData,
    loading: metricsLoading,
    error: metricsError,
  } = useMetricsData(
    aggregation,
    filterDates.start,
    filterDates.end,
    selectedProjects,
  );

  useEffect(() => {
    if (!useCustomDateRange) {
      setFilterDates({});
    }
  }, [useCustomDateRange]);

  const handleAggregationChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newAggregation = event.target.value as AggregationType;
    setAggregation(newAggregation);

    // Reset custom date range when changing aggregation
    if (!useCustomDateRange) {
      setFilterDates({});
    }
  };

  const handleDateRangeToggle = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setUseCustomDateRange(event.target.checked);
  };

  const handleProjectChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const newValue = typeof value === 'string' ? value.split(',') : value;

    if (newValue.includes('all')) {
      const allSelected =
        selectedProjects.length === (availableProjects?.length || 0);
      // Toggle behavior:
      setSelectedProjects(allSelected ? [] : availableProjects || []);
    } else {
      setSelectedProjects(newValue);
    }

    // Keep dropdown open after selection
    // Note: The dropdown will remain open due to the open prop being controlled
  };

  // Handle dropdown open/close
  const handleProjectDropdownOpen = () => {
    setProjectDropdownOpen(true);
  };

  const handleProjectDropdownClose = () => {
    setProjectDropdownOpen(false);
  };

  const handleApplyDateFilter = () => {
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        return;
      }

      setFilterDates({ start: startDate, end: endDate });
    }
  };

  // Export functions
  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportMenuAnchor(null);
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsSVG = async () => {
    if (!dashboardRef.current) return;

    setIsExporting(true);
    handleExportClose();

    try {
      // Import html2canvas and jsPDF dynamically
      const html2canvas = (await import('html2canvas')).default;

      // Create canvas from the dashboard
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
      });

      // Convert canvas to SVG
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${
          canvas.width
        }" height="${canvas.height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
              <img src="${canvas.toDataURL()}" width="${
        canvas.width
      }" height="${canvas.height}" />
            </div>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:.]/g, '-');
      downloadFile(blob, `dora-dashboard-${timestamp}.svg`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!dashboardRef.current) return;

    setIsExporting(true);
    handleExportClose();

    try {
      // Import libraries dynamically
      const html2canvas = (await import('html2canvas')).default;
      const { default: JSPDF } = await import('jspdf');

      // Create canvas from the dashboard
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new JSPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:.]/g, '-');
      pdf.save(`dora-dashboard-${timestamp}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsImage = async () => {
    if (!dashboardRef.current) return;

    setIsExporting(true);
    handleExportClose();

    try {
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
      });

      canvas.toBlob(blob => {
        if (blob) {
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[:.]/g, '-');
          downloadFile(blob, `dora-dashboard-${timestamp}.png`);
        }
      }, 'image/png');
    } finally {
      setIsExporting(false);
    }
  };

  if (projectsLoading) return <Progress />;
  if (projectsError) return <ResponseErrorPanel error={projectsError} />;
  if (metricsLoading) return <Progress />;
  if (metricsError) return <ResponseErrorPanel error={metricsError} />;

  return (
    <Box sx={{ width: '100%' }} ref={dashboardRef}>
      {/* Header with Export Options */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h4" component="h1">
          DORA Metrics Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isExporting && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Exporting...
              </Typography>
            </Box>
          )}
          <Tooltip title="Export Dashboard">
            <IconButton
              onClick={handleExportClick}
              color="primary"
              disabled={isExporting}
              sx={{
                border: 1,
                borderColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <FileDownload />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={handleExportClose}
            PaperProps={{
              sx: { mt: 1 },
            }}
          >
            <MenuItem onClick={exportAsPDF} disabled={isExporting}>
              <PictureAsPdf sx={{ mr: 2, color: 'error.main' }} />
              Export as PDF
            </MenuItem>
            <MenuItem onClick={exportAsSVG} disabled={isExporting}>
              <ImageOutlined sx={{ mr: 2, color: 'success.main' }} />
              Export as SVG
            </MenuItem>
            <MenuItem onClick={exportAsImage} disabled={isExporting}>
              <ImageOutlined sx={{ mr: 2, color: 'info.main' }} />
              Export as PNG
            </MenuItem>
          </Menu>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', mb: 3 }}>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Data Filtering Options
          </Typography>

          {/* Aggregation Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Data Aggregation
            </Typography>
            <RadioGroup
              row
              value={aggregation}
              onChange={handleAggregationChange}
              sx={{ mb: 2 }}
            >
              {AGGREGATION_OPTIONS.map(option => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
              mb: 2,
            }}
          >
            <FormControl sx={{ minWidth: 220 }} size="small">
              <InputLabel id="project-select-label">Projects</InputLabel>
              <Select
                labelId="project-select-label"
                id="project-select"
                multiple
                open={projectDropdownOpen}
                onOpen={handleProjectDropdownOpen}
                onClose={handleProjectDropdownClose}
                value={selectedProjects}
                onChange={handleProjectChange}
                input={<OutlinedInput label="Projects" />}
                renderValue={selected => {
                  if (selected.length === 0) return 'No projects selected';
                  if (selected.length === (availableProjects?.length || 0))
                    return 'All Projects';
                  if (selected.length === 1) return selected[0];
                  return `${selected.length} projects selected`;
                }}
              >
                <MenuItem value="all">
                  <Checkbox
                    checked={
                      selectedProjects.length ===
                      (availableProjects?.length || 0)
                    }
                  />
                  <ListItemText primary="All Projects" />
                </MenuItem>
                {(availableProjects || []).map(project => (
                  <MenuItem key={project} value={project}>
                    <Checkbox checked={selectedProjects.includes(project)} />
                    <ListItemText primary={project} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={useCustomDateRange}
                  onChange={handleDateRangeToggle}
                  color="primary"
                />
              }
              label="Use Custom Date Range"
            />
          </Box>

          {useCustomDateRange && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={date => setStartDate(date)}
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      fullWidth: true,
                      sx: { minWidth: 180 },
                    },
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={date => setEndDate(date)}
                  minDate={startDate ?? undefined}
                  slotProps={{
                    textField: {
                      variant: 'outlined',
                      fullWidth: true,
                      sx: { minWidth: 180 },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleApplyDateFilter}
                  sx={{ mt: { xs: 2, sm: 0 }, height: { sm: 56 } }}
                  disabled={!startDate || !endDate}
                >
                  Apply Date Filter
                </Button>
              </Box>
            </LocalizationProvider>
          )}
        </Paper>
      </Box>

      <Grid container spacing={3}>
        {METRIC_TYPES.map(metric => {
          const metricData = metricsData?.find(m => m.id === metric.id);
          const hasData = metricData && metricData.dataPoints.length > 0;

          const chartData = hasData
            ? metricData.dataPoints.map(point => ({
                label: point.key,
                value: point.value,
              }))
            : [];

          return (
            <Grid item xs={12} md={6} key={metric.id}>
              {hasData ? (
                <MetricChart
                  title={metric.label}
                  description={metric.description}
                  data={chartData}
                  color={metric.color}
                />
              ) : (
                <Paper
                  sx={{
                    p: 2,
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No data available for {metric.label} with the current filter
                    settings
                  </Typography>
                </Paper>
              )}
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
