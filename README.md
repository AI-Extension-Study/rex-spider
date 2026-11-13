# rex-spider

The crawler framework of the rex browser-extension modules: the base class every site crawler extends, and the scheduler that runs the crawlers in the extension's service worker. Each crawler (ChatGPT, Gemini, Google AI Mode and others) reads one site with the participant's own sign-in. This module decides when each one runs, gives it its settings and crawl window, remembers what it sent, and reports each pass.

**Where it stands, 2026-11-13.** Apart from this README, this fork's `main` is bric-digital's `main`, `774e813` (2026-10-28). The extension does not install this fork: it installs bric-digital's `774e813`, the same code.

## How it runs the crawlers

- **Registering.** A crawler module makes its spider, a subclass of `REXSpider`, and calls `registerSpider` when it is imported, so importing the module is all it takes. A spider registered twice is kept once.
- **Rounds.** The extension sends `beginBackgroundCrawls` once a minute, after refreshing its configuration, but only while an ID is stored and only when the configuration request gets an HTTP answer. In a round the enabled spiders run one after another, the last registered first.
- **Whether a spider crawls.** A spider whose pass from an earlier round is still running is skipped, and rex-spider sends its completion event with `crawled_count` -1 and reason `[<id>] Still crawling.`. Otherwise it crawls if more than `sleep_delay` has passed since its last pass ended (or started, for a pass that never ended); if not, it is skipped with no event. A crawl that throws ends with `crawled_count` -1 and reason `[<id>] Error encountered on crawl: <error>`.
- **Completion events.** `signalCrawlComplete` dispatches a `pdk-app-event` named `rex-spider-<id>-complete` with `crawled_count`, `crawled_ids`, `reason` and `date`, the send time plus 1 s. Each crawler sends one per pass, with reasons of its own.
- **Upload keys.** `checkIfAlreadyTransmitted` and `logTransmitted` keep one key per record sent, `rex-spider-<id>-conversation-upload-<conversation id>-<time in ms>`, in rex-core's store.

## Settings

rex-spider reads the served configuration's `spider` block and gives each spider `spider.spiders.<id>` merged over `spider.spiders.default`, on top of `enabled: true`; a spider with no block of its own gets `default` as it is. Until a `spider` block exists it tries again every second.

| key | default | meaning |
|---|---|---|
| `enabled` | `true` | the spider runs at all |
| `start`, `end` | none | the crawl window's bounds in ms, relative to `time_anchor` |
| `time_anchor` | `runtime` | `install` (the install time), `absolute` (bounds are epoch ms) or `runtime` (now, at each check) |
| `crawl_delay` | `30000` | ms between requests, for crawlers that use it |
| `sleep_delay` | `300000` | ms between passes |
| `summarize` | `false` | summary records only, for crawlers that read it |
| `halt_on_error` | `true` | stop at the first error, for crawlers that read it |

The base class takes only the keys that are present, so a key removed from the configuration keeps its old value until the service worker restarts. The exception is `enabled` for a spider with a block of its own: the merge starts from `enabled: true`, so removing `enabled: false` from that block turns the spider back on, unless `default` holds `enabled: false`. The base class also only ever turns `summarize` on and `halt_on_error` off; the ChatGPT and Gemini forks take those two flags again on every refresh, both ways.

## Pinning this fork

Pin it only to change it. The crawlers name `github:bric-digital/rex-spider` as a dependency in their own `package.json` (Google AI Mode names its `ck-refactoring` branch). A pin of this fork at the extension's root does not change what they ask for, so npm can install bric-digital's copy under each of them as well. A crawler that imports its own copy registers with that copy's scheduler, not this one, which nothing here tests. A pin therefore needs an `overrides` entry in the extension's `package.json`, not yet tried with git dependencies, and a check that `npm ls @bric/rex-spider` lists one copy.

## What is in this repo

`src/service-worker.mts` holds `REXSpider` and the scheduler, and `src/types.mts` the settings' types. `src/extension.mts` holds an older design that loads sites in a frame on an extension page; the extension does not import it. `tests/specs/browser.spec.js` only checks that a test page loads, so nothing here tests the scheduler. `npm run build`, `npm run lint` and `npm test`, which starts Chromium and a Python web server on port 8080. `.circleci/config.yml` is bric-digital's CircleCI setup; no CI runs on this fork.

## Keeping this current

Update this README when this fork gains a change of its own, or when the extension starts installing it.
