/**
 * Summary Grid Component
 * Displays multiple system summary cards in a responsive layout
 */
import Box from '@mui/material/Box';
import { SummaryPerRepo } from '../../utils/types';
import { SummaryCard } from './SummaryCard';

// Type definition for message data structure
type MessagesBySystem = Record<string, SummaryPerRepo[]>;

/**
 * Props for the summary grid component
 */
interface SummaryGridProps {
  filteredMessages: MessagesBySystem;
  repoSearch: string;
  handleDownload: (system: string) => void;
}

export const SummaryGrid = ({
  filteredMessages,
  repoSearch,
  handleDownload,
}: SummaryGridProps) => {
  return (
    <Box sx={{ paddingBottom: '20px' }}>
      {/* Responsive grid layout - single column on small screens, two columns on medium+ */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr',
            md: '1fr 1fr',
          },
          gap: 2,
        }}
      >
        {/* Sort systems alphabetically and render a card for each */}
        {Object.entries(filteredMessages)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([system, repos]) => (
            <SummaryCard
              key={system}
              system={system}
              repos={repos}
              repoSearch={repoSearch}
              handleDownload={handleDownload}
            />
          ))}
      </Box>
    </Box>
  );
};
