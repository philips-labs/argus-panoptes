import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@material-ui/core';

interface ThresholdDialogProps {
  open: boolean;
  onClose: () => void;
  onExited: () => void;
  activeItem: string;
  thresholds: { [key: string]: { [metric: string]: string } };
  setThresholds: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [metric: string]: string } }>
  >;
}

export const ThresholdDialog: React.FC<ThresholdDialogProps> = ({
  open,
  onClose,
  onExited,
  activeItem,
  thresholds,
  setThresholds,
}) => {
  const itemMetrics: { [key: string]: string[] } = {
    Dependabot: ['Number of repos'],
    BlackDuck: ['Critical security risks', 'High security risks'],
    Fortify: ['Security Issues'],
    SonarQube: ['Bugs', 'Vulnerabilities', 'Code Smells', 'Code Coverage %'],
    CodeScene: ['Score', 'System'],
    'Reporting Pipeline': ['Reports Generated'],
    'Pre-Production pipelines': ['Deployment Success Rate'],
    'Foundation Pipelines': ['Build Success Rate'],
  };

  const defaultThresholds: { [key: string]: { [metric: string]: string } } = {
    SonarQube: {
      Bugs: '0',
      Vulnerabilities: '0',
      'Code Smells': '0',
      'Code Coverage %': '80',
    },
    CodeScene: {
      Score: '80',
      System: '80',
    },
    BlackDuck: {
      'Critical security risks': '0',
      'High security risks': '0',
    },
  };

  const currentMetrics = itemMetrics[activeItem] || [];

  const handleThresholdChange = (metric: string, value: string) => {
    setThresholds(prev => ({
      ...prev,
      [activeItem]: {
        ...prev[activeItem],
        [metric]: value,
      },
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={onExited}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Set Thresholds for {activeItem}</DialogTitle>
      <DialogContent>
        {currentMetrics.map(metric => (
          <TextField
            key={metric}
            label={metric}
            fullWidth
            margin="dense"
            variant="outlined"
            type="number"
            value={thresholds[activeItem]?.[metric] || ''}
            onChange={e => handleThresholdChange(metric, e.target.value)}
            placeholder={defaultThresholds[activeItem]?.[metric] || ''}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="primary" variant="contained" onClick={onClose}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
