#!/bin/sh
# entrypoint.sh

# Translate LOG_LEVEL → CBPPLOGLEVEL if CBPPLOGLEVEL is not already set
if [ -z "${CBPPLOGLEVEL}" ] && [ -n "${LOG_LEVEL}" ]; then
    export CBPPLOGLEVEL="${LOG_LEVEL}"
fi

exec "$@"
