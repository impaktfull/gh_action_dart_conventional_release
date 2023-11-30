const core = require('@actions/core')
const github = require('@actions/github')
const exec = require('@actions/exec')
const fs = require('fs')
const yaml = require('yaml')
const semver = require('semver')

// =====================================================================
// ========================== GLOBAL CONFIG ============================
// =====================================================================

// Change working directory if user defined PACKAGEJSON_DIR
if (process.env.PACKAGEJSON_DIR) {
  process.env.GITHUB_WORKSPACE = `${process.env.GITHUB_WORKSPACE}/${process.env.PACKAGEJSON_DIR}`
  process.chdir(process.env.GITHUB_WORKSPACE)
} else if (process.env.INPUT_PACKAGEJSON_DIR) {
  process.env.GITHUB_WORKSPACE = `${process.env.GITHUB_WORKSPACE}/${process.env.INPUT_PACKAGEJSON_DIR}`
  process.chdir(process.env.GITHUB_WORKSPACE)
}

// Workspace
const workspace = process.env.GITHUB_WORKSPACE
console.log(`Current workspace: ${workspace}`)

// Github Token
const githubToken = core.getInput('github-token')
if (githubToken == null || githubToken == "") {
  core.setFailed('github-token not found as input.')
  return
}
// Github Username
const githubUsername = core.getInput('github-username')
if (githubUsername == null || githubUsername == "") {
  core.setFailed('github-username not found as input.')
  return
}

// =====================================================================
// ================================ RUN ================================
// =====================================================================
async function run() {
  try {
    await configureGit()
    await installDartDependencies()
    await executeScriptPreRun()

    const pubspec = getPubspec()
    const event = github.context.payload

    const messages = event.commits.map(commit => commit.message + '\n' + commit.body)

    const commitMessage = 'version bump to'
    const isVersionBump = messages.map(message => message.toLowerCase().includes(commitMessage)).includes(true)
    if (isVersionBump) {
      core.info('No action necessary!')
      return
    }
    core.info(`\`${event.commits.length}\` commit(s) for this version bump.`)

    let versionType = 'patch'
    if (messages.map(message => message.includes('BREAKING CHANGE') || message.includes('major')).includes(true)) {
      versionType = 'major'
    } else if (messages.map(
      message => message.toLowerCase().startsWith('feat') || message.toLowerCase().includes('minor')).includes(true)) {
      versionType = 'minor'
    }
    core.info(`${versionType} version bump!`)

    const currentVersion = pubspec.version.toString()
    const newVersion = incrementVersion(currentVersion, versionType)
    core.info(`Bumping version from ${currentVersion} to ${newVersion}`)
    updatePubspec(newVersion)

    // Verification before publishing
    await analyzeDartProject()

    // Setting up Git
    await runInWorkspace('git', ['config', 'user.name', `"${process.env.GITHUB_USER || 'Dart Conventional Release'}"`])
    await runInWorkspace('git', ['config', 'user.email', `"${process.env.GITHUB_EMAIL || 'gh_action_dart_conventional_release@users.noreply.github.com'}"`])

    // Committing changes
    await runInWorkspace('git', ['add', 'pubspec.yaml'])
    await runInWorkspace('git', ['commit', '-m', `ci: ${commitMessage} ${newVersion}`])
    // Tagging the commit
    const tag = `v${newVersion}`
    await runInWorkspace('git', ['tag', tag])

    // Pushing changes
    const remoteGitRepoUrl = `https://${githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`
    await runInWorkspace('git', ['push', remoteGitRepoUrl])
    await runInWorkspace('git', ['push', remoteGitRepoUrl, '--tags'])

  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

run()

// =====================================================================
// =============================== Utils ===============================
// =====================================================================

async function configureGit() {
  await runInWorkspace('git', ['config', '--global', '--add', 'safe.directory', workspace])
}

async function installDartDependencies() {
  await runInWorkspace('dart', ['pub', 'get'])
}

// Run a script before the action (only if configured)
async function executeScriptPreRun() {
  const path = core.getInput('script-pre-run')
  if (!path) {
    return
  }
  await runInWorkspace('dart', ['run', path])
}

// Helper function to read and parse the pubspec.yaml file
function getPubspec() {
  const pubspecContent = fs.readFileSync('pubspec.yaml', 'utf8')
  return yaml.parse(pubspecContent)
}

// Helper function to write updates to the pubspec.yaml file
function updatePubspec(version) {
  let pubspec = getPubspec()
  pubspec.version = version
  fs.writeFileSync('pubspec.yaml', yaml.stringify(pubspec), 'utf8')
}

// Increment version based on the type (major, minor, patch)
function incrementVersion(currentVersion, type) {
  return semver.inc(currentVersion, type)
}

async function analyzeDartProject() {
  await runInWorkspace('dart', ['analyze'])
  await runInWorkspace('dart', ['format', '--set-exit-if-changed', '.'])
  await runInWorkspace('dart', ['pub', 'publish', '--dry-run'])
}

function runInWorkspace(command, args) {
  return exec.exec(command, args, { cwd: workspace })
}