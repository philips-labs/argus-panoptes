import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import TextField from '@mui/material/TextField';

// Defines the props interface for the Filters component.
interface FiltersProps {
  allSystems: string[]; // An array of all available system names for the dropdown.
  selectedSystem: string; // The currently selected system in the dropdown.
  onSystemChange: (value: string) => void; // Callback function to handle system selection changes.
  repoSearch: string; // The current value of the repository search input.
  onRepoSearchChange: (value: string) => void; // Callback function to handle changes in the repo search input.
}

/**
 * Filters is a presentational component that provides UI controls for filtering summaries.
 * It includes a dropdown to select a system and a text field to search for repositories.
 */
export const Filters = ({
  allSystems,
  selectedSystem,
  onSystemChange,
  repoSearch,
  onRepoSearchChange,
}: FiltersProps) => {
  // Handles changes to the system selection dropdown.
  const handleSystemChange = (event: SelectChangeEvent) => {
    onSystemChange(event.target.value);
  };

  // Handles changes to the repository search text field.
  const handleRepoSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onRepoSearchChange(event.target.value);
  };

  // Renders the layout for the filter controls.
  return (
    <Box sx={{ display: 'flex', gap: 2, marginBottom: 4 }}>
      {/* The FormControl and Select components create the system filter dropdown. */}
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id="system-filter-label">System</InputLabel>
        <Select
          labelId="system-filter-label"
          value={selectedSystem}
          label="System"
          onChange={handleSystemChange}
        >
          {/* Map over the allSystems array to create a MenuItem for each system. */}
          {allSystems.map(system => (
            <MenuItem key={system} value={system}>
              {system}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* The TextField component provides the repository search input. */}
      <TextField
        label="Search Repo"
        variant="outlined"
        value={repoSearch}
        onChange={handleRepoSearchChange}
      />
    </Box>
  );
};
