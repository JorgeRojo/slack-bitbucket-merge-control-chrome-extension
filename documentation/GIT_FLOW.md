# Git Flow Documentation

This document outlines the Git branching strategy and workflow used in this project. Our Git flow is designed to maintain code quality, enable parallel development, and ensure a stable main branch.

## Branch Structure

### Main Branches

#### `master` Branch
- **Purpose**: Production-ready code
- **Protection**: Highly protected branch
- **Integration Rules**: 
  - Can **ONLY** receive code from:
    - `develop` branch (regular releases)
    - `hotfix/*` branches (emergency fixes)
  - Direct commits are **NOT ALLOWED**
  - All integrations must be done via Pull Requests

#### `develop` Branch
- **Purpose**: Main development branch and code base
- **Role**: Integration branch for all new features and improvements
- **Source**: All new development work starts from this branch
- **Target**: Eventually merged into `master` for releases

### Temporary Branches

#### `hotfix/*` Branches
- **Purpose**: Emergency fixes for production issues
- **Lifecycle**: Temporary branches that **MUST BE DELETED** after merge
- **Creation Rules**:
  - Can **ONLY** be created from `master` branch
  - Naming convention: `hotfix/issue-description` or `hotfix/ISSUE-NUMBER`
- **Integration Rules**:
  - Must be merged into `master` via Pull Request
  - Changes **MUST** be cherry-picked into `develop` branch
  - Branch must be deleted immediately after successful merge

#### Feature Branches
- **Purpose**: Development of new features, bug fixes, and improvements
- **Creation Rules**: 
  - **MUST** be created from `develop` branch
  - Naming convention: `feature/issue-description`, `bugfix/issue-description`, or `issue/ISSUE-NUMBER`
- **Integration**: Merged back into `develop` via Pull Request

## Workflow Diagrams

### Standard Development Flow
```
develop ──┬─── feature/new-feature ───┐
          │                          │
          └─────────── ← ─────────────┘
          │
          └─── → master (via PR)
```

### Hotfix Flow
```
master ──┬─── hotfix/critical-fix ───┐
         │                          │
         └─────────── ← ─────────────┘
         │
develop ← ┘ (cherry-pick)
```

## Detailed Workflows

### 1. Standard Feature Development

#### Step 1: Create Feature Branch
```bash
# Ensure you're on develop and it's up to date
git checkout develop
git pull origin develop

# Create and checkout new feature branch
git checkout -b feature/your-feature-name
```

#### Step 2: Development and Commits
```bash
# Make your changes
git add .
git commit -m "feat: implement new feature"

# Push branch to remote
git push origin feature/your-feature-name
```

#### Step 3: Integration via Pull Request
1. Create Pull Request from `feature/your-feature-name` → `develop`
2. Code review and approval
3. Merge into `develop`
4. Delete feature branch

### 2. Release Process

#### Step 1: Prepare Release
```bash
# Ensure develop is ready for release
git checkout develop
git pull origin develop

# Run tests and quality checks
npm run test
npm run lint
npm run build
```

#### Step 2: Merge to Master
1. Create Pull Request from `develop` → `master`
2. Code review and final approval
3. Merge into `master`
4. Tag the release (if applicable)

### 3. Hotfix Process

#### Step 1: Create Hotfix Branch
```bash
# Ensure you're on master and it's up to date
git checkout master
git pull origin master

# Create hotfix branch
git checkout -b hotfix/critical-issue-fix
```

#### Step 2: Implement Fix
```bash
# Make the necessary changes
git add .
git commit -m "hotfix: fix critical production issue"

# Push hotfix branch
git push origin hotfix/critical-issue-fix
```

#### Step 3: Merge to Master
1. Create Pull Request from `hotfix/critical-issue-fix` → `master`
2. Emergency review and approval
3. Merge into `master`
4. Deploy to production

#### Step 4: Cherry-pick to Develop
```bash
# Switch to develop branch
git checkout develop
git pull origin develop

# Cherry-pick the hotfix commit(s)
git cherry-pick <hotfix-commit-hash>

# Push the changes
git push origin develop
```

