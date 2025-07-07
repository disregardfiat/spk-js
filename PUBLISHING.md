# Publishing SPK-JS to NPM

This guide explains how to publish the SPK-JS library to NPM and create releases.

## Prerequisites

1. **NPM Account**: You need publish access to the `@spknetwork` organization
2. **GitHub Access**: You need write access to the repository
3. **NPM Token**: Set up `NPM_TOKEN` secret in GitHub repository settings

## Publishing Methods

### Method 1: Automated Release (Recommended)

Create a new release by pushing a version tag:

```bash
# Make sure you're on main branch with latest changes
git checkout main
git pull origin main

# Create a new version tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the `Release and Publish` workflow which:
- Runs tests and linting
- Builds all distribution formats
- Creates a GitHub release with changelog
- Publishes to NPM
- Updates documentation

### Method 2: Manual NPM Publish

Use the `NPM Publish` workflow from GitHub Actions:

1. Go to Actions → NPM Publish
2. Click "Run workflow"
3. Select options:
   - **Version**: patch, minor, major, or prerelease
   - **Tag**: latest (stable) or next (pre-release)
   - **Dry run**: Test without publishing

### Method 3: Local Publishing (Emergency Only)

```bash
# Install dependencies
npm ci

# Run tests
npm test

# Build the library
npm run build

# Login to NPM
npm login

# Publish
npm publish --access public
```

## Version Strategy

### Stable Releases
- Use semantic versioning: MAJOR.MINOR.PATCH
- Tag as `latest` on NPM
- Examples: v1.0.0, v1.1.0, v1.1.1

### Pre-releases
- Add suffix: -alpha.X, -beta.X, -rc.X
- Tag as `next` on NPM
- Examples: v1.0.0-alpha.1, v1.0.0-beta.1

## Release Checklist

Before releasing:

- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] CHANGELOG.md is updated
- [ ] Documentation is current
- [ ] Breaking changes are documented
- [ ] Version bump follows semver

## NPM Package Configuration

The package is published as `@spknetwork/spk-js` with:

- **Main entry**: `dist/spk-js.cjs.js` (CommonJS)
- **Module entry**: `dist/spk-js.esm.js` (ES Modules)
- **Browser entry**: `dist/spk-js.umd.js` (UMD)
- **Types**: `dist/index.d.ts` (TypeScript)
- **Minified**: `dist/spk-js.min.js` (Production)

## Distribution Channels

### NPM Registry
```bash
npm install @spknetwork/spk-js
```

### CDN (via unpkg)
```html
<!-- Latest version -->
<script src="https://unpkg.com/@spknetwork/spk-js/dist/spk-js.min.js"></script>

<!-- Specific version -->
<script src="https://unpkg.com/@spknetwork/spk-js@1.0.0/dist/spk-js.min.js"></script>
```

### GitHub Releases
- Download pre-built bundles
- Source code archives
- Release notes and changelog

## Troubleshooting

### NPM Token Issues
1. Check token hasn't expired
2. Verify token has publish scope
3. Update GitHub secret: Settings → Secrets → NPM_TOKEN

### Build Failures
1. Clear node_modules: `rm -rf node_modules && npm ci`
2. Check Node version: Should be 18.x
3. Verify all dependencies are installed

### Publishing Errors
- **E403**: Check NPM permissions for @spknetwork org
- **E409**: Version already exists, bump version
- **E404**: Package name might be wrong

## Post-Release Tasks

After publishing:

1. **Verify on NPM**: Check https://www.npmjs.com/package/@spknetwork/spk-js
2. **Test installation**: `npm install @spknetwork/spk-js` in a new project
3. **Update documentation**: If API changes were made
4. **Announce release**: Notify users of new features/fixes
5. **Monitor issues**: Watch for bug reports

## Security Notes

- Never commit `NPM_TOKEN` to the repository
- Use GitHub secrets for sensitive data
- Enable 2FA on your NPM account
- Regularly rotate access tokens

## Contact

For publishing access or issues:
- Create an issue in the repository
- Contact the SPK Network team