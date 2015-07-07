#!/bin/sh
set -e
set -x

# Run from the top level source directory
OUTDIR=man
SRCDIR=.

ronn --pipe --roff $SRCDIR/cbc.markdown > $OUTDIR/cbc.1
ronn --pipe --roff $SRCDIR/cbc-pillowfight.markdown > $OUTDIR/cbc-pillowfight.1
ronn --pipe --roff $SRCDIR/cbc-n1qlback.markdown > $OUTDIR/cbc-n1qlback.1
ronn --pipe --roff $SRCDIR/cbcrc.markdown > $OUTDIR/cbcrc.4

MANLINKS="cat cp create observe flush hash lock unlock rm stats"
MANLINKS="$MANLINKS version verbosity view admin bucket-create bucket-delete connstr"

for link in $MANLINKS; do
    dest="$OUTDIR/cbc-${link}.1"
    echo ".so man1/cbc.1" > "$dest"
done
