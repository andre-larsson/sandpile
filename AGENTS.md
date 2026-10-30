# AGENTS.md instructions for sandpile

<INSTRUCTIONS>
- Primary goal: Interactive sandpile explorer published at https://andre-larsson.github.io/sandpile/.
- Repository: GitHub Pages project site (React + Vite), deployed by GitHub Actions on pushes to `main`.
- Build: `npm run build`.
- Lint: `npm run lint`.
- Preview/dev: `npm run dev`.
- Tests: No dedicated test suite is currently defined.
- Notes: Keep `base: '/sandpile/'` in `vite.config.js` matching the repo name. The simulation engine in `src/sandpile.js` has no React dependencies.
</INSTRUCTIONS>
