#!/bin/sh
for t in $@; do
    node $t
    rv=$?
    case $rv in
      0)
         echo "$t .. OK"
         ;;
      64)
         echo "$t .. SKIP"
         ;;
      *)
        echo "$t .. FAIL"
         ;;
    esac
done
