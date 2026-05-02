# Troubleshooting

## Frontend worktree verification finds fake or missing CLI tools

Fresh frontend worktrees do not share `node_modules` with the main checkout. If
`npm run test:unit`, `npm run lint`, or `npx tsc --noEmit` fails because
`vitest` / `eslint` is not recognized or `npx tsc` prints "This is not the tsc
command you are looking for", bootstrap dependencies inside that worktree before
debugging source changes.

Checks:

- Run `npm ci` from the frontend worktree that owns the changes.
- Re-run the original verification commands from the same worktree.
- Treat `npm audit` findings from install output as dependency baseline unless
  the task actually changes dependencies.

## Adding a character shows `failed to create character`

`POST /api/v1/characters` can fail on expected character-profile constraints
such as duplicate `character_code`, duplicate `game_name`, or an unsupported
`job_class`. These must stay local business errors, not generic 500 responses.

Checks:

- Verify the backend maps `characters_character_code_key` to
  `409 character_code_taken`.
- Verify the backend maps `characters_game_name_key` or
  `uni_characters_game_name` to `409 game_name_taken`.
- Verify unsupported `job_class` values return `400 invalid_job_class` before
  attempting the insert.

## Guild preferences return `failed to get preferences`

If a newly added guild preference table is queried by the backend but local
requests fail with `failed to get preferences`, verify the SQL migration
bootstrap version before debugging the frontend contract.

Checks:

- Confirm `schema_migrations.version` is at the newest migration file version.
- Confirm the expected table exists in the active database, not only in the
  repository migration folder.
- When adding a new migration, update `autoBootstrapMigrationVersion` and keep a
  regression test asserting it matches the latest embedded migration filename.

## Guild match preview returns `failed to run guild match`

The match preview reads guild boss configs, member preferences, and character
profiles before building a dry-run plan. If the API returns a 500 with
`failed to run guild match`, trace the backend error first and verify the active
database schema before changing frontend state.

Checks:

- Confirm `guild_member_preferences.character_preferences` exists when the
  repository SELECT includes it.
- Confirm `schema_migrations.version` is not ahead of the actual schema because
  an old local migration file was applied before the file contents changed.
- Repair drift with a new idempotent migration version rather than editing an
  already-applied migration in place.
