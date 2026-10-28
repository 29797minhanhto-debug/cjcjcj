<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- App data lives in browser localStorage via src/lib/store.ts; all money logic is pure functions in src/lib/cashflow.ts — keeps the app offline/installable (PWA) and testable.
- Saved data is upgraded on load through normalizeState in cashflow.ts — old phone data must keep working after any shape change.
- Fixed and flex cycle items share one shape (budget + list of payments) — one set of add/remove helpers and one amount sheet serve both groups.
- Editing an opening balance shifts the live balance by the difference — never overwrite money already moved by cycles.
- Styling is flat by design: base layer forces no shadow/blur; use card-flat, stripe-*, field and icon-btn utilities from styles.css instead of ad-hoc classes so rows stay aligned.
- Use the shared Button flat variant for cashflow actions, keeping layout classes explicit and theme colors semantic so palette changes preserve existing interactions.
- Every income/expense is also written to the journal (state.log) by the same helper that records it; journal edits/deletes flow back to the buffer or live cycle — the history and stats windows read only the journal and the user-typed balance points.
