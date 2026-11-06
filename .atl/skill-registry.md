# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

Project: Food-Store-Prueba (React+TS+Vite+Tailwind+TanStack Query/Form+Zustand | FastAPI+SQLModel+PostgreSQL+Alembic). Strict TDD enabled.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Writing/fixing React component, hook or page tests (RTL, MSW, axe) | react-testing | C:/Users/jacop/.claude/skills/react-testing/SKILL.md |
| Setting up/configuring Vitest, mocking, coverage, Jest migration | vitest | C:/Users/jacop/.claude/skills/vitest/SKILL.md |
| Test-first features/bugs, red-green-refactor, integration tests | tdd | C:/Users/jacop/.claude/skills/tdd/SKILL.md |
| Writing Python tests with pytest, fixtures, mocking | python-testing-patterns | C:/Users/jacop/.claude/skills/python-testing-patterns/SKILL.md |
| Frontend structure, layer/slice placement, import boundaries | feature-sliced-design | C:/Users/jacop/.claude/skills/feature-sliced-design/SKILL.md |
| Server state, data fetching, mutations, cache (React Query v5) | tanstack-query | C:/Users/jacop/.claude/skills/tanstack-query/SKILL.md |
| Form state and validation (TanStack Form v1) | tanstack-form | C:/Users/jacop/.claude/skills/tanstack-form/SKILL.md |
| Zustand stores, selectors, actions (client state) | zustand | C:/Users/jacop/.claude/skills/zustand/SKILL.md |
| Tailwind v4 design tokens, component library, theming | tailwind-design-system | C:/Users/jacop/.claude/skills/tailwind-design-system/SKILL.md |
| Visual polish, animation, UI details | emil-design-eng | C:/Users/jacop/.claude/skills/emil-design-eng/SKILL.md |
| Frontend design taste (v1) | design-taste-frontend-v1 | C:/Users/jacop/.claude/skills/design-taste-frontend-v1/SKILL.md |
| Define/audit visual identity, design system, mockups policy | design-system | C:/Users/jacop/.claude/skills/design-system/SKILL.md |
| Create AGENTS.md / CLAUDE.md | agent-instruction | C:/Users/jacop/.claude/skills/agent-instruction/SKILL.md |
| Create/update skills | skill-creator | C:/Users/jacop/.claude/skills/skill-creator/SKILL.md |

Foundation-flow skills (active-orchestrator, kb-creator, roadmap-generator, find-skill, discovery-research, web-scraper) exist but are not coding skills; not injected into apply sub-agents.

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### tdd
- Red before green: failing test first, then only enough code to pass; no speculative features.
- Vertical slices: one test -> one implementation -> repeat. Never write all tests first.
- Test behavior through public interfaces (seams), never internals/private methods; tests must survive refactors.
- Agree seams under test with the user before writing tests at them.
- No tautological tests (expected value recomputed like the code); use independent literals/spec examples.
- Do not mock internal collaborators; mock only system boundaries.
- Refactoring is outside the red-green loop (review stage).

### vitest
- Detect project type first; React (Vite) -> environment `jsdom` (or happy-dom); Node/API -> `node`.
- Config in vitest.config.ts (or `test` block in vite.config.ts); setup file `src/test/setup.ts` with jest-dom matchers.
- tsconfig `types: ["vitest/globals"]`; scripts: `test`, `test:watch`, `test:coverage`.
- Mocking: `vi.mock` (hoisted), `vi.spyOn`, `vi.useFakeTimers`, `vi.stubGlobal`; restore mocks between tests.
- Coverage via v8 provider; exclude config, d.ts, test dirs.
- Migrating from Jest: replace `jest.*` with `vi.*`, remove jest packages.
- Run once and confirm a sample test passes against real source.

### react-testing
- Test what users see/do: render with production providers, interact via accessible queries + `userEvent`.
- Query priority: getByRole > getByLabelText > getByText > getByTestId (last resort).
- `getBy*` throws, `queryBy*` for absence, `findBy*` for async appearance.
- `const user = userEvent.setup()` once per test; always `await` user calls; prefer over `fireEvent`.
- Mock network with MSW (per-test overrides via `server.use`), not by mocking fetch/hooks.
- Never assert on state, props to children, render counts, or mock React hooks.
- Hooks: `renderHook` with `wrapper` for providers; wrap state changes in `act`.
- Add axe a11y assertions for pages/forms; avoid snapshot tests for UI; real layout/CSS -> Playwright.
- TanStack Query tests: fresh QueryClient per test, `retry: false`.

