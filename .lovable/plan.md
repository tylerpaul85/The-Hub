## Problem

On the L10 meeting page, when you review a headline and confirm it's an issue, it doesn't appear in the IDS list below. Two things are causing this:

1. **"Reviewed" on an issue-kind headline doesn't create an issue.** `markReviewed` in `headlines-section.tsx` only stamps `reviewed_at`. It never inserts into `issues` when `kind === "issue"`. You have to click the separate "To Issues" button.
2. **Even "To Issues" creates the row as `status: "pending"`.** The L10 IDS query (`eos.l10.$id.tsx`) filters with `.neq("status","pending")`, so pending issues never appear in IDS — they sit on `/eos/issues` under the "New" tab waiting for someone to approve them.

Net effect: confirming an issue in headlines requires two extra steps in a different page before it shows up in IDS.

## Fix

Make confirming an issue in the L10 Headlines section a one-click action that lands the issue directly in IDS for that meeting.

### `src/components/headlines-section.tsx`

- **`markReviewed`**: if `h.kind === "issue"` and there's no `converted_issue_id` yet, insert a new `issues` row with `status: "open"`, `submitted_by: userId`, `meeting_id: meetingId`, then set the headline's `converted_issue_id`, `reviewed_at`, and `meeting_id` in the same mutation. Existing announcement/cascade behavior is unchanged.
- **`convertToIssue`** (the explicit "To Issues" button): insert with `status: "open"` instead of `"pending"` so it shows up in IDS immediately. Stamp `meeting_id` on the issue too, so it groups with this meeting's IDS list.
- After either mutation succeeds, invalidate `["issues", meetingId]` (not just `["issues"]`) so the IDS list refreshes without a manual reload.

### No DB schema changes

This is purely client-side wiring. Existing pending-issue flow on `/eos/issues` still works for issues created elsewhere (e.g., the quick-submit form), it just gets bypassed when an issue is confirmed live in an L10 meeting — which matches how IDS is supposed to work.

### Out of scope

- The standalone "pending issues" review queue on `/eos/issues` stays as-is.
- No change to announcement/cascade handling.
- No change to the `issues` table schema or RLS.
