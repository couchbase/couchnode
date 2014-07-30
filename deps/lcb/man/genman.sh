#!/bin/sh
set -e
set -x
OUTDIR=.
SRCDIR=../doc

ronn --pipe --roff $SRCDIR/cbc.markdown > $OUTDIR/cbc.1
ronn --pipe --roff $SRCDIR/cbc-pillowfight.markdown > $OUTDIR/cbc-pillowfight.1
ronn --pipe --roff $SRCDIR/cbcrc.markdown > $OUTDIR/cbcrc.4

MANLINKS="cat cp create observe flush hash lock unlock rm stats"
MANLINKS="$MANLINKS version verbosity view admin bucket-create bucket-delete connstr"

> manpages.mk

for link in $MANLINKS; do
    dest="$OUTDIR/cbc-${link}.1"
    echo ".so man1/cbc.1" > "$dest"
    echo "man_MANS+=man/cbc-${link}.1" >> manpages.mk
done