#### Step 5: Cleanup
```bash
# Delete the hotfix branch locally
git branch -d hotfix/critical-issue-fix

# Delete the hotfix branch remotely
git push origin --delete hotfix/critical-issue-fix
```

## Branch Protection Rules

### Master Branch
- Require pull request reviews before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Restrict pushes that create files larger than 100MB
- Do not allow force pushes
- Do not allow deletions

### Develop Branch
- Require pull request reviews before merging
- Require status checks to pass before merging
- Allow force pushes (for maintainers only)

## Commit Message Conventions

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `hotfix`: Critical production fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```bash
feat: add user authentication system
fix: resolve memory leak in background script
hotfix: fix critical security vulnerability
docs: update API documentation
test: add unit tests for user service
```

## Pull Request Guidelines

### Title Format
- Use descriptive titles that explain what the PR does
- Include issue number if applicable: `feat: implement feature X (#123)`

### Description Template
```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Hotfix (critical fix for production)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is properly commented
- [ ] Documentation updated (if needed)
```

## Emergency Procedures

### Critical Production Issues
1. **Immediate Response**: Create hotfix branch from `master`
2. **Quick Fix**: Implement minimal fix to resolve the issue
3. **Fast Track**: Use expedited review process
4. **Deploy**: Merge to `master` and deploy immediately
5. **Sync**: Cherry-pick changes to `develop`
6. **Cleanup**: Delete hotfix branch

### Rollback Procedures
If a hotfix causes issues:
1. Revert the merge commit on `master`
2. Deploy the reverted version
3. Create new hotfix with proper solution
4. Update `develop` accordingly

## Best Practices

### Do's ✅
- Always create feature branches from `develop`
- Always create hotfix branches from `master`
- Use descriptive branch names
- Write clear commit messages
- Test thoroughly before creating PR
- Keep branches focused and small
- Delete branches after merging
- Cherry-pick hotfixes to `develop`

### Don'ts ❌
- Never commit directly to `master`
- Never commit directly to `develop` (use PRs)
- Never create feature branches from `master`
- Never create hotfix branches from `develop`
- Never leave hotfix branches undeleted
- Never skip cherry-picking hotfixes to `develop`
- Never force push to protected branches
- Never merge without proper review

## Troubleshooting

### Common Issues

#### "Branch is behind master"
```bash
# Update your branch with latest master
git checkout your-branch
git rebase master
git push --force-with-lease origin your-branch
```

#### "Merge conflicts"
```bash
# Resolve conflicts manually, then:
git add .
git commit -m "resolve merge conflicts"
git push origin your-branch
```

#### "Forgot to cherry-pick hotfix"
```bash
# Find the hotfix commit hash
git log --oneline master

# Cherry-pick to develop
git checkout develop
git cherry-pick <hotfix-commit-hash>
git push origin develop
```

## Tools and Automation

### Recommended Git Aliases
```bash
# Add to your ~/.gitconfig
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    unstage = reset HEAD --
    last = log -1 HEAD
    visual = !gitk
    develop = checkout develop
    master = checkout master
    feature = "!f() { git checkout develop && git pull && git checkout -b feature/$1; }; f"
    hotfix = "!f() { git checkout master && git pull && git checkout -b hotfix/$1; }; f"
```

### GitHub CLI Commands
```bash
# Create PR from current branch to develop
gh pr create --base develop --title "feat: your feature" --body "Description"

# Create PR from hotfix to master
gh pr create --base master --title "hotfix: critical fix" --body "Emergency fix"
```

## Conclusion

This Git flow ensures:
- **Stability**: Master branch always contains production-ready code
- **Parallel Development**: Multiple features can be developed simultaneously
- **Emergency Response**: Hotfixes can be deployed quickly without disrupting development
- **Code Quality**: All changes go through proper review process
- **Traceability**: Clear history of all changes and their purposes

By following this workflow, we maintain a clean, organized, and reliable codebase that supports both planned development and emergency responses.
