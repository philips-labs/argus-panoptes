import { getReposBySystem } from './getReposBySystem';
import { Entity } from '@backstage/catalog-model';

describe('getReposBySystem', () => {
  /**
   * Checks if getReposBySystemFromEntities groups entities of the
   * same system correctly using mock entities.
   */
  it('groups entities by system correctly', () => {
    /**
     * Defines mock entities.
     */
    const mockEntities: Entity[] = [
      {
        apiVersion: '1',
        kind: 'Component',
        metadata: { name: 'comp-a', namespace: 'default' },
        spec: { system: 'system-1' },
      },
      {
        apiVersion: '1',
        kind: 'Component',
        metadata: { name: 'comp-b' },
        spec: { system: 'system-2' },
      },
      {
        apiVersion: '1',
        kind: 'Component',
        metadata: { name: 'comp-c', namespace: 'custom' },
        spec: { system: 'system-1' },
      },
    ];

    /**
     * Get's the response of the getReposBySystemFromEntities
     * function on the mock entities.
     */
    const result = getReposBySystem(mockEntities);

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({
      'system-1': [
        { name: 'comp-a', namespace: 'default', kind: 'Component' },
        { name: 'comp-c', namespace: 'custom', kind: 'Component' },
      ],
      'system-2': [{ name: 'comp-b', namespace: 'default', kind: 'Component' }],
    });
  });

  /**
   * Checks if the getReposBySystemFromEntities function
   * correctly ignores entities that do not contain a system
   * by using mock entities.
   */
  it('ignores entities without a valid system string', () => {
    /**
     * Creates mock entities with no system.
     */
    const mockEntities: Entity[] = [
      {
        apiVersion: '1',
        kind: 'Component',
        metadata: { name: 'comp-x' },
        spec: { system: 123 }, // invalid system
      },
    ];

    /**
     * Get's the response of the getReposBySystemFromEntities
     * function on the mock entities.
     */
    const result = getReposBySystem(mockEntities);

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({});
  });
});
