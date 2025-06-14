import { FC, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Typography,
  Button,
  Box,
} from '@material-ui/core';
import { ThresholdDialog } from './TresholdDialogComponent';

interface DialogComponentProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: { name: string; color: string }[];
}

export const DialogComponent: FC<DialogComponentProps> = ({
  open,
  onClose,
  title,
  items,
}) => {
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string>('');
  const [thresholds, setThresholds] = useState<{
    [key: string]: { [metric: string]: string };
  }>({});

  const handleOpenThresholdDialog = (name: string) => {
    setActiveItem(name);
    setThresholdDialogOpen(true);
  };

  const handleCloseThresholdDialog = () => {
    setThresholdDialogOpen(false);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          {items.map((item, index) => (
            <Box key={item.name} mb={2}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box display="flex" alignItems="center">
                  <Box
                    width={20}
                    height={20}
                    borderRadius="50%"
                    bgcolor={item.color}
                    mr={1}
                  />
                  <Typography variant="subtitle1">{item.name}</Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleOpenThresholdDialog(item.name)}
                >
                  Set thresholds
                </Button>
              </Box>
              {index < items.length - 1 && (
                <Divider style={{ marginTop: 12 }} />
              )}
            </Box>
          ))}
        </DialogContent>
      </Dialog>

      <ThresholdDialog
        open={thresholdDialogOpen}
        onClose={handleCloseThresholdDialog}
        onExited={() => setActiveItem('')}
        activeItem={activeItem}
        thresholds={thresholds}
        setThresholds={setThresholds}
      />
    </>
  );
};
