#!/usr/bin/env bash
set -euo pipefail
# actionlint v1.7.12 predates GitHub's documented concurrency.queue property.
# Ignore only that schema diagnostic; validate queue values separately in policy tests.
# https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
if command -v actionlint >/dev/null; then
 actionlint -ignore 'unexpected key "queue" for "concurrency" section'
else
 go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -ignore 'unexpected key "queue" for "concurrency" section'
fi
