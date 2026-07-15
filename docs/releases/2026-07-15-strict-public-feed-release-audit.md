# Strict public feed release audit

Date: 2026-07-15

## Release state

- Implementation commit: `cf85c33` (`Implement strict public outage feed`)
- Design commit: `1253916` (`Document strict public outage feed design`)
- Local verification: 65 tests passed, TypeScript passed, production build passed
- Independent code review: no remaining Critical or Important findings
- Production mutation: not started; explicit user approval is still required

## Recovery point

Immediately before the attempted production migration, Cloudflare D1 Time Travel returned:

`00000643-00000000-000050a9-f4218277f69da3a2f10519fa0d822727`

The earlier recovery point captured during implementation was:

`0000063f-00000000-000050a9-6dea7f169aede1147b2b8866c9d78bd5`

## Production baseline

Read-only checks performed before release:

- `outage_events`: 54
- Events in Swiss, non-dismissed revalidation scope: 46
- Legacy public/publishable events: 24
- Raw `source_observations`: 12
- `/api/public/status` currently exposes the legacy dashboard contract with 23 `events`
- The legacy sample still exposes internal fields and a Google redirect URL, confirming that production has not yet received the strict feed release

## Controlled rollout

1. Apply `0011_strict_public_feed.sql` remotely.
2. Deploy commit `cf85c33` so the revalidation workflow and strict API contract exist.
3. Trigger `check-alert-feeds` with `{"revalidatePublicEvents":true,"apply":false,"limit":50}`.
4. Read the latest `publication_revalidation_runs` row and retain the dry-run counts and decisions.
5. Trigger the same workflow with `apply:true`.
6. Verify `publication_decisions`, public event count, and that no raw observations were deleted.
7. Trigger a normal source check and inspect transport/parser/freshness health independently.
8. Smoke `https://outage.ch`, `/api/public/status`, `/api/public/events`, and one public detail route.
9. Verify at 375 px and 1440 px: no horizontal overflow, no fixed controls covering content, and no internal QA/unknown fields.
10. Push both local commits to `origin/main` only after the production checks pass.

## Acceptance queries

The release is accepted only if:

- every API item has `id`, `location`, `received_at`, `summary`, `trust`, and a canonical `source`;
- every `trust` value is `official` or `corroborated`;
- no item contains internal scores, review states, raw facts, merge suggestions, QA metrics, or Google redirect URLs;
- every visible event has a publication decision with `publishable = 1`;
- the raw observation count is not lower than the pre-release baseline;
- the default list contains at most 10 items in descending `received_at`, `id` order.
