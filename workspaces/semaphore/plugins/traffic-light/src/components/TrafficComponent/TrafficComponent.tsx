import { useState, useEffect, useRef } from 'react';
import {
  Typography,
  Grid,
  Box,
  IconButton,
  TextField,
  MenuItem,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Popover,
  Button,
} from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import SearchIcon from '@material-ui/icons/Search';
import FilterListIcon from '@material-ui/icons/FilterList';
import { Page, Content, InfoCard } from '@backstage/core-components';

import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import {
  TrafficLightDependabot,
  GitHubSecurityTrafficLight,
  SonarQubeTrafficLight,
  PreproductionTrafficLight,
  FoundationTrafficLight,
  AzureDevOpsBugsTrafficLight,
  BlackDuckTrafficLight,
  BaseTrafficLight,
} from '../Semaphores';
import { ReportingTrafficLight } from '../Semaphores/ReportingTrafficLight';
import { DialogComponent } from '../SemaphoreDialogs/DialogComponent';
import { BlackDuckSemaphoreDialog } from '../SemaphoreDialogs/BlackDuckSemaphoreDialog';
import { GitHubSemaphoreDialog } from '../SemaphoreDialogs/GitHubAdvancedSecurityDialog';
import { AzureDevOpsSemaphoreDialog } from '../SemaphoreDialogs/AzureDevOpsDialog';
import { SonarQubeSemaphoreDialog } from '../SemaphoreDialogs/SonarQubeDialog';
import { PreproductionSemaphoreDialog } from '../SemaphoreDialogs/PreProductionDialog';
import { FoundationSemaphoreDialog } from '../SemaphoreDialogs/FoundationDialog';
import { ReportingSemaphoreDialog } from '../SemaphoreDialogs/ReportingDialog';
import { DependabotSemaphoreDialog } from '../SemaphoreDialogs/DependabotSemaphoreDialog';

