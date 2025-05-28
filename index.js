const core = require('@actions/core')
const github = require('@actions/github')
const exec = require('@actions/exec')
const fs = require('fs')
const path = require('path')
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

// Git Env variables
const deployKeyPath = path.join(workspace, '.deploy_key')

// =====================================================================
// ================================ RUN ================================
// =====================================================================
async function run() {
  try {
    await configureGit()
    await installDependencies()
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
    await analyzeProject()

    // Setting up Git
    await runInWorkspace('git', ['config', 'user.name', `"${process.env.GITHUB_USER || 'Dart Conventional Release'}"`])
    await runInWorkspace('git', ['config', 'user.email', `"${process.env.GITHUB_EMAIL || 'gh_action_dart_conventional_release@users.noreply.github.com'}"`])

    // Setting up Deploy Key (if provided)
    const deployKey = core.getInput('deploy-key')
    if (deployKey) {
      fs.writeFileSync(deployKeyPath, deployKey, { mode: 0o600 })
      await runInWorkspace('git', ['config', '--local', 'core.sshCommand', `ssh -i ${deployKeyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=no`])
      await runInWorkspace('git', [
        'remote',
        'set-url',
        'origin',
        `git@github.com:${github.context.repo.owner}/${github.context.repo.repo}.git`
      ])
      await runInWorkspace('ssh', [
        '-i',
        deployKeyPath,
        'git@github.com',
      ])
    }

    // Committing changes
    await runInWorkspace('git', ['add', 'pubspec.yaml'])
    await runInWorkspace('git', ['commit', '-m', `ci: ${commitMessage} ${newVersion}`])

    // Tagging the commit
    const tagPrefix = core.getInput('tag-prefix')
    const tag = `${tagPrefix}${newVersion}`
    await runInWorkspace('git', ['tag', tag])

    // Pushing changes
    await runInWorkspace('git', ['push'])
    await runInWorkspace('git', ['push', '--tags'])
    
    // Cleanup 
    removeDeployKey()
  } catch (error) {
    removeDeployKey()
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

async function installDependencies() {
  const useDart = core.getInput('use-dart')
  if (useDart) {
    await runInWorkspace('dart', ['pub', 'get'])
  } else {
    await runInWorkspace('flutter', ['packages', 'get'])
  }
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

async function analyzeProject() {
  await runInWorkspace('dart', ['analyze'])
  await runInWorkspace('dart', ['format', '--set-exit-if-changed', '.'])
  await runInWorkspace('dart', ['pub', 'publish', '--dry-run', '--skip-validation'])
}

function runInWorkspace(command, args) {
  return exec.exec(command, args, { cwd: workspace })
}

function removeDeployKey() {
  if (!fs.existsSync(deployKeyPath)) return
  fs.rmSync(deployKeyPath)
}