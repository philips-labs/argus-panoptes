import { SonarCloudUtils, DEFAULT_METRICS } from '../sonarCloudUtils';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef, Entity } from '@backstage/catalog-model';

// Mock the TechInsightsApi
const mockTechInsightsApi = {
  getFacts: jest.fn(),
  getCheckResultRenderers: jest.fn(),
  getAllChecks: jest.fn(),
  runChecks: jest.fn(),
  runBulkChecks: jest.fn(),
  getFactSchemas: jest.fn(),
} as jest.Mocked<TechInsightsApi>;

// Mock entity references
const mockEntityRef: CompoundEntityRef = {
  kind: 'Component',
  namespace: 'default',
  name: 'test-service',
};

describe('SonarCloudUtils', () => {
  let sonarCloudUtils: SonarCloudUtils;

  beforeEach(() => {
    sonarCloudUtils = new SonarCloudUtils();
    jest.clearAllMocks();
  });

  describe('getSonarQubeFacts', () => {
    it('should return parsed metrics when facts are available', async () => {
      const mockFacts = {
        bugs: '5',
        code_smells: '10',
        vulnerabilities: '2',
        code_coverage: '85.5',
        quality_gate: 'OK',
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        'sonarcloud-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await sonarCloudUtils.getSonarQubeFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(mockTechInsightsApi.getFacts).toHaveBeenCalledWith(mockEntityRef, [
        'sonarcloud-fact-retriever',
      ]);
      expect(result).toEqual({
        bugs: 5,
        code_smells: 10,
        vulnerabilities: 2,
        code_coverage: 85.5,
        quality_gate: 'OK',
      });
    });

    it('should handle missing facts gracefully', async () => {
      const mockFacts = {
        bugs: null,
        code_smells: null,
        vulnerabilities: '3',
        code_coverage: null,
        quality_gate: null,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        'sonarcloud-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await sonarCloudUtils.getSonarQubeFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        bugs: 0,
        code_smells: 0,
        vulnerabilities: 3,
        code_coverage: 0,
        quality_gate: 'NONE',
      });
    });

    it('should return default metrics when no facts are found', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'sonarcloud-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {},
        },
      });

      const result = await sonarCloudUtils.getSonarQubeFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when response is undefined', async () => {
      mockTechInsightsApi.getFacts.mockResolvedValue({});

      const result = await sonarCloudUtils.getSonarQubeFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should return default metrics when API throws an error', async () => {
      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await sonarCloudUtils.getSonarQubeFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual(DEFAULT_METRICS);
    });

    it('should handle non-numeric values appropriately', async () => {
      const mockFacts = {
        bugs: 'not-a-number',
        code_smells: '',
        vulnerabilities: 'invalid',
        code_coverage: 'NaN',
        quality_gate: 123,
      };

      mockTechInsightsApi.getFacts.mockResolvedValue({
        'sonarcloud-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: mockFacts,
        },
      });

      const result = await sonarCloudUtils.getSonarQubeFacts(
        mockTechInsightsApi,
        mockEntityRef,
      );

      expect(result).toEqual({
        bugs: 0, // Number('not-a-number') becomes NaN, fallback to 0
        code_smells: 0, // Number('') becomes 0
        vulnerabilities: 0, // Number('invalid') becomes NaN, fallback to 0
        code_coverage: 0, // Number('NaN') becomes NaN, fallback to 0
        quality_gate: '123',
      });
    });
  });

  describe('getTop5CriticalSonarCloudRepos', () => {
    const createMockEntity = (name: string): Entity => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name, namespace: 'default' },
      spec: { type: 'service' },
    });

    it('should prioritize repositories with failed quality gates', async () => {
      const entities = [
        createMockEntity('service-1'),
        createMockEntity('service-2'),
        createMockEntity('service-3'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'ERROR',
              vulnerabilities: '1',
              bugs: '1',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '10',
              bugs: '10',
              code_smells: '10',
              code_coverage: '50',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'ERROR',
              vulnerabilities: '2',
              bugs: '2',
              code_smells: '2',
              code_coverage: '80',
            },
          },
        });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(3);
      // Failed quality gates should come first
      expect(result[0].entity.name).toBe('service-1');
      expect(result[0].quality_gate).toBe(1);
      expect(result[1].entity.name).toBe('service-3');
      expect(result[1].quality_gate).toBe(1);
      // Then repositories with vulnerabilities
      expect(result[2].entity.name).toBe('service-2');
      expect(result[2].quality_gate).toBe(0);
    });

    it('should prioritize by vulnerabilities when quality gates are equal', async () => {
      const entities = [
        createMockEntity('low-vuln'),
        createMockEntity('high-vuln'),
        createMockEntity('medium-vuln'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '2',
              bugs: '1',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '10',
              bugs: '1',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '5',
              bugs: '1',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(3);
      expect(result[0].entity.name).toBe('high-vuln');
      expect(result[0].vulnerabilities).toBe(10);
      expect(result[1].entity.name).toBe('medium-vuln');
      expect(result[1].vulnerabilities).toBe(5);
      expect(result[2].entity.name).toBe('low-vuln');
      expect(result[2].vulnerabilities).toBe(2);
    });

    it('should prioritize by bugs when vulnerabilities are equal', async () => {
      const entities = [
        createMockEntity('low-bugs'),
        createMockEntity('high-bugs'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '2',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '10',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(2);
      expect(result[0].entity.name).toBe('high-bugs');
      expect(result[0].bugs).toBe(10);
      expect(result[1].entity.name).toBe('low-bugs');
      expect(result[1].bugs).toBe(2);
    });

    it('should prioritize by code smells when bugs are equal', async () => {
      const entities = [
        createMockEntity('low-smells'),
        createMockEntity('high-smells'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '5',
              code_coverage: '90',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '15',
              code_coverage: '90',
            },
          },
        });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(2);
      expect(result[0].entity.name).toBe('high-smells');
      expect(result[0].code_smells).toBe(15);
      expect(result[1].entity.name).toBe('low-smells');
      expect(result[1].code_smells).toBe(5);
    });

    it('should prioritize by low code coverage', async () => {
      const entities = [
        createMockEntity('high-coverage'),
        createMockEntity('low-coverage'),
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '0',
              code_coverage: '95',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '0',
              code_coverage: '60',
            },
          },
        });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(2);
      expect(result[0].entity.name).toBe('low-coverage');
      expect(result[0].code_coverage).toBe(60);
      expect(result[1].entity.name).toBe('high-coverage');
      expect(result[1].code_coverage).toBe(95);
    });

    it('should limit results to 5 repositories', async () => {
      const entities = Array.from({ length: 10 }, (_, i) =>
        createMockEntity(`service-${i}`),
      );

      // Mock all entities to have failed quality gates
      mockTechInsightsApi.getFacts.mockResolvedValue({
        'sonarcloud-fact-retriever': {
          timestamp: '2023-10-01T00:00:00Z',
          version: '1.0.0',
          facts: {
            quality_gate: 'ERROR',
            vulnerabilities: '1',
            bugs: '1',
            code_smells: '1',
            code_coverage: '90',
          },
        },
      });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(5);
    });

    it('should handle API errors gracefully', async () => {
      const entities = [createMockEntity('failing-service')];

      mockTechInsightsApi.getFacts.mockRejectedValue(new Error('API Error'));

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(1);
      expect(result[0].entity.name).toBe('failing-service');
      expect(result[0].quality_gate).toBe(1); // Should assume failed quality gate
      expect(result[0].vulnerabilities).toBe(0);
      expect(result[0].bugs).toBe(0);
      expect(result[0].code_smells).toBe(0);
      expect(result[0].code_coverage).toBe(0);
    });

    it('should handle empty entities array', async () => {
      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        [],
      );

      expect(result).toHaveLength(0);
      expect(mockTechInsightsApi.getFacts).not.toHaveBeenCalled();
    });

    it('should handle mixed scenarios with complex prioritization', async () => {
      const entities = [
        createMockEntity('perfect-repo'), // No issues
        createMockEntity('failed-gate'), // Failed quality gate
        createMockEntity('high-vulns'), // High vulnerabilities
        createMockEntity('many-bugs'), // Many bugs
        createMockEntity('smelly-code'), // Code smells
        createMockEntity('low-coverage'), // Low coverage
        createMockEntity('another-failed'), // Another failed gate
      ];

      mockTechInsightsApi.getFacts
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '0',
              code_coverage: '95',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'ERROR',
              vulnerabilities: '2',
              bugs: '1',
              code_smells: '5',
              code_coverage: '80',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '15',
              bugs: '2',
              code_smells: '3',
              code_coverage: '85',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '20',
              code_smells: '1',
              code_coverage: '90',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '30',
              code_coverage: '88',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'OK',
              vulnerabilities: '0',
              bugs: '0',
              code_smells: '0',
              code_coverage: '45',
            },
          },
        })
        .mockResolvedValueOnce({
          'sonarcloud-fact-retriever': {
            timestamp: '2023-10-01T00:00:00Z',
            version: '1.0.0',
            facts: {
              quality_gate: 'ERROR',
              vulnerabilities: '1',
              bugs: '1',
              code_smells: '1',
              code_coverage: '70',
            },
          },
        });

      const result = await sonarCloudUtils.getTop5CriticalSonarCloudRepos(
        mockTechInsightsApi,
        entities,
      );

      expect(result).toHaveLength(5);

      // First should be failed quality gates
      expect(result[0].entity.name).toBe('failed-gate');
      expect(result[0].quality_gate).toBe(1);
      expect(result[1].entity.name).toBe('another-failed');
      expect(result[1].quality_gate).toBe(1);

      // Then high vulnerabilities
      expect(result[2].entity.name).toBe('high-vulns');
      expect(result[2].vulnerabilities).toBe(15);

      // Then high bugs
      expect(result[3].entity.name).toBe('many-bugs');
      expect(result[3].bugs).toBe(20);

      // Then code smells
      expect(result[4].entity.name).toBe('smelly-code');
      expect(result[4].code_smells).toBe(30);
    });
  });
});
