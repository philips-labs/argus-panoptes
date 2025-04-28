import { Typography, Grid, Box } from '@material-ui/core';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
} from '@backstage/core-components';
import { ExampleFetchComponent } from '../ExampleFetchComponent';

export const ExampleComponent = () => (
  <Page themeId="tool">
    <Header title="Welcome to traffic-light!" subtitle="Optional subtitle">
      <HeaderLabel label="Owner" value="Team X" />
      <HeaderLabel label="Lifecycle" value="Alpha" />
    </Header>
    <Content>
      <ContentHeader title="Plugin title">
        <SupportButton>A description of your plugin goes here.</SupportButton>
      </ContentHeader>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <InfoCard title="Information card">
            <Typography variant="body1">
              All content should be wrapped in a card like this.
            </Typography>
          </InfoCard>
        </Grid>
        <Grid item>
          <ExampleFetchComponent />
        </Grid>
      </Grid>
      <Box display="flex" justifyContent="space-around" alignItems="center" mt={4}>
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        backgroundColor: 'red',
      }} />
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        backgroundColor: 'green',
      }} />
    </Box>
    </Content>
  </Page>
);