export const TrafficComponent = () => {
  const catalogApi = useApi(catalogApiRef);
  const systemMenuButtonRef = useRef<HTMLButtonElement>(null);

  const [repos, setRepos] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogItems, setDialogItems] = useState<any[]>([]);
  // const [setDetailedDialogOpen] = useState(false);
  // const [currentSemaphoreType, setCurrentSemaphoreType] = useState('');
  const [onlyMyRepos, setOnlyMyRepos] = useState(true);
  const [onlyCritical, setOnlyCritical] = useState(true);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [availableSystems, setAvailableSystems] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [systemSearchTerm, setSystemSearchTerm] = useState<string>('');
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  // New state for specific semaphore dialogs
  const [preproductionDialogOpen, setPreproductionDialogOpen] = useState(false);
  const [foundationDialogOpen, setFoundationDialogOpen] = useState(false);
  const [reportingDialogOpen, setReportingDialogOpen] = useState(false);

  const [azureDevOpsDialogOpen, setAzureDevOpsDialogOpen] = useState(false);
  const [sonarQubeDialogOpen, setSonarQubeDialogOpen] = useState(false);

  // New state for specific semaphore dialogs
  const [blackDuckDialogOpen, setBlackDuckDialogOpen] = useState(false);
  const [githubSecurityDialogOpen, setGithubSecurityDialogOpen] =
    useState(false);
  const [DependabotDialogOpen, setDependabotDialogOpen] = useState(false);

  const handleClick = (title: string, items: any[]) => {
    setDialogTitle(title);
    setDialogItems(items);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
  };

  const handleSemaphoreClick = (semaphoreType: string) => {
    switch (semaphoreType) {
      case 'BlackDuck':
        setBlackDuckDialogOpen(true);
        break;
      case 'Github Advanced Security':
        setGithubSecurityDialogOpen(true);
        break;

      case 'Azure DevOps Bugs':
        setAzureDevOpsDialogOpen(true);
        break;
      case 'SonarQube':
        setSonarQubeDialogOpen(true);
        break;
      case 'Dependabot':
        setDependabotDialogOpen(true);
        break;
      case 'Pre-Production pipelines':
        setPreproductionDialogOpen(true);
        break;
      case 'Foundation pipelines':
        setFoundationDialogOpen(true);
        break;
      case 'Reporting Pipeline':
        setReportingDialogOpen(true);
        break;
      case 'CodeScene':
        // For these, use the existing detailed dialog
        // setCurrentSemaphoreType(semaphoreType);
        handleClick('CodeScene Details', []);
        // setDetailedDialogOpen(true);
        break;
      default:
      // console.warn(`No dialog handler for semaphore type: ${semaphoreType}`);
    }
  };

  // const handleCloseDetailedDialog = () => {
  //   setDetailedDialogOpen(false);
  // };

  const handleCloseBlackDuckDialog = () => {
    setBlackDuckDialogOpen(false);
  };

  const handleCloseGithubSecurityDialog = () => {
    setGithubSecurityDialogOpen(false);
  };

  const handleClosePreproductionDialog = () => {
    setPreproductionDialogOpen(false);
  };

  const handleCloseFoundationDialog = () => {
    setFoundationDialogOpen(false);
  };

  const handleCloseReportingDialog = () => {
    setReportingDialogOpen(false);
  };

  const handleCloseAzureDevOpsDialog = () => {
    setAzureDevOpsDialogOpen(false);
  };

  const handleCloseSonarQubeDialog = () => {
    setSonarQubeDialogOpen(false);
  };

  const handleCloseDependabotDialog = () => {
    setDependabotDialogOpen(false);
  };

  const cardAction = (title: string, items: any[]) => (
    <IconButton onClick={() => handleClick(title, items)}>
      <MoreVertIcon />
    </IconButton>
  );

  useEffect(() => {
    const fetchCatalogRepos = async () => {
      try {
        const entities = await catalogApi.getEntities({
          filter: { kind: 'Component' },
        });
        const simplified = entities.items.map((entity: Entity) => ({
          name: entity.metadata.name,
          description: entity.metadata.description ?? 'No description',
          owner:
            typeof entity.spec?.owner === 'string'
              ? entity.spec.owner.toLowerCase()
              : undefined,
          system:
            typeof entity.spec?.system === 'string'
              ? entity.spec.system
              : undefined,
          tags: entity.metadata?.tags,
          entity: entity,
        }));

        setRepos(simplified);
        const systems = Array.from(
          new Set(
            simplified.map(repo => repo.system).filter(Boolean) as string[],
          ),
        ).sort();
        setAvailableSystems(systems);
        if (systems.length > 0) {
          const initialSystem = systems[0];
          setSelectedSystem(initialSystem);
        }
      } catch (err) {
        // console.error('Failed to load catalog entities', err);
      }
    };

    fetchCatalogRepos();
  }, [catalogApi]);

  useEffect(() => {
    const filtered = repos.filter(repo => {
      const isMine = !onlyMyRepos || repo.owner === 'philips-labs';
      const isCritical = !onlyCritical || repo.tags?.includes('critical');
      const isInSelectedSystem =
        selectedSystem === 'all' || repo.system === selectedSystem;
      return isMine && isCritical && isInSelectedSystem;
    });

    setSelectedRepos(filtered.map(r => r.name));
    setSelectedEntities(filtered.map(r => r.entity));
  }, [onlyMyRepos, onlyCritical, repos, selectedSystem]);

  const filteredSystems = availableSystems.filter(system =>
    system.toLowerCase().includes(systemSearchTerm.toLowerCase()),
  );

  return (
    <Page themeId="tool">
      <Content>
        <Box display="flex" mb={3} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={
              <Checkbox
                checked={onlyMyRepos}
                onChange={() => setOnlyMyRepos(prev => !prev)}
                color="primary"
              />
            }
            label="My repositories"
            style={{ marginRight: '2rem' }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={onlyCritical}
                onChange={() => setOnlyCritical(prev => !prev)}
                color="primary"
              />
            }
            label="Critical"
            style={{ marginRight: '2rem' }}
          />

          <Box style={{ minWidth: 200 }}>
            <Button
              ref={systemMenuButtonRef}
              variant="outlined"
              onClick={() => setSystemMenuOpen(true)}
              startIcon={<FilterListIcon />}
              fullWidth
            >
              {selectedSystem || 'Select System'}
            </Button>
            <Popover
              open={systemMenuOpen}
              anchorEl={systemMenuButtonRef.current}
              onClose={() => setSystemMenuOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              PaperProps={{ style: { width: '300px', maxHeight: '400px' } }}
            >
              <Box p={2}>
                <TextField
                  placeholder="Search systems..."
                  fullWidth
                  value={systemSearchTerm}
                  onChange={e => setSystemSearchTerm(e.target.value)}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box overflow="auto" maxHeight="300px">
                {filteredSystems.map(system => (
                  <MenuItem
                    key={system}
                    onClick={() => {
                      setSelectedSystem(system);
                      setSystemMenuOpen(false);
                    }}
                    selected={selectedSystem === system}
                  >
                    {system}
                  </MenuItem>
                ))}
                {filteredSystems.length === 0 && (
                  <Box p={2}>
                    <Typography variant="body2" color="textSecondary">
                      No systems found
                    </Typography>
                  </Box>
                )}
              </Box>
            </Popover>
          </Box>
        </Box>

        {selectedRepos.length > 0 && (
          <Box mb={4}>
            <InfoCard title={`Selected Repositories (${selectedRepos.length})`}>
              <Box maxHeight={200} overflow="auto" p={1}>
                <Grid container spacing={1}>
                  {selectedRepos.map(repo => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={repo}>
                      <Typography variant="body2">
                        <Box
                          bgcolor="rgba(0, 0, 0, 0.04)"
                          p={1}
                          borderRadius={1}
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          title={repo}
                        >
                          {repo}
                        </Box>
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </InfoCard>
          </Box>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <InfoCard
              title="Security Checks"
              action={cardAction('Security Checks', [])}
            >
              <Typography variant="subtitle1">Dependabot</Typography>
              <TrafficLightDependabot
                entities={selectedEntities}
                systemName={selectedSystem}
                onClick={() => handleSemaphoreClick('Dependabot')}
              />

              <Typography variant="subtitle1">BlackDuck</Typography>
              <BlackDuckTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('BlackDuck')}
              />

              <Typography variant="subtitle1">
                Github Advanced Security
              </Typography>
              <GitHubSecurityTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('Github Advanced Security')}
              />
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard title="Pipelines" action={cardAction('Pipelines', [])}>
              <Typography variant="subtitle1">Reporting Pipelines</Typography>
              <ReportingTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('Reporting Pipeline')}
              />

              <Typography variant="subtitle1">
                Pre-production Pipelines
              </Typography>
              <PreproductionTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('Pre-Production pipelines')}
              />

              <Typography variant="subtitle1">Foundation Pipelines</Typography>
              <FoundationTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('Foundation pipelines')}
              />
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard
              title="Software Quality"
              action={cardAction('Software Quality', [])}
            >
              <Typography variant="subtitle1">SonarQube</Typography>
              <SonarQubeTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('SonarQube')}
              />

              <Typography variant="subtitle1">CodeScene</Typography>
              <BaseTrafficLight
                color="yellow"
                tooltip="CodeScene code quality status"
                onClick={() => handleSemaphoreClick('CodeScene')}
              />
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoCard
              title="Azure DevOps"
              action={cardAction('Azure DevOps', [])}
            >
              <Typography variant="subtitle1">Bugs</Typography>
              <AzureDevOpsBugsTrafficLight
                entities={selectedEntities}
                onClick={() => handleSemaphoreClick('Azure DevOps Bugs')}
              />
            </InfoCard>
          </Grid>
        </Grid>

        {/* Existing generic dialogs */}
        <DialogComponent
          open={dialogOpen}
          onClose={handleClose}
          title={dialogTitle}
          items={dialogItems}
        />

        <GitHubSemaphoreDialog
          open={githubSecurityDialogOpen}
          onClose={handleCloseGithubSecurityDialog}
          entities={selectedEntities}
        />

        <PreproductionSemaphoreDialog
          open={preproductionDialogOpen}
          onClose={handleClosePreproductionDialog}
          entities={selectedEntities}
        />

        <FoundationSemaphoreDialog
          open={foundationDialogOpen}
          onClose={handleCloseFoundationDialog}
          entities={selectedEntities}
        />

        <ReportingSemaphoreDialog
          open={reportingDialogOpen}
          onClose={handleCloseReportingDialog}
          entities={selectedEntities}
        />

        <AzureDevOpsSemaphoreDialog
          open={azureDevOpsDialogOpen}
          onClose={handleCloseAzureDevOpsDialog}
          entities={selectedEntities}
        />

        <SonarQubeSemaphoreDialog
          open={sonarQubeDialogOpen}
          onClose={handleCloseSonarQubeDialog}
          entities={selectedEntities}
        />

        <BlackDuckSemaphoreDialog
          open={blackDuckDialogOpen}
          onClose={handleCloseBlackDuckDialog}
          entities={selectedEntities}
        />

        <DependabotSemaphoreDialog
          open={DependabotDialogOpen}
          system={selectedSystem}
          onClose={handleCloseDependabotDialog}
          entities={selectedEntities}
        />
      </Content>
    </Page>
  );
};
