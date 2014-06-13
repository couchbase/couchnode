# SYNOPSIS
#
#   AX_CHECK_SNAPPY([action-if-found[, action-if-not-found]])
#
# DESCRIPTION
#
#   Look for snappy in a number of default spots, or in a user-selected
#   spot (via --with-snappy).  Sets
#
#     SNAPPY_INCLUDES to the include directives required
#     SNAPPY_LIBS to the -l directives required
#     SNAPPY_LDFLAGS to the -L or -R flags required
#
#   and calls ACTION-IF-FOUND or ACTION-IF-NOT-FOUND appropriately
#
#   This macro sets SNAPPY_INCLUDES such that files need to include <snappy.h> directly
#
# LICENSE
#   Copyright (c) 2014, Couchbase Inc <http://www.couchbase.com/>
#
#   Based on ax_check_openssl.m4 by:
#   Copyright (c) 2009,2010 Zmanda Inc. <http://www.zmanda.com/>
#   Copyright (c) 2009,2010 Dustin J. Mitchell <dustin@zmanda.com>
#
#   Copying and distribution of this file, with or without modification, are
#   permitted in any medium without royalty provided the copyright notice
#   and this notice are preserved. This file is offered as-is, without any
#   warranty.

#serial 0

AU_ALIAS([CHECK_SNAPPY], [AX_CHECK_SNAPPY])
AC_DEFUN([AX_CHECK_SNAPPY], [
    found=false
    AC_ARG_WITH([snappy],
        [AS_HELP_STRING([--with-snappy=DIR],
            [root of snappy directory])],
        [
            case "$withval" in
            "" | y | ye | yes | n | no)
            AC_MSG_ERROR([Invalid --with-snappy value])
              ;;
            *) snappydirs="$withval"
              ;;
            esac
        ], [
            snappydirs="/usr/local/snappy /usr/lib/snappy /usr/snappy /usr/pkg /usr/local /usr"
        ]
        )


    SNAPPY_INCLUDES=
    for snappydir in $snappydirs; do
        AC_MSG_CHECKING([for snappy-c.h in $snappydir])
        if test -f "$snappydir/include/snappy-c.h"; then
            SNAPPY_INCLUDES="-I$snappydir/include"
            SNAPPY_LDFLAGS="-L$snappydir/lib"
            SNAPPY_LIBS="-lsnappy"
            found=true
            AC_MSG_RESULT([yes])
            break
        else
            AC_MSG_RESULT([no])
        fi
    done

    # try the preprocessor and linker with our new flags,
    # being careful not to pollute the global LIBS, LDFLAGS, and CPPFLAGS

    AC_MSG_CHECKING([whether compiling and linking against snappy works])
    echo "Trying link with SNAPPY_LDFLAGS=$SNAPPY_LDFLAGS;" \
        "SNAPPY_LIBS=$SNAPPY_LIBS; SNAPPY_INCLUDES=$SNAPPY_INCLUDES" >&AS_MESSAGE_LOG_FD

    save_LIBS="$LIBS"
    save_LDFLAGS="$LDFLAGS"
    save_CPPFLAGS="$CPPFLAGS"
    LDFLAGS="$LDFLAGS $SNAPPY_LDFLAGS"
    LIBS="$SNAPPY_LIBS $LIBS"
    CPPFLAGS="$SNAPPY_INCLUDES $CPPFLAGS"
    AC_LINK_IFELSE(
        [AC_LANG_PROGRAM([#include <snappy-c.h>], [snappy_max_compressed_length(0)])],
        [
            AC_MSG_RESULT([yes])
            $1
        ], [
            AC_MSG_RESULT([no])
            $2
        ])
    CPPFLAGS="$save_CPPFLAGS"
    LDFLAGS="$save_LDFLAGS"
    LIBS="$save_LIBS"

    AC_SUBST([SNAPPY_INCLUDES])
    AC_SUBST([SNAPPY_LIBS])
    AC_SUBST([SNAPPY_LDFLAGS])
])
