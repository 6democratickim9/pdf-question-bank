# Local development checks

- Never use or automate `http://localhost:5173` for development verification. It is the user's real-data origin.
- Run browser verification only against the Docker-isolated origin `http://localhost:4173/pdf-question-bank/` using `docker compose -f compose.dev.yml up --build`.
- Do not stop, restart, navigate, mutate, or reuse the user's port-5173 server while testing. Container port 4173 must have a separate browser origin and separate IndexedDB.

- Before editing the frontend, identify the process serving the active local URL and verify its working directory matches this repository.
- Do not report a UI change as complete after tests or builds alone. Reload the running app and verify the changed flow in the browser when test data permits.
- If browser data does not permit the full flow, report exactly which part was verified and which part remains unverified.
- If the isolated browser environment cannot start, distinguish that verification limitation from application usability. Give the user the concrete existing app URL or launch command and do not imply that the real-data app is unusable merely because Docker verification was unavailable.
- Treat `continue` and `restart` as different state transitions: continuing preserves the active queue, while restarting exits the session and rebuilds a queue from the latest persisted data. Do not combine them into one action or label.
- At the end of an active review queue, keep both actions available: `continue` cycles the current session queue again without leaving, and `restart` returns to the dashboard so a fresh queue can exclude resolved questions.
- Any item styled as an interactive question link must have a wired navigation callback. Add a state-transition test for moving to an existing queued question and inserting a question that is not yet in the queue.
- In wrong-review views, related-question lists must be scoped to the current persisted session queue. Do not show unrelated bank-wide questions there; bank-wide recommendations belong to Study views.
- Treat Wrong-page tabs and search as display-only filters. The primary `전체 오답` start action must always build its queue from the complete persisted wrong-ID list; only explicitly focused single-question actions may start a subset.
- Update persisted wrong IDs with one serialized IndexedDB read-write transaction. Do not perform separate read and write calls for immediate grading, because rapid navigation can overwrite concurrent additions.
- A wrong-review queue contains all and only persisted wrong questions. Related-question analysis may navigate within that queue but must never inject non-wrong bank questions into it.
- When opening, restoring, or continuing a wrong-review session, synchronize its queue from the complete current persisted wrong-ID list. Never trust a stale session snapshot as the complete wrong queue.
- Active wrong-review sessions are resumable but must not lock normal exam cycles or whole-bank practice. Only active normal/practice sessions block those starts.
- Once a question reaches two cumulative wrong attempts, mark it as a persistent wrong item. A correct answer may remove it from the current review pass, but it remains in the persisted wrong list for future review sessions.
- Store bookmarks independently from wrong-answer state. Bookmark removal must never delete wrong history, and resolving a wrong answer must never remove its bookmark. Show cumulative wrong history alongside bookmarked questions.
- Never create sessions, answers, bookmarks, or other records in a real user question bank for browser verification. Use a disposable fixture bank and remove only that fixture after explicit confirmation, or limit verification to read-only inspection.
- Before an IndexedDB schema change, verify existing question-bank blobs remain readable and add a migration regression check. Do not treat question text records as proof that the original PDF Blob is preserved.
- IndexedDB versions are a ratchet: once a version has appeared in code or may have opened in a browser, never decrement or reuse it. Every newer version must open databases created by every supported older version without deleting, clearing, recreating, or rewriting existing stores unless an explicit lossless migration requires it.
- Migration regression tests must cover upgrades from both the last released version and any intermediate version that may have reached a browser. They must verify questionBanks, sourcePdf Blob bytes, sessions, results, wrongAnswers, wrongHistory, statistics, and bookmarks whenever those stores exist in the source version.
