# Local development checks

- Before editing the frontend, identify the process serving the active local URL and verify its working directory matches this repository.
- Do not report a UI change as complete after tests or builds alone. Reload the running app and verify the changed flow in the browser when test data permits.
- If browser data does not permit the full flow, report exactly which part was verified and which part remains unverified.
- Treat `continue` and `restart` as different state transitions: continuing preserves the active queue, while restarting exits the session and rebuilds a queue from the latest persisted data. Do not combine them into one action or label.
- At the end of an active review queue, keep both actions available: `continue` cycles the current session queue again without leaving, and `restart` returns to the dashboard so a fresh queue can exclude resolved questions.
- Any item styled as an interactive question link must have a wired navigation callback. Add a state-transition test for moving to an existing queued question and inserting a question that is not yet in the queue.
- In wrong-review views, related-question lists must be scoped to the current persisted session queue. Do not show unrelated bank-wide questions there; bank-wide recommendations belong to Study views.
- Treat Wrong-page tabs and search as display-only filters. The primary `전체 오답` start action must always build its queue from the complete persisted wrong-ID list; only explicitly focused single-question actions may start a subset.
- Update persisted wrong IDs with one serialized IndexedDB read-write transaction. Do not perform separate read and write calls for immediate grading, because rapid navigation can overwrite concurrent additions.
- A wrong-review queue contains all and only persisted wrong questions. Related-question analysis may navigate within that queue but must never inject non-wrong bank questions into it.
- When opening, restoring, or continuing a wrong-review session, synchronize its queue from the complete current persisted wrong-ID list. Never trust a stale session snapshot as the complete wrong queue.
