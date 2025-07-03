import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(
  typeof __filename !== 'undefined' ? __filename : import.meta.url,
);

export async function loadOctokit() {
  const modulePath = require.resolve('@octokit/rest');
  const { Octokit } = await import(pathToFileURL(modulePath).toString());
  return Octokit;
}
