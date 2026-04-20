# How to publish to npm

**Package:** `obsidian-notion-cli` (renamed from `vault-sync` — that name is taken).

## One-time setup

```bash
npm login
# opens browser for auth — log in or create account
```

## Publish

```bash
cd c:/AI/vault-sync
npm publish --access public
```

Expected output:
```
+ obsidian-notion-cli@0.1.0
```

## Verify

- https://www.npmjs.com/package/obsidian-notion-cli
- `npx obsidian-notion-cli@latest --help`

## Future versions

1. Update `package.json` → bump version (semver)
2. `npm publish`

Patch: `0.1.1` (bug fix)
Minor: `0.2.0` (new feature, backwards-compat)
Major: `1.0.0` (breaking change)

## If publish fails

- **E403 Forbidden:** account not verified → check email
- **E409 Conflict:** name taken → check with `npm view obsidian-notion-cli`
- **E402 Payment Required:** private package on free tier → add `"publishConfig": {"access": "public"}` to package.json (already there)
