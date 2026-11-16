import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// This package is a module the extension installs, and npm takes each shared
// module's commit from the extension's own pin. So a runtime dependency on a
// GitHub module names that module's repo and no commit or ref: npm accepts any
// commit of that repo and keeps the extension's single copy, while another
// commit or repo makes npm install a second copy under this package, which
// registers with an instance the extension never runs. Dev-only GitHub modules
// are pinned. SHIPPED holds the commits the extension's v0.0.59 ships, and the
// lockfile must hold the same, so this repo's tests run on that code; naming
// commits in a test cannot nest a copy, since the extension never installs it.
// When the extension moves a module, update SHIPPED and the lockfile together.
const SHIPPED: Record<string, string> = {
  '@bric/rex-core': 'bric-digital/rex-core#e7cd111aad3dd5bd2e103414c3488f8169d2b0d1',
  '@bric/rex-types': 'bric-digital/rex-types#76cbb61ce09be3a6d79d1b329a8f64c9ab505ef6',
}
type Lock = { packages: Record<string, { resolved?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }> }
const read = (file: string) => JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))
const pkg = read('package.json') as Record<string, Record<string, string> | undefined>
const lock = read('package-lock.json') as Lock
const runtime: Record<string, string> = { ...pkg.dependencies }
const devOnly: Record<string, string> = { ...pkg.devDependencies }
const notFromRegistry = (spec: string) => !spec.startsWith('npm:') && /[/:]/.test(spec)
// owner/repo and commit of a lockfile `resolved` URL from GitHub.
const repoAndCommit = (resolved: string) => resolved.match(/github\.com[:/]([^/]+\/[^/#]+?)(?:\.git)?#([0-9a-f]{40})$/)?.slice(1) ?? []
// Anything installed from GitHub, whatever form its spec takes.
const fromGitHub = Object.entries(lock.packages)
  .filter(([path, entry]) => path !== '' && /^git\+|github\.com|codeload\.github/.test(entry.resolved ?? ''))

test('every runtime dependency from GitHub names its module\'s repo and no commit, so the extension\'s pin decides it', () => {
  const wrong = Object.entries(runtime).filter(([, spec]) => notFromRegistry(spec))
    .filter(([name, spec]) => SHIPPED[name] === undefined || spec !== `github:${SHIPPED[name].split('#')[0]}`)
  expect(wrong).toEqual([])
})

test('every dev-only dependency from GitHub names the commit the extension ships', () => {
  const wrong = Object.entries(devOnly).filter(([, spec]) => notFromRegistry(spec))
    .filter(([name, spec]) => SHIPPED[name] === undefined || spec !== `github:${SHIPPED[name]}`)
  expect(wrong).toEqual([])
})

test('the lockfile installs every GitHub package once, declared here, at the commit the extension ships', () => {
  expect(fromGitHub.length, 'the lockfile installs nothing from GitHub, so this test checks nothing').toBeGreaterThan(0)
  const wrong = fromGitHub.flatMap(([path, entry]) => {
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    if (path !== `node_modules/${name}`) return [`${path}: a second copy under another package`]
    if (!(name in runtime) && !(name in devOnly)) return [`${name}: installed from GitHub but not declared here, so another package's spec decides its commit`]
    const [repo, commit] = repoAndCommit(entry.resolved ?? '')
    return SHIPPED[name] === `${repo}#${commit}` ? [] : [`${name}: the lockfile has ${repo}#${commit}, the extension ships ${SHIPPED[name] ?? 'no such module'}`]
  })
  expect(wrong).toEqual([])
})

test('the lockfile root entry names the same dependencies as package.json', () => {
  const root = lock.packages['']
  expect({ ...root.dependencies, ...root.devDependencies }).toEqual({ ...runtime, ...devOnly })
})
