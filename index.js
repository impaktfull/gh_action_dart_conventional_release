const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const yaml = require('js-yaml');
const semver = require('semver');
const exec = require('@actions/exec');

// Change working directory if user defined PACKAGEJSON_DIR
if (process.env.PACKAGEJSON_DIR) {
  process.chdir(`${process.env.GITHUB_WORKSPACE}/${process.env.PACKAGEJSON_DIR}`);
}

// Helper function to read and parse the pubspec.yaml file
function getPubspec() {
  const pubspecContent = fs.readFileSync('pubspec.yaml', 'utf8');
  return yaml.safeLoad(pubspecContent);
}

// Helper function to write updates to the pubspec.yaml file
function updatePubspec(version) {
  let pubspec = getPubspec();
  pubspec.version = version;
  fs.writeFileSync('pubspec.yaml', yaml.safeDump(pubspec), 'utf8');
}

// Increment version based on the type (major, minor, patch)
function incrementVersion(currentVersion, type) {
  return semver.inc(currentVersion, type);
}

async function run() {
  try {
    const pubspec = getPubspec();
    const event = github.context.payload;

    const messages = event.commits.map(commit => commit.message + '\n' + commit.body);

    const commitMessage = 'version bump to';
    const isVersionBump = messages.map(message => message.toLowerCase().includes(commitMessage)).includes(true);
    if (isVersionBump) {
      core.info('No action necessary!');
      return;
    }

    let versionType = 'patch';
    if (messages.map(message => message.includes('BREAKING CHANGE') || message.includes('major')).includes(true)) {
      versionType = 'major';
    } else if (messages.map(
      message => message.toLowerCase().startsWith('feat') || message.toLowerCase().includes('minor')).includes(true)) {
      versionType = 'minor';
    }

    const currentVersion = pubspec.version.toString();
    const newVersion = incrementVersion(currentVersion, versionType);
    updatePubspec(newVersion);

    // Setting up Git
    await exec.exec('git', ['config', 'user.name', 'Dart Conventional Release']);
    await exec.exec('git', ['config', 'user.email', 'gh_action_dart_conventional_release@github.com']);

    // Committing changes
    await exec.exec('git', ['add', 'pubspec.yaml']);
    await exec.exec('git', ['commit', '-m', `ci: ${commitMessage} ${newVersion}`]);

    // Tagging the commit
    const tag = `v${newVersion}`;
    await exec.exec('git', ['tag', tag]);

    // Pushing changes
    const token = core.getInput('GITHUB_TOKEN', { required: true });
    const remoteRepo = `https://${token}:x-oauth-basic@github.com/${process.env.GITHUB_REPOSITORY}.git`;
    await exec.exec('git', ['push', remoteRepo]);
    await exec.exec('git', ['push', remoteRepo, '--tags']);

  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

run();
