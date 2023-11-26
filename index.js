const core = require('@actions/core')
const github = require('@actions/github')
const exec = require('@actions/exec')
const fs = require('fs')
const yaml = require('yaml')
const semver = require('semver')

// Change working directory if user defined PACKAGEJSON_DIR
if (process.env.PACKAGEJSON_DIR) {
  process.env.GITHUB_WORKSPACE = `${process.env.GITHUB_WORKSPACE}/${process.env.PACKAGEJSON_DIR}`
  process.chdir(process.env.GITHUB_WORKSPACE)
} else if (process.env.INPUT_PACKAGEJSON_DIR) {
  process.env.GITHUB_WORKSPACE = `${process.env.GITHUB_WORKSPACE}/${process.env.INPUT_PACKAGEJSON_DIR}`
  process.chdir(process.env.GITHUB_WORKSPACE)
}

//Workspace
const workspace = process.env.GITHUB_WORKSPACE
console.log(`Current workspace: ${workspace}`)

// Github Token
const githubToken = process.env.GITHUB_TOKEN
if (githubToken == null || githubToken == "") {
  core.setFailed('GITHUB_TOKEN not found.')
  return
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

function runInWorkspace(command, args) {
  return exec.exec(command, args, { cwd: workspace })
}

async function run() {
  try {
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

    // Some tests
    await runInWorkspace('pwd')
    await runInWorkspace('ls', ['-la'])
    await runInWorkspace('git', ['config', '--global', '--add', 'safe.directory', workspace])
    await runInWorkspace('git', ['status'])

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
    const remoteRepo = `https://${githubToken}:x-oauth-basic@github.com/${process.env.GITHUB_REPOSITORY}.git`
    await runInWorkspace('git', ['push', remoteRepo])
    await runInWorkspace('git', ['push', remoteRepo, '--tags'])
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

run()
