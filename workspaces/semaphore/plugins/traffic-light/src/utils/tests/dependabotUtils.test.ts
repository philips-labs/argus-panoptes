import { DependabotUtils } from '../dependabotUtils';
import { CompoundEntityRef } from '@backstage/catalog-model';

const mockEntity: CompoundEntityRef = {
  kind: 'Component',
  namespace: 'default',
  name: 'test-service',
};

const mockTechInsightsApi = {
  getFacts: jest.fn(),
  runChecks: jest.fn(),
};

describe('DependabotUtils', () => {
  const utils = new DependabotUtils();

  describe('getDependabotFacts', () => {
    it('should return parsed facts correctly', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        dependabotFactRetriever: {
          timestamp: '2024-01-01T00:00:00Z',
          version: '1.0.0',
          facts: {
            critical: '3',
            high: '1',
            medium: '5',
          },
        },
      });

      const result = await utils.getDependabotFacts(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({ critical: 3, high: 1, medium: 5 });
    });

    it('should return 0s if facts are missing', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        dependabotFactRetriever: {
          timestamp: '2024-01-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await utils.getDependabotFacts(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({ critical: 0, high: 0, medium: 0 });
    });

    it('should return 0s if facts property itself is missing', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        dependabotFactRetriever: {
          timestamp: '2024-01-01T00:00:00Z',
          version: '1.0.0',
          facts: undefined,
        },
      });

      const result = await utils.getDependabotFacts(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({ critical: 0, high: 0, medium: 0 });
    });

    it('should handle errors and return default 0s', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('failure'));

      const result = await utils.getDependabotFacts(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({ critical: 0, high: 0, medium: 0 });
    });
  });

  describe('getDependabotChecks', () => {
    it('should return correct check results', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([
        {
          check: {
            id: 'dependabot-critical-alerts',
            type: 'json',
            name: 'Critical Check',
            description: '',
            factIds: [],
          },
          result: true,
        },
        {
          check: {
            id: 'dependabot-high-alerts',
            type: 'json',
            name: 'High Check',
            description: '',
            factIds: [],
          },
          result: false,
        },
        {
          check: {
            id: 'dependabot-medium-alerts',
            type: 'json',
            name: 'Medium Check',
            description: '',
            factIds: [],
          },
          result: true,
        },
      ]);

      const result = await utils.getDependabotChecks(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({
        criticalAlertCheck: true,
        highAlertCheck: false,
        mediumAlertCheck: true,
      });
    });

    it('should return false for all if checkResults is empty', async () => {
      mockTechInsightsApi.runChecks.mockResolvedValue([]);

      const result = await utils.getDependabotChecks(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({
        criticalAlertCheck: false,
        highAlertCheck: false,
        mediumAlertCheck: false,
      });
    });

    it('should handle errors and return false for all', async () => {
      mockTechInsightsApi.runChecks.mockRejectedValue(new Error('check error'));

      const result = await utils.getDependabotChecks(
        mockTechInsightsApi as any,
        mockEntity,
      );

      expect(result).toEqual({
        criticalAlertCheck: false,
        highAlertCheck: false,
        mediumAlertCheck: false,
      });
    });
  });
});
