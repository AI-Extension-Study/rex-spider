import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The REX modules change on their default branches. Every GitHub dependency
// names the full commit the extension that bundles this module ships, so the
// tests run against the code it bundles, and the lockfile resolves that same
// commit. To take a newer commit, change it in the extension first.
const read = (file: string) => JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))
const githubSpecs = (pkg: Record<string, Record<string, string> | undefined>) =>
  Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.overrides })
    .filter(([, spec]) => typeof spec === 'string' && /^(github:|git\+|git:)/.test(spec)) as Array<[string, string]>

test('every GitHub dependency is pinned to a full commit', () => {
  expect(githubSpecs(read('package.json')).filter(([, spec]) => !/#[0-9a-f]{40}$/.test(spec))).toEqual([])
})

test('the lockfile resolves each GitHub dependency to its pinned commit', () => {
  const lock = read('package-lock.json')
  const mismatched = githubSpecs(read('package.json')).flatMap(([name, spec]) => {
    const pinned = spec.match(/#([0-9a-f]{40})$/)?.[1]
    const resolved = (lock.packages?.[`node_modules/${name}`]?.resolved ?? '').match(/#([0-9a-f]{40})$/)?.[1]
    return pinned !== undefined && pinned === resolved ? [] : [`${name}: package.json ${pinned ?? 'unpinned'}, lockfile ${resolved ?? 'none'}`]
  })
  expect(mismatched).toEqual([])
})
