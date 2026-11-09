#!/usr/bin/env bash
# CI helper: runs a command and, if it fails, repeats the end of its output as a
# GitHub annotation, so the error shows on the pull request without opening logs.
#
#   bash desktop/scripts/ci-step.sh "<title>" <command> [args...]

title="$1"
shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  message="$(tail -n 40 "$log" | sed -e 's/\r$//' -e 's/%/%25/g' | awk 'BEGIN { ORS = "%0A" } { print }')"
  echo "::error title=${title} failed::${message}"
fi
rm -f "$log"
exit "$status"
