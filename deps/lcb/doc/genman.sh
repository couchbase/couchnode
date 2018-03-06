#!/bin/sh
set -e
set -x

# Run from the top level source directory
OUTDIR=man
SRCDIR=.

MANPAGES="cbc cbc-pillowfight cbc-n1qlback cbc-subdoc"
for page in $MANPAGES; do
  ronn --pipe --roff $SRCDIR/$page.markdown | sed 's/\\.\\.\\./\\[char46]\\[char46]\\[char46]/g' > $OUTDIR/$page.1
done
ronn --pipe --roff $SRCDIR/cbcrc.markdown | sed 's/\\.\\.\\./\\[char46]\\[char46]\\[char46]/g' > $OUTDIR/cbcrc.4

MANLINKS="cat cp create observe flush hash lock unlock rm stats \
version verbosity view admin bucket-create bucket-delete connstr \
role-list user-list user-upsert user-delete ping n1ql mcflush \
decr incr watch"

for link in $MANLINKS; do
    dest="$OUTDIR/cbc-${link}.1"
    echo ".so man1/cbc.1" > "$dest"
done
