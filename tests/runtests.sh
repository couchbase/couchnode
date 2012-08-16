#!/bin/sh
for t in $@; do
    node $t
    rv=$?
    test $rv -eq 0 && echo "$t .. OK" || echo "$t .. FAIL"
done
