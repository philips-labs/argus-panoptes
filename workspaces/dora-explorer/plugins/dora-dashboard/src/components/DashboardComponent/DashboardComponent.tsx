import { Grid } from '@material-ui/core';
import { Header, Page, Content, HeaderLabel } from '@backstage/core-components';
import { DoraDashboard } from '../DoraDashboard';

export const DashboardComponent = () => (
  <Page themeId="tool">
    <Header
      title="DORA Metrics Dashboard"
      subtitle="Monitor your DevOps performance metrics"
    >
      <HeaderLabel label="Owner" value="DevOps Team" />
      <HeaderLabel label="Lifecycle" value="Beta" />
    </Header>
    <Content>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <DoraDashboard />
        </Grid>
      </Grid>
    </Content>
  </Page>
);
