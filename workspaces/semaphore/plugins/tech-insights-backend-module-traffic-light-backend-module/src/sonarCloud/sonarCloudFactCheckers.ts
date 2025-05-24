import { TechInsightJsonRuleCheck } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import { Config } from '@backstage/config';

/**
 * Creates a Tech Insights fact checker for the number of bugs.
 * The rule configuration is loaded from the Backstage app config.
 * @param config - The Backstage app config object.
 * @returns A TechInsightJsonRuleCheck for bugs.
 */
export const createBugsCheck = (config: Config): TechInsightJsonRuleCheck => {
  // Read configuration values for the check
  const name = config.getOptionalString('techInsights.factChecker.checks.noHighBugsCheck.name') ?? '';
  const description = config.getOptionalString('techInsights.factChecker.checks.noHighBugsCheck.description') ?? '';
  const factIds = config.getOptionalStringArray('techInsights.factChecker.checks.noHighBugsCheck.factIds') ?? [];
  
  // Extract rule condition details
  const factName = config
    .getOptionalConfig('techInsights.factChecker.checks.noHighBugsCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('fact') ?? '';
    
  const operator = config
    .getOptionalConfig('techInsights.factChecker.checks.noHighBugsCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('operator') ?? '';
  
  const value = config
    .getOptionalConfig('techInsights.factChecker.checks.noHighBugsCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getNumber('value') ?? 0.0;

  // Return the fact checker definition
  return {
    id: 'noHighBugsCheck',
    name: name,
    description: description,
    factIds: factIds,
    rule: {
        conditions: {
            all: [
                {
                    fact: factName,
                    operator: operator,
                    value: value,
                },
            ],
        },
    },
    type: 'json-rules-engine',
  };
};

/**
 * Creates a Tech Insights fact checker for the number of code smells.
 * The rule configuration is loaded from the Backstage app config.
 * @param config - The Backstage app config object.
 * @returns A TechInsightJsonRuleCheck for code smells.
 */
export const createCodeSmellsCheck = (config: Config): TechInsightJsonRuleCheck => {
  // Read configuration values for the check
  const name = config.getOptionalString('techInsights.factChecker.checks.noHighCodeSmellsCheck.name') ?? '';
  const description = config.getOptionalString('techInsights.factChecker.checks.noHighCodeSmellsCheck.description') ?? '';
  const factIds = config.getOptionalStringArray('techInsights.factChecker.checks.noHighCodeSmellsCheck.factIds') ?? [];

  // Extract rule condition details
  const factName = config
    .getOptionalConfig('techInsights.factChecker.checks.noHighCodeSmellsCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('fact') ?? '';
    
  const operator = config
    .getOptionalConfig('techInsights.factChecker.checks.noHighCodeSmellsCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('operator') ?? '';
  
  const value = config
    .getOptionalConfig('techInsights.factChecker.checks.noHighCodeSmellsCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getNumber('value') ?? 0.0;

  // Return the fact checker definition
  return {
    id: 'noHighCodeSmellsCheck',
    name: name,
    description: description,
    factIds: factIds,
    rule: {
        conditions: {
            all: [
                {
                    fact: factName,
                    operator: operator,
                    value: value,
                },
            ],
        },
    },
    type: 'json-rules-engine',
  };
};

/**
 * Creates a Tech Insights fact checker for the number of vulnerabilities.
 * The rule configuration is loaded from the Backstage app config.
 * @param config - The Backstage app config object.
 * @returns A TechInsightJsonRuleCheck for vulnerabilities.
 */
export const createVulnerabilitiesCheck = (config: Config): TechInsightJsonRuleCheck => {
  // Read configuration values for the check
  const name = config.getOptionalString('techInsights.factChecker.checks.vulnerabilitiesCheck.name') ?? '';
  const description = config.getOptionalString('techInsights.factChecker.checks.vulnerabilitiesCheck.description') ?? '';
  const factIds = config.getOptionalStringArray('techInsights.factChecker.checks.vulnerabilitiesCheck.factIds') ?? [];

  // Extract rule condition details
  const factName = config
    .getOptionalConfig('techInsights.factChecker.checks.vulnerabilitiesCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('fact') ?? '';
    
  const operator = config
    .getOptionalConfig('techInsights.factChecker.checks.vulnerabilitiesCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('operator') ?? '';
  
  const value = config
    .getOptionalConfig('techInsights.factChecker.checks.vulnerabilitiesCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getNumber('value') ?? 0.0;

  // Return the fact checker definition
  return {
    id: 'vulnerabilitiesCheck',
    name: name,
    description: description,
    factIds: factIds,
    rule: {
        conditions: {
            all: [
                {
                    fact: factName,
                    operator: operator,
                    value: value,
                },
            ],
        },
    },
    type: 'json-rules-engine',
  };
};

/**
 * Creates a Tech Insights fact checker for the quality gate status.
 * The rule configuration is loaded from the Backstage app config.
 * @param config - The Backstage app config object.
 * @returns A TechInsightJsonRuleCheck for quality gate.
 */
export const createQualityGateCheck = (config: Config): TechInsightJsonRuleCheck => {
  // Read configuration values for the check
  const name = config.getOptionalString('techInsights.factChecker.checks.qualityGateCheck.name') ?? '';
  const description = config.getOptionalString('techInsights.factChecker.checks.qualityGateCheck.description') ?? '';
  const factIds = config.getOptionalStringArray('techInsights.factChecker.checks.qualityGateCheck.factIds') ?? [];

  // Extract rule condition details
  const factName = config
    .getOptionalConfig('techInsights.factChecker.checks.qualityGateCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('fact') ?? '';
    
  const operator = config
    .getOptionalConfig('techInsights.factChecker.checks.qualityGateCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('operator') ?? '';
  
  const value = config
    .getOptionalConfig('techInsights.factChecker.checks.qualityGateCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('value') ?? '';

  // Return the fact checker definition
  return {
    id: 'qualityGateCheck',
    name: name,
    description: description,
    factIds: factIds,
    rule: {
        conditions: {
            all: [
                {
                    fact: factName,
                    operator: operator,
                    value: value,
                },
            ],
        },
    },
    type: 'json-rules-engine',
  };
};

/**
 * Creates a Tech Insights fact checker for the code coverage.
 * The rule configuration is loaded from the Backstage app config.
 * @param config - The Backstage app config object.
 * @returns A TechInsightJsonRuleCheck for code coverage.
 */
export const createCodeCoverageCheck = (config: Config): TechInsightJsonRuleCheck => {
  // Read configuration values for the check
  const name = config.getOptionalString('techInsights.factChecker.checks.codeCoverageCheck.name') ?? '';
  const description = config.getOptionalString('techInsights.factChecker.checks.codeCoverageCheck.description') ?? '';
  const factIds = config.getOptionalStringArray('techInsights.factChecker.checks.codeCoverageCheck.factIds') ?? [];

  // Extract rule condition details
  const factName = config
    .getOptionalConfig('techInsights.factChecker.checks.codeCoverageCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('fact') ?? '';
    
  const operator = config
    .getOptionalConfig('techInsights.factChecker.checks.codeCoverageCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getString('operator') ?? '';
  
  const value = config
    .getOptionalConfig('techInsights.factChecker.checks.codeCoverageCheck.rule.conditions')
    ?.getConfigArray('all')[0]
    ?.getNumber('value') ?? 0.0;

  // Return the fact checker definition
  return {
    id: 'codeCoverageCheck',
    name: name,
    description: description,
    factIds: factIds,
    rule: {
        conditions: {
            all: [
                {
                    fact: factName,
                    operator: operator,
                    value: value,
                },
            ],
        },
    },
    type: 'json-rules-engine',
  };
};
