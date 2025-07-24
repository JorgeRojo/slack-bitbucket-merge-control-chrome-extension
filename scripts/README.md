# Project Scripts

This directory contains utility scripts for the Slack-Bitbucket Merge Control Chrome Extension project.

## Available Scripts

### `create-bug-report.sh`

A script to generate new bug reports based on the template defined in the bug tracking system.

#### Usage

```bash
cd /path/to/project
./scripts/create-bug-report.sh
```

The script will:

1. Find the next available bug ID
2. Prompt you for details about the bug:
   - Bug title
   - Component (file/module affected)
   - Status (Open/Fixed/Won't Fix)
   - Severity (Critical/High/Medium/Low)
   - Steps to reproduce (use ; for line breaks)
   - Current wrong behavior
   - Expected right behavior
   - Root cause (if known)
   - Fix summary (if applicable)
   - Tests added/modified (if applicable)
   - Related files (comma separated)

3. Generate a new bug file in `documentation/bugs/` with the proper format
4. Update the bug index in `documentation/bugs/README.md`
5. Provide git commands to commit the changes

#### Example

```
$ ./scripts/create-bug-report.sh
Creating new bug report with ID: 002
Bug title: Missing error handling in API calls
Component (file/module affected): src/modules/api/client.ts
Status [Open/Fixed/Won't Fix]: Open
Severity [Critical/High/Medium/Low]: Medium
Steps to reproduce (use ; for line breaks): Make an API call with invalid credentials; Check console for errors
Current wrong behavior: No user-friendly error message is shown
Expected right behavior: A toast notification should appear with the error
Root cause (if known): Missing try/catch block in API client
Fix summary (if applicable): 
Tests added/modified (if applicable): 
Related files (comma separated): src/modules/api/client.ts, src/modules/common/utils/errorHandler.ts

Bug report created at: ./documentation/bugs/002-missing-error-handling-in-api-calls.md
Bug index updated successfully!
Don't forget to commit the changes:
git add ./documentation/bugs/002-missing-error-handling-in-api-calls.md ./documentation/bugs/README.md
git commit -m "Add bug report #002: Missing error handling in API calls"
git push origin master
```
