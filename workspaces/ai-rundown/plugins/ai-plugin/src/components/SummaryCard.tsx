/**
 * Summary Card Component
 * Displays AI-generated commit summaries for a system's repositories
 */
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import { SummaryPerRepo } from '../../utils/types';

/**
 * Props for configuring the Summary Card
 */
interface SummaryCardProps {
  system: string; // System name to display
  repos: SummaryPerRepo[]; // Repository data with summaries
  repoSearch: string; // Filter text for repositories
  handleDownload: (system: string) => void; // Export handler
}

export const SummaryCard = ({
  system,
  repos,
  repoSearch,
  handleDownload,
}: SummaryCardProps) => {
  const theme = useTheme();

  // Filter repositories by search text
  const filteredRepos = repos.filter(repo =>
    repo.repoName.toLowerCase().includes(repoSearch.toLowerCase()),
  );

  return (
    <Card
      elevation={3}
      sx={{
        width: '100%',
        height: '180mm',
        position: 'relative',
        backgroundColor: theme.palette.background.paper, // Backstage card bg
      }}
    >
      {/* Download button for exporting summaries */}
      <IconButton
        onClick={() => handleDownload(system)}
        aria-label="download"
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          backgroundColor: 'transparent',
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
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
        {/* System name header */}
        <Typography variant="h4" color="primary" gutterBottom>
          {system}
        </Typography>

        {/* Scrollable content area for repository summaries */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {filteredRepos.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No new releases.
            </Typography>
          ) : (
            <Box
              sx={{
                backgroundColor: theme.palette.background.default, // Matches Backstage page background
                borderRadius: 2,
                padding: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {/* Repository summaries list */}
              {filteredRepos.map(({ repoName, summary }) => (
                <Box key={repoName} sx={{ marginBottom: 2 }}>
                  <Typography variant="h5" color="text.primary" gutterBottom>
                    {repoName}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '1.2rem',
                      lineHeight: '1.5',
                      color: theme.palette.text.primary,
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
  );
};
