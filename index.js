const { Toolkit } = require('actions-toolkit')
const fs = require('fs')
const yaml = require('js-yaml')

// Change working directory if user defined PACKAGEJSON_DIR
if (process.env.PACKAGEJSON_DIR) {
  process.env.GITHUB_WORKSPACE = `${process.env.GITHUB_WORKSPACE}/${process.env.PACKAGEJSON_DIR}`
  process.chdir(process.env.GITHUB_WORKSPACE)
}

// Helper function to read and parse the pubspec.yaml file
function getPubspec() {
  const pubspecContent = fs.readFileSync('pubspec.yaml', 'utf8')
  return yaml.safeLoad(pubspecContent)
}
// Helper function to write updates to the pubspec.yaml file
function updatePubspec(version) {
  let pubspec = getPubspec()
  pubspec.version = version
  fs.writeFileSync('pubspec.yaml', yaml.safeDump(pubspec), 'utf8')
}

// Increment version based on the type (major, minor, patch)
function incrementVersion(currentVersion, type) {
  return semver.inc(currentVersion, type)
}

// Run your GitHub Action!
Toolkit.run(async tools => {
  const pubspec = getPubspec()
  const event = tools.context.payload

  const messages = event.commits.map(commit => commit.message + '\n' + commit.body)

  const commitMessage = 'version bump to'
  const isVersionBump = messages.map(message => message.toLowerCase().includes(commitMessage)).includes(true)
  if (isVersionBump) {
    tools.exit.success('No action necessary!')
    return
  }

  let versionType = 'patch'
  if (messages.map(message => message.includes('BREAKING CHANGE') || message.includes('major')).includes(true)) {
    versionType = 'major'
  } else if (messages.map(
    message => message.toLowerCase().startsWith('feat') || message.toLowerCase().includes('minor')).includes(true)) {
    versionType = 'minor'
  }

  try {
    const currentVersion = pubspec.version.toString()

    // Set git user
    await tools.runInWorkspace('git', ['config', 'user.name', '"Dart Conventional Release"'])
    await tools.runInWorkspace('git', ['config', 'user.email', 'gh_action_dart_conventional_release@users.noreply.github.com"'])

    const currentBranch = /refs\/[a-zA-Z]+\/(.*)/.exec(process.env.GITHUB_REF)[1]
    console.log('currentBranch:', currentBranch)

    console.log('current:', currentVersion, '/', 'version:', versionType)
    const newVersion = incrementVersion(currentVersion, versionType)
    console.log('new version:', newVersion)
    updatePubspec(newVersion)

    // Do it in the current checked out github branch (DETACHED HEAD)
    // Important for further usage of the pubspec.yaml version
    await tools.runInWorkspace('git', ['commit', '-a', '-m', `ci: ${commitMessage} ${newVersion}`])

    // Now go to the actual branch to perform the same versioning
    await tools.runInWorkspace('git', ['checkout', currentBranch])

    try {
      // To support "actions/checkout@v1"
      await tools.runInWorkspace('git', ['commit', '-a', '-m', `ci: ${commitMessage} ${newVersion}`])
    } catch (e) {
      console.warn('git commit failed because you are using "actions/checkout@v2", ' +
        'but that doesnt matter because you dont need that git commit, thats only for "actions/checkout@v1"')
    }

    const remoteRepo = `https://${process.env.GITHUB_ACTOR}:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`

    const tagVersion = `${process.env['INPUT_TAG-PREFIX']}${newVersion}`
    await tools.runInWorkspace('git', ['tag', tagVersion])
    await tools.runInWorkspace('git', ['pull', remoteRepo, '--no-edit'])
    await tools.runInWorkspace('git', ['push', remoteRepo, '--follow-tags', '--no-verify'])
    await tools.runInWorkspace('git', ['push', remoteRepo, '--tags', '--no-verify'])
  } catch (e) {
    tools.log.fatal(e)
    tools.exit.failure('Failed to bump version')
    return
  }
  tools.exit.success('Version bumped!')
})
