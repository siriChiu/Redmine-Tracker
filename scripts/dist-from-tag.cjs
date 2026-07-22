const { execFileSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function run(command, args) {
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function currentReleaseVersion() {
  let tag;

  try {
    tag = execFileSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    throw new Error(
      'npm run dist must be run from a commit with an exact Git tag, such as v1.2.3.'
    );
  }

  const version = tag.replace(/^v/i, '');
  const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  if (!semver.test(version)) {
    throw new Error(`Tag "${tag}" is not a supported release tag. Use v1.2.3 or 1.2.3.`);
  }

  return version;
}

const version = currentReleaseVersion();
console.log(`Building release version ${version} from the current Git tag.`);

run('npm', ['run', 'build:backend']);
run('npm', ['run', 'build']);
run('npx', [
  'electron-builder',
  `--config.extraMetadata.version=${version}`,
  '--config.artifactName=${productName}-${version}-${arch}.${ext}',
]);
