#!/bin/bash

# USAGE: Run this script from anywhere.
# It fetches the latest proto files from the `couchbaselabs/fit-protocol` repo,
# copies them to performer/proto, and patches them (see below).
# Then manually commit any changes.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

DEST_DIR=performer/proto
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

curl --location --fail https://github.com/couchbaselabs/fit-protocol/archive/refs/heads/main.zip -o "$TMP_DIR/fit-protocol.zip"
unzip -q "$TMP_DIR/fit-protocol.zip" -d "$TMP_DIR/unzipped"

SRC_DIR="$TMP_DIR/unzipped/fit-protocol-main"
[ -d "$SRC_DIR" ] || { echo "ERROR: Missing expected directory: $SRC_DIR" >&2; exit 1; }

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -R "$SRC_DIR"/. "$DEST_DIR"

# hack until we can implement https://github.com/timostamm/protobuf-ts
#
# Forces int64 fields to (de)serialize as JS strings so protobuf-js does not
# round values above Number.MAX_SAFE_INTEGER (2^53 - 1). Runs here, once,
# against the clean copy just fetched above -- it edits the protos in place
# and is not idempotent, so it's deliberately not exposed as its own script
# that could be re-run against already-patched files.
#
# Covers every `cas` plus the non-optional subdoc counter `delta`
# (IncrementOperation/DecrementOperation in sdk.kv.mutate_in.proto). The binary
# counter's `optional int64 delta`/`initial` are intentionally excluded: the
# binary command builder still consumes them as numbers, so widening them would
# break it. Add them here only alongside that performer change.
PROTO_DIR="$DEST_DIR/operational"
grep -r -n -E "int64 (cas|delta) " "$PROTO_DIR" --exclude-dir="jvm" | grep -v "optional int64 delta" | while read -r line ; do
    file=$(echo $line | cut -d ':' -f 1)
    lineno=$(echo $line | cut -d ':' -f 2)
    echo "Updating $file..."
    param=$(sed "${lineno}!d" $file)
    trimmed_param=$(sed 's/;//' <<< "$param")
    # take into account macos sed quirks
    if [[ $OSTYPE == "darwin"* ]]; then
        sed -i '' "s/${param}/${trimmed_param} [jstype = JS_STRING];/" $file
    else
        sed -i "s/${param}/${trimmed_param} [jstype = JS_STRING];/" $file
    fi
done

git add --all "$DEST_DIR"

echo
echo "Protobuf update complete! Please manually commit any modified files."
echo
