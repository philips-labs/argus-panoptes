import { ReactNode, FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Divider,
  List,
  Paper,
  Chip,
  Link,
} from '@material-ui/core';
import WarningIcon from '@material-ui/icons/Warning';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import InfoIcon from '@material-ui/icons/Info';
import { SemaphoreData } from './types';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    minWidth: '500px',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  statusCircle: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    marginRight: theme.spacing(1),
  },
  metricBox: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  },
  metricValue: {
    fontWeight: 'bold',
    fontSize: '22px',
  },
  metricLabel: {
    color: theme.palette.text.secondary,
  },
  warningIcon: {
    color: theme.palette.warning.main,
    marginRight: theme.spacing(1),
  },
  errorIcon: {
    color: theme.palette.error.main,
    marginRight: theme.spacing(1),
  },
  successIcon: {
    color: theme.palette.success.main,
    marginRight: theme.spacing(1),
  },
  infoIcon: {
    color: theme.palette.info.main,
    marginRight: theme.spacing(1),
  },
  issueItem: {
    padding: theme.spacing(1, 1, 1, 2),
    marginBottom: theme.spacing(1),
    borderLeft: '4px solid', // We'll set the color dynamically
  },
  issueTitle: {
    fontWeight: 'bold',
  },
  issueLink: {
    color: 'inherit',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  chipContainer: {
    marginTop: theme.spacing(1),
    '& > *': {
      margin: theme.spacing(0.5),
    },
  },
  summarySection: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  loadingIndicator: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}));

export interface BaseSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: SemaphoreData;
  isLoading?: boolean;
  renderMetrics?: () => ReactNode;
}

export const BaseSemaphoreDialog: FC<BaseSemaphoreDialogProps> = ({
  open,
  onClose,
  title,
  data,
  isLoading = false,
  renderMetrics,
}) => {
  const classes = useStyles();

  const getStatusIcon = (color: string) => {
    switch (color) {
      case 'red':
        return <ErrorIcon className={classes.errorIcon} />;
      case 'yellow':
        return <WarningIcon className={classes.warningIcon} />;
      case 'green':
        return <CheckCircleIcon className={classes.successIcon} />;
      default:
        return <InfoIcon className={classes.infoIcon} />;
    }
  };

  const getSeverityColorHex = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#d32f2f';
      case 'high':
        return '#f44336';
      case 'medium':
        return '#ff9800';
      case 'low':
        return '#2196f3';
      default:
        return '#757575';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <Box
            width={24}
            height={24}
            borderRadius="50%"
            bgcolor={data.color}
            mr={1}
          />
          <Typography variant="h6">{title} Status</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Typography>Loading data...</Typography>
        ) : (
          <>
            <Paper variant="outlined" className={classes.summarySection}>
              <Box display="flex" alignItems="center">
                {getStatusIcon(data.color)}
                <Typography>{data.summary}</Typography>
              </Box>
            </Paper>

            {renderMetrics && renderMetrics()}

            {data.details?.length > 0 && (
              <>
                <Box mt={3} mb={1}>
                  <Typography variant="h6">Issues</Typography>
                  <Divider />
                </Box>
                <List>
                  {data.details.map((issue, index) => (
                    <Paper
                      key={index}
                      className={classes.issueItem}
                      elevation={0}
                      style={{
                        borderLeft: `4px solid ${getSeverityColorHex(
                          issue.severity,
                        )}`,
                      }}
                    >
                      <Typography variant="subtitle1">
                        {issue.url ? (
                          <Link
                            href={issue.directLink || issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {issue.description}
                          </Link>
                        ) : (
                          issue.description
                        )}
                      </Typography>
                      <Box className={classes.chipContainer}>
                        <Chip
                          size="small"
                          label={issue.severity}
                          style={{
                            backgroundColor: getSeverityColorHex(
                              issue.severity,
                            ),
                            color: '#fff',
                          }}
                        />
                        {issue.component && (
                          <Chip
                            size="small"
                            label={issue.component}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Paper>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