### python-testing-patterns
- pytest with AAA (Arrange/Act/Assert); name tests `test_<unit>_<scenario>_<expected>`.
- Shared fixtures in `conftest.py`; layout tests/{unit,integration,e2e}; tests isolated, no shared state.
- Mock external deps (patch at the usage site); freezegun for time; markers (`slow`, etc.) for selection.
- Async code: pytest-asyncio; DB tests: transactional/in-memory fixtures with rollback.
- Aim for meaningful coverage, not percentage.

### feature-sliced-design
- Layers (high->low): app > pages > widgets(discouraged) > features > entities > shared. Import only from strictly lower layers.
- No cross-imports between slices on the same layer.
- Every slice exports via `index.ts`; never deep-import internals. Shared: per-segment public API (`shared/ui/index.ts`), no top-level shared/index.ts.
- Start simple: shared + pages + app; extract to features/entities only when 2+ consumers and own reason to change. When in doubt keep in `pages/`.
- No business logic in `shared/` (only UI kit, utils, API client, config, assets); CRUD is infra -> shared/api.
- Name files by domain (`model/order.ts`), not technical role (`types.ts`, `utils.ts`).
- Auth tokens/session -> shared/auth or shared/api. Do not create empty layer folders.

### tanstack-query
- v5 (`@tanstack/react-query`); object signature only; `isPending` for initial load; `gcTime` not cacheTime.
- Use `queryOptions` helper for reusable typed configs; hierarchical query keys for granular invalidation.
- Mutations: `useMutation`, always invalidate related queries on success; optimistic updates: cancel queries in `onMutate`, snapshot, rollback in `onError`.
- `enabled` for dependent queries (no conditional hooks); `select` for derived data; `placeholderData` (not `initialData`) for pagination.
- Infinite queries require `initialPageParam`.
- Query functions are pure fetchers; do not destructure the result if passing it around.
- Set `staleTime` deliberately (default 0). Tests: `retry: false`, fresh client per test.

### tanstack-form
- `@tanstack/react-form` v1; `useForm({ defaultValues, onSubmit })`; render with `form.Field`.
- Submit handler: always `e.preventDefault(); e.stopPropagation(); form.handleSubmit()`.
- Attach `onBlur={field.handleBlur}` and `onChange={e => field.handleChange(...)}` to inputs.
- Validators return `undefined` when valid (never null/false); show errors only when `isTouched`.
- Prefer schema validation (Zod/Valibot) for complex rules; `asyncDebounceMs` for async validators.
- Arrays: `mode="array"` on the array field only. Use `form.Subscribe` with selectors to limit re-renders; `formOptions` for shared config.

### zustand
- NOTE: skill is LobeHub-specific (`@lobechat/*`, `@/libs/replica`, `src/store/*` paths do not apply here); apply only the general ideas.
- Keep server data in TanStack Query; Zustand only for client/UI state (cart, session, UI flags).
- Read via selectors (`useStore(s => s.x)`), centralize selectors; never select the whole store; use `shallow` for multi-field picks.
- Cache details keyed by id (`Record<string, Detail>`), not a single `currentDetail`; keep list-item types lighter than detail types.
- Prefer state-only store + separate actions; label writes for devtools; provide `reset()`.
- Tests: drive actions and assert on `store.getState()`; reset store between tests.

### tailwind-design-system
- Tailwind v4 is CSS-first: `@import "tailwindcss"` replaces `@tailwind` directives; no tailwind.config.ts needed.
- Tokens via `@theme { --color-*: ... }` (spacing/radius/font vars too); map to project `design-system/tokens.css`.
- Dark mode: `@custom-variant dark (&:where(.dark, .dark *))`.
- Animations: `@keyframes` inside `@theme` + `@starting-style`; replaces tailwindcss-animate plugin.
- Token hierarchy: primitive -> semantic -> component; build components with variants + `cn()` helper; accessible and responsive by default.

### emil-design-eng
- UI polish: purposeful, fast animations (ease-out, short durations), respect `prefers-reduced-motion`, care for hover/active/focus states. Use on UI polish tasks.

### design-taste-frontend-v1
- Use only for exact v1 taste behavior; follow the approved design-system/ foundation when in conflict.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| (none yet) | - | CLAUDE.md / AGENTS.md not yet generated (agent-instruction phase). Related: CHANGES.md, knowledge-base/, design-system/README.md, openspec/ |

Read the convention files listed above for project-specific patterns and rules.
