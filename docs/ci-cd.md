# CI/CD Plan for diager-js

This document outlines the step-by-step plan to add CI/CD to this project using GitHub Actions.

## [ ] 1. Set up GitHub Actions workflows
1. [ ] Create `.github/workflows/ci.yml` for continuous integration (CI).
2. [ ] Create `.github/workflows/release.yml` for release automation.

## [ ] 2. Continuous Integration (CI) Workflow
1. [ ] Trigger on pull request creation to main branches.
2. [ ] Set up Node.js environment (use .nvmrc to get version).
3. [ ] Install dependencies (root and all packages).
4. [ ] Run `make lint` to check code style and quality.
5. [ ] Run `make test` to execute all tests.

## [ ] 3. Manually Triggered Release Preparation Workflow
1. [ ] Create a workflow (`release.yml`) with `workflow_dispatch` trigger.
2. [ ] Accept inputs: `version` (string), `prerelease` (boolean).
3. [ ] On trigger:
    1. [ ] Update version in all relevant `package.json` files.
    2. [ ] Commit and push changes to a new branch (e.g., `release/v{version}`).
    3. [ ] Create a pull request from the release branch to the main branch.
    4. [ ] Create a draft GitHub release for the new version, mark as pre-release if specified.

## [ ] 4. Release Publishing Workflow
1. [ ] Trigger on merge of a release PR to the main branch.
2. [ ] Build all packages (`make dist`).
3. [ ] Publish all packages to GitHub Packages registry (ensure authentication is set up).
4. [ ] Publish the GitHub release (remove draft status, add release notes if available).

## [ ] 5. Additional Steps
1. [ ] Add required secrets to GitHub repository (e.g., `NPM_TOKEN`, `GH_TOKEN`).
2. [ ] Document usage of workflows in `README.md` or this file.
3. [ ] Optionally, add status badges to `README.md`.

---

Follow this checklist to implement robust CI/CD for the project. Each step can be checked off as it is completed.
