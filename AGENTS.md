# AGENTS.md

## Cursor Cloud specific instructions

Morse Walker is a fully client-side, single-page web app (a CW pileup trainer). There is no backend, database, or auth. Everything runs in the browser using the Web Audio API. See `README.md` for the product overview and standard commands.

Services and commands (all defined in `package.json` scripts):

- Dev server: `npm start` runs `webpack serve` (dev config) on `http://localhost:8080/`. It passes `--open`, which harmlessly logs a browser-launch warning in a headless VM but keeps serving. Bundling is in-memory; edits to `src/` hot-reload automatically.
- Build: `npm run build` runs the production webpack build (outputs to `dist/`) and then generates JSDoc. The build emits only asset-size performance warnings, which are expected and not failures.
- Lint/format: there is no ESLint. `npm run format` runs Prettier over `src/**/*.{js,css,html}` (config in `.prettierrc`). The `.husky/pre-commit` hook runs `npm run format`, which can modify tracked files, so re-stage after committing if it reformats anything.
- Tests: none. `npm test` is a placeholder that intentionally exits 1.

Exercising the app: click `CQ` to start a pileup, then work stations by typing a callsign into the Response field and clicking `Send`. The app is audio-driven; to see responding stations' callsigns without decoding Morse, open the browser JavaScript console ("cheat" mode logs them).
