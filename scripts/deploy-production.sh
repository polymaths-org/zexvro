#!/usr/bin/env bash
# All production releases go through the same verified GitHub Actions gate.
set -euo pipefail
if [[ $# -gt 1 ]]; then echo 'Usage: scripts/deploy-production.sh [full-verified-commit-sha]' >&2; exit 2; fi
args=(workflow run production-release.yml --repo polymaths-org/zexvro --ref main)
if [[ $# == 1 ]]; then
  [[ "$1" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full commit SHA' >&2; exit 2; }
  args+=(-f "commit_sha=$1")
fi
gh "${args[@]}"
echo 'Release requested. GitHub Actions retains all checks and staging requirements.'
