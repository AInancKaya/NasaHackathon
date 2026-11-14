<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. -->

# TerraTrend — rules for every session

NASA Space Apps 2026, "Be An Earth System Trend Detective!". Read only this file,
`docs/CONTRACT.md`, and the folder your task owns. `docs/CONTRACT.md` is the API source of truth;
change it only in a dedicated, announced step.

## How to write code (Karpathy rules)

- **Think before coding.** State assumptions. If something is unclear, ask instead of guessing.
- **Simplicity first.** Write the minimum code that solves the task. No speculative features,
  no abstractions for one caller, no configuration nobody asked for.
- **Surgical changes.** Touch only what the task needs. Do not refactor, reformat, or "improve"
  neighbouring code. Match the existing style.
- **Goal-driven.** Define how the result will be verified (a test, a `curl`, a browser check)
  and verify it before calling the work done.

## Data

- **Real data only.** Every number shown to a user comes from a live source (NASA POWER,
  NASA POWER Zarr on AWS, Open-Meteo/ERA5) at request time or from the disk cache of such a fetch.
- **No synthetic data, no bundled data.** No data files in the repo, no hard-coded values
  standing in for results, no silent fallback data. On failure, return a clear error.
- Cache lives in `cache/` (git-ignored) and always carries the fetch timestamp (`fetched_at`),
  which the UI shows.
- Artificial inputs are allowed only inside tests, never in product code.

## Language and branding

- **English only** in all files: code, comments, UI text, docs, commit messages.
- **No NASA logos, emblems, or insignia** anywhere (code, assets, UI, slides).
  Naming NASA as a data source in text is fine.

## AI disclosure

Every source file starts with an AI-use disclosure header in its comment syntax, e.g.:

```
# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
```

## Workflow

- One work package = one branch = one fresh chat. Open a PR when done.
- Do not create remote repositories or push without asking the user.
