#!/bin/sh
foo=`echo -e`
if [ "$foo" = "" ]
then
  dashe=-e
fi

echo $dashe "\033[1;33mRunning tests...\033[m";
TESTS_ROOT=$(dirname $0)
cd $TESTS_ROOT

# Set count defaults
runs=0
passed=0
skipped=0
failed=0

# Iterate over all .js files in this directory
for t in `ls *.js | sort`; do
    if [ $t != "setup.js" ] && [ $t != "harness.js" ]
      then
        node $t
        rv=$?
        case $rv in
          0)
             passed=`expr $passed + 1`;
             echo $dashe "$t .. \033[1;32mOK\033[m"
             ;;
          64)
             skipped=`expr $skipped + 1`;
             echo $dashe "$t .. \033[1;33mSKIP\033[m"
             ;;
          *)
             failed=`expr $failed + 1`;
             echo $dashe "$t .. \033[1;31mFAIL\033[m"
             ;;
        esac
        runs=`expr $runs + 1`
    fi
done

# Output the results
echo $dashe "\033[1;32m$passed\033[m \033[1;33mout of\033[m \033[1;32m$runs\033[m \033[1;33mtests passed\033[m";

if [ $skipped -gt 0 ]
then
    echo $dashe "\033[1;33m$skipped tests skipped\033[m"
fi

if [ $failed -gt 0 ]
then
    echo $dashe "\033[1;31m$failed tests failed\033[m"
fi
