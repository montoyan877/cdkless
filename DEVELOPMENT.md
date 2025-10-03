# Development Guide

This guide is for developers who want to contribute to CdkLess or test local changes before publishing.

## Table of Contents

- [Setting Up for Development](#setting-up-for-development)
- [Testing Local Changes](#testing-local-changes)
- [Development Workflow](#development-workflow)
- [Building and Publishing](#building-and-publishing)

## Setting Up for Development

### Prerequisites

- Node.js 22+
- npm or yarn
- Git
- PowerShell (for Windows users)

### Clone and Install

```bash
git clone https://github.com/your-org/cdkless.git
cd cdkless
npm install
```

### Build the Project

```bash
npm run build
```

This will compile TypeScript files from `src/` into `dist/`.

## Testing Local Changes

When you make changes to CdkLess, you'll want to test them in a real project before publishing. We provide a PowerShell script to make this process easy.

### Using the Local Testing Script (Windows)

The `test-local-changes.ps1` script automates the process of building, packing, and installing your local version of CdkLess into a target project.

#### What the Script Does

1. **Builds** the CdkLess library (`npm run build`)
2. **Packs** it into a `.tgz` file (`npm pack`)
3. **Uninstalls** any existing version from your target project
4. **Installs** your local version into the target project

#### Usage

```powershell
.\test-local-changes.ps1 "C:\path\to\your\project"
```

**Example:**

```powershell
.\test-local-changes.ps1 "C:\Users\your-user\Documents\Projects\my-serverless-app"
```

#### Expected Output

```
🔨 Building cdkless...
✅ Package created: cdkless-1.0.4.tgz

📍 Installing in project: C:\path\to\your\project
Installing from: C:\path\to\cdkless\cdkless-1.0.4.tgz

═══════════════════════════════════════════════════════
✅ cdkless local version installed successfully in your project!
═══════════════════════════════════════════════════════

🎯 Now you can test your local changes in the target project.

🧪 Suggested commands to run in your project:
  - npm install         (to ensure dependencies are linked)
  - npm run build       (to compile your project with the new library)
  - npm run cdk synth   (to see the generated CloudFormation)
```

#### After Installation

Navigate to your target project and test your changes:

```bash
cd C:\path\to\your\project

# Ensure dependencies are linked
npm install

# Build your project
npm run build

# Test CDK synthesis
npx cdk synth

# Deploy if needed
npx cdk deploy
```

#### Restoring the Official Version

When you're done testing, restore the official published version:

```bash
cd C:\path\to\your\project
npm uninstall cdkless
npm install cdkless
```

### Manual Testing (Cross-Platform)

If you're not on Windows or prefer manual steps:

#### 1. Build and Pack CdkLess

```bash
cd /path/to/cdkless
npm run build
npm pack
```

This creates a file like `cdkless-1.0.4.tgz`.

#### 2. Install in Your Target Project

```bash
cd /path/to/your/project
npm uninstall cdkless
npm install /path/to/cdkless/cdkless-1.0.4.tgz
```

#### 3. Test Your Changes

```bash
npm run build
npx cdk synth
```

#### 4. Restore Official Version

```bash
npm uninstall cdkless
npm install cdkless
```

## Development Workflow

### Recommended Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the `src/` directory

3. **Build and verify compilation**
   ```bash
   npm run build
   ```

4. **Test locally** using the script or manual method
   ```powershell
   .\test-local-changes.ps1 "C:\path\to\test\project"
   ```

5. **Verify in target project**
   - Check that your changes work as expected
   - Test with different configurations
   - Verify CloudFormation output with `cdk synth`

6. **Update documentation**
   - Update `README.md` for user-facing changes
   - Update `docs/API.md` for API changes
   - Update this file (`DEVELOPMENT.md`) for development process changes

7. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

8. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Common Development Tasks

#### Adding a New Feature

1. Define interfaces in `src/interfaces/`
2. Implement logic in `src/lambda-builder.ts` or appropriate file
3. Update documentation
4. Test locally

#### Fixing a Bug

1. Identify the issue in the source code
2. Make the fix
3. Test to ensure the bug is resolved
4. Test to ensure no regression

#### Updating Dependencies

```bash
npm update
npm run build
# Test thoroughly after updating dependencies
```

## Building and Publishing

### Version Management

Update version in `package.json` following [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.x): Bug fixes, minor changes
- **MINOR** (1.x.0): New features, backward compatible
- **MAJOR** (x.0.0): Breaking changes

```bash
npm version patch  # 1.0.4 -> 1.0.5
npm version minor  # 1.0.4 -> 1.1.0
npm version major  # 1.0.4 -> 2.0.0
```

## Troubleshooting

### Build Errors

**Issue:** TypeScript compilation errors

**Solution:**
```bash
npm run clean
npm install
npm run build
```

### Script Execution Policy (Windows)

**Issue:** Cannot run PowerShell script

**Error:** `cannot be loaded because running scripts is disabled on this system`

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Installation Fails in Target Project

**Issue:** `npm install` fails with the local package

**Solution:**
1. Ensure the `.tgz` file exists
2. Use absolute path to the `.tgz` file
3. Check that `npm run build` completed successfully

### Changes Not Reflected

**Issue:** Changes don't appear in the target project

**Solution:**
1. Rebuild CdkLess: `npm run build`
2. Reinstall in target project using the script
3. Delete `node_modules` and `package-lock.json` in target project
4. Run `npm install` again

## Project Structure

```
cdkless/
├── src/                          # TypeScript source files
│   ├── cdkless.ts               # Main entry point
│   ├── lambda-builder.ts        # Lambda builder class
│   ├── api-builder.ts           # API Gateway builder
│   └── interfaces/              # TypeScript interfaces
│       └── lambda/
│           └── config-interfaces.ts
├── dist/                        # Compiled JavaScript (generated)
├── docs/                        # Documentation
│   └── API.md                   # API reference
├── test-local-changes.ps1       # Local testing script
├── package.json                 # Package configuration
├── tsconfig.json                # TypeScript configuration
├── README.md                    # User documentation
└── DEVELOPMENT.md               # This file
```

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/your-org/cdkless/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/cdkless/discussions)
- **Email:** your-email@example.com

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using `test-local-changes.ps1`
5. Submit a pull request

Thank you for contributing to CdkLess! 🚀

