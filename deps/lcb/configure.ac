#
#     Copyright 2010-2013 Couchbase, Inc.
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#
AC_PREREQ(2.60)
m4_include([m4/version.m4])
AC_INIT(libcouchbase, VERSION_NUMBER, support@couchbase.com)
AC_CONFIG_SRCDIR([src/internal.h])
AC_CONFIG_AUX_DIR(config)
AC_CANONICAL_HOST

# Preserve what the user specified as CFLAGS/CXXFLAGS/CPPFLAGS/LDFLAGS
SAVE_CFLAGS="$CFLAGS"
SAVE_CXXFLAGS="$CXXFLAGS"
SAVE_CPPFLAGS="$CPPFLAGS"
SAVE_LDFLAGS="$LDFLAGS"

# The stupid automake system thinks it is a good idea to inject
# -g -O2 to C(XX)FLAGS if it isn't set..
# Why I don't like this? Well -g is in conflict with -g3 that I'm
# adding for Sun Studio
AS_IF([test "x$CFLAGS" = "x" ],
      [CFLAGS="-I."])
AS_IF([test "x$CXXFLAGS" = "x" ],
      [CXXFLAGS="-I."])
AS_IF([test "x$CPPFLAGS" = "x" ],
      [CPPFLAGS="-I."])

AC_USE_SYSTEM_EXTENSIONS
AM_INIT_AUTOMAKE(subdir-objects foreign tar-pax)
AC_PROG_CXX
AC_PROG_CC
AM_PROG_CC_C_O
AC_PROG_LN_S
LT_INIT([disable-static shared dlopen pic-only])
AC_CONFIG_HEADERS([src/config.h])
AC_CONFIG_MACRO_DIR([m4])
m4_ifdef([AM_SILENT_RULES], [AM_SILENT_RULES([yes])])
AC_C_BIGENDIAN

# Restore CFLAGS/CXXFLAGS now that I've prevented automake
# to inject the extra options ;)
AS_IF([test "x$CFLAGS" = "x-I." ],
      [CFLAGS=""])
AS_IF([test "x$CXXFLAGS" = "x-I." ],
      [CXXFLAGS=""])
AS_IF([test "x$CPPFLAGS" = "x-I." ],
      [CPPFLAGS=""])

# It is common to install all stuff to /usr/local prefix on FreeBSD
case "$host_os" in
    freebsd*)
    ac_default_prefix=/usr/local
    AS_IF([test "x${ac_cv_env_CPPFLAGS_set}" = "x"],
          [CPPFLAGS="${CPPFLAGS} -I/usr/local/include"])
    AS_IF([test "x${ac_cv_env_LDFLAGS_set}" = "x"],
          [LDFLAGS="${LDFLAGS} -L/usr/local/lib -L/usr/local/lib/event2"])
    ;;
esac

# the malloc tests seems to be broken for cross compilation.. ignore them
ac_cv_func_malloc_0_nonnull=yes
ac_cv_func_realloc_0_nonnull=yes

AC_ARG_ENABLE([maintainer_mode],
              [AS_HELP_STRING([--enable-maintainer-mode],
                              [Forces all plugins, examples, and tools to be build. Forces compiler strictness])],
              [ac_cv_enable_maintainer_mode="$enableval"])

COUCHBASE_GENERIC_COMPILER(c99)

AM_CPPFLAGS="$AM_CPPFLAGS -I\${top_srcdir}/src -I\${top_srcdir}/contrib -I\${top_srcdir}/contrib/cbsasl/include"
AM_NOWARN_CPPFLAGS="$AM_NOWARN_CPPFLAGS -I\${top_srcdir}/src -I\${top_srcdir}/contrib -I\${top_srcdir}/contrib/cbsasl/include"
CHANGESET=GIT_CHANGESET
AC_SUBST(CHANGESET)

#
# To ensure that we don't break applications in mysterious ways we need
# to version our library. For a detailed description, check out:
# http://www.gnu.org/software/libtool/manual/libtool.html#Libtool-versioning
#
API_CURRENT=2
API_REVISION=12
API_AGE=0
AC_SUBST(API_CURRENT)
AC_SUBST(API_REVISION)
AC_SUBST(API_AGE)

# The actual version numbers for the developers ;)
LCB_VERSION="2.2.0"
LCB_VERSION_HEX=`echo ${LCB_VERSION} | awk -F. '{printf "0x%0.2d%0.2d%0.2d", $1, $2, $3}'`
AC_SUBST(LCB_VERSION)
AC_SUBST(LCB_VERSION_HEX)

AC_ARG_ENABLE([fat_binary],
    [AS_HELP_STRING([--enable-fat-binary],
                    [Build a fat binary for mac os x @<:@default=off@:>@])],
    [ac_cv_fat_binary="$enableval"])

AS_IF([test "x$ac_cv_fat_binary" = "xyes"], [
        AM_CPPFLAGS="$AM_CPPFLAGS -force_cpusubtype_ALL -arch i386 -arch x86_64"
        AM_NOWARN_CPPFLAGS="$AM_NOWARN_CPPFLAGS -force_cpusubtype_ALL -arch i386 -arch x86_64"
        AM_LDFLAGS="$AM_LDFLAGS -force_cpusubtype_ALL -arch i386 -arch x86_64"
        CPPFLAGS="$CPPFLAGS -force_cpusubtype_ALL -arch i386 -arch x86_64"
        LDFLAGS="$LDFLAGS -force_cpusubtype_ALL -arch i386 -arch x86_64"
        ac_cv_dependency_tracking="no"
      ])

AC_ARG_ENABLE([m32],
    [AS_HELP_STRING([--enable-m32],
                    [Pass -m32 to the compiler and linker @<:@default=off@:>@])],
    [ac_cv_m32="$enableval"])
AC_ARG_ENABLE([m64],
    [AS_HELP_STRING([--enable-m64],
                    [Pass -m64 to the compiler and linker @<:@default=off@:>@])],
    [ac_cv_m64="$enableval"])

AS_IF([test "x$ac_cv_m32" = "xyes"],
      [ AM_CPPFLAGS="$AM_CPPFLAGS -m32"
        AM_NOWARN_CPPFLAGS="$AM_NOWARN_CPPFLAGS -m32"
        AM_LDFLAGS="$AM_LDFLAGS -m32"
        CPPFLAGS="$CPPFLAGS -m32"
        LDFLAGS="$LDFLAGS -m32"
        AS_IF([test "x$ac_cv_m64" = "xyes"],
              [ AC_MSG_ERROR([You cannot specify -m32 and -m64. Pick one of them]) ]) ],
      [ AS_IF([test "x$ac_cv_m64" = "xyes"],
              [ AM_CPPFLAGS="$AM_CPPFLAGS -m64"
                AM_NOWARN_CPPFLAGS="$AM_NOWARN_CPPFLAGS -m64"
                AM_LDFLAGS="$AM_LDFLAGS -m64"
                CPPFLAGS="$CPPFLAGS -m64"
                LDFLAGS="$LDFLAGS -m64"
              ]) ])

AC_SEARCH_LIBS(socket, socket)
AC_SEARCH_LIBS(gethostbyname, nsl)
AC_SEARCH_LIBS(dlopen, dl)
AC_SEARCH_LIBS(floor, m)
AC_SEARCH_LIBS(pow, m)
AC_SEARCH_LIBS(fabs, m)

AC_PATH_PROG(JAVA, java, no)
AC_PATH_PROG(WGET, wget, no)
AC_PATH_PROG(CURL, curl, no)
AC_PATH_PROG(UNZIP, unzip, no)
AC_PATH_PROG(DOXYGEN, doxygen, no)
AM_CONDITIONAL(HAVE_DOXYGEN, [test "x$DOXYGEN" != "xno"])
AC_PATH_PROG(A2X, a2x, no)
AM_CONDITIONAL(HAVE_A2X, [test "x$A2X" != "xno"])


AC_SUBST(UNZIP)

AS_IF([test "x${WGET}" != "xno"],
      [DOWNLOAD="${WGET} -q -O"],
      [AS_IF([test "x${CURL}" != "xno"],
             [DOWNLOAD="${CURL} -s -L -o"],
             [AC_MSG_ERROR([You need wget or curl in path to download the headers.])])])

AC_SUBST(DOWNLOAD)

AC_ARG_ENABLE([debug_library],
    [AS_HELP_STRING([--enable-debug-library],
                    [Build libcouchbase_debug.so @<:@default=off@:>@])],
    [ac_cv_build_debug_library="$enableval"])

AM_CONDITIONAL(BUILD_LIBCOUCHBASE_DEBUG, [ test "x$ac_cv_build_debug_library" = "xyes" ])
AS_IF([test "x$ac_cv_build_debug_library" = "xyes" ], [
      AC_DEFINE([HAVE_LIBCOUCHBASE_DEBUG], [1], [I will build libcouchbase_debug.so])])

AC_ARG_WITH([couchbasemock],
    [AC_HELP_STRING([--with-couchbasemock], [Use the specified file as the test mock server])],
    [
        AS_IF([test -f ${withval}],
              [
                    rm -f tests/CouchbaseMock.jar
                    ln -s ${withval} tests/CouchbaseMock.jar
              ],
              [AC_MSG_ERROR([${withval} is not a file I can use as a mock server])])
    ]
)

AC_CHECK_HEADERS_ONCE([mach/mach_time.h sys/socket.h sys/time.h
                       netinet/in.h inttypes.h netdb.h unistd.h
                       ws2tcpip.h winsock2.h event.h stdint.h
                       sys/uio.h sys/types.h fcntl.h dlfcn.h
                       ev.h libev/ev.h sys/sdt.h limits.h stdarg.h])

AS_IF([test "x$ac_cv_header_stdint_h" != "xyes"],
      [AC_MSG_ERROR(Failed to locate stdint.h)])

AS_IF([test "x$ac_cv_header_libev_ev_h" = "xyes"],
      [AC_DEFINE([HAVE_LIBEV_EV_H], [1], [Have non-standard place for libev header])])

dnl Allow to build library without event library dependency, which is useful
dnl if the application already have one.
AC_ARG_ENABLE([plugins],
              [AS_HELP_STRING([--disable-plugins], [Build without plugins. Note that in this case most of the tests will be skipped.])],
              [ac_cv_enable_plugins="no"],
              [ac_cv_enable_plugins="yes"])
AM_CONDITIONAL(BUILD_PLUGINS, [test "x$ac_cv_enable_plugins" = "xyes"])
AS_IF([test "x$ac_cv_enable_plugins" = "xyes"],
      [AC_DEFINE([BUILD_PLUGINS], [1], [Build plugins])])

dnl Check that we can use winsock2 plugin
AC_CACHE_CHECK([for winsock2], [ac_cv_have_winsock2],
  [ saved_libs="$LIBS"
    LIBS=-lws2_32
    AC_TRY_LINK([
      #include <winsock2.h>
      #include <ws2tcpip.h>
            ],[
      DWORD error = WSAGetLastError();
            ],[
      ac_cv_have_winsock2="yes"
            ], [
      ac_cv_have_winsock2="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_WINSOCK2, [test "$ac_cv_have_winsock2" = "yes"])

dnl Check that we've got a usable libev3
AC_CACHE_CHECK([for libev3], [ac_cv_have_libev3],
  [ saved_libs="$LIBS"
    LIBS=-lev
    AC_TRY_LINK([
      #include <sys/types.h>
      #ifdef HAVE_LIBEV_EV_H
      #include <libev/ev.h>
      #else
      #include <ev.h>
      #endif
            ],[
      struct ev_loop *loop = ev_loop_new(EVFLAG_AUTO|EVFLAG_NOENV);
      ev_loop(loop, 0);
            ],[
      ac_cv_have_libev3="yes"
            ], [
      ac_cv_have_libev3="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_LIBEV3, [test "x$ac_cv_enable_plugins" = "xyes" -a "x${ac_cv_have_libev3}" = "xyes" ])
AS_IF([test "x$ac_cv_enable_plugins" = "xyes" -a "x${ac_cv_have_libev3}" = "xyes"],
      [AC_DEFINE([HAVE_LIBEV3], [1], [We have libev3])])

dnl Check that we've got a usable libev4
AC_CACHE_CHECK([for libev4], [ac_cv_have_libev4],
  [ saved_libs="$LIBS"
    LIBS=-lev
    AC_TRY_LINK([
      #include <sys/types.h>
      #ifdef HAVE_LIBEV_EV_H
      #include <libev/ev.h>
      #else
      #include <ev.h>
      #endif
            ],[
      struct ev_loop *loop = ev_loop_new(EVFLAG_AUTO|EVFLAG_NOENV);
      ev_run(loop, 0);
            ],[
      ac_cv_have_libev4="yes"
            ], [
      ac_cv_have_libev4="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_LIBEV4, [test "x$ac_cv_enable_plugins" = "xyes" -a "x${ac_cv_have_libev4}" = "xyes" ])
AS_IF([test "x$ac_cv_enable_plugins" = "xyes" -a "x${ac_cv_have_libev4}" = "xyes"],
      [AC_DEFINE([HAVE_LIBEV4], [1], [We have libev4])])

AM_CONDITIONAL(HAVE_LIBEV, [test "x$ac_cv_enable_plugins" = "xyes" -a \( "x${ac_cv_have_libev3}" = "xyes" -o "x${ac_cv_have_libev4}" = "xyes" \)])

dnl Check that we've got a usable libevent
AC_CACHE_CHECK([for libevent >= 1.4], [ac_cv_have_libevent],
  [ saved_libs="$LIBS"
    LIBS=-levent
    AC_TRY_LINK([
      #include <sys/types.h>
      #include <event.h>
            ],[
      event_base_new();
            ],[
      ac_cv_have_libevent="yes"
            ], [
      ac_cv_have_libevent="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_LIBEVENT, [test "x$ac_cv_enable_plugins" = "xyes" -a "x${ac_cv_have_libevent}" = "xyes"])
AS_IF([test "x$ac_cv_enable_plugins" = "xyes" -a "x${ac_cv_have_libevent}" = "xyes"],
      [AC_DEFINE([HAVE_LIBEVENT], [1], [We have libevent])])

AC_CACHE_CHECK([for libevent2], [ac_cv_have_libevent2],
  [ saved_libs="$LIBS"
    LIBS=-levent
    AC_TRY_LINK([
      #include <stdlib.h>
      #include <sys/types.h>
      #include <event2/event.h>
            ],[
      event_new(NULL, 0, 0, NULL, NULL);
            ],[
      ac_cv_have_libevent2="yes"
            ], [
      ac_cv_have_libevent2="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_LIBEVENT2, [test "x${ac_cv_have_libevent2}" = "xyes"])
AS_IF([test "x${ac_cv_enable_plugins}" = "xyes" -a "x${ac_cv_have_libevent2}" = "xyes"],
      [AC_DEFINE([HAVE_LIBEVENT2], [1], [We have libevent2])])

AC_CACHE_CHECK([for libuv], [ac_cv_have_libuv],
  [ saved_libs="$LIBS"
    LIBS=-luv
    AC_TRY_LINK([
      #include <uv.h>
            ],[
      uv_timer_init(NULL, NULL);
            ],[
      ac_cv_have_libuv="yes"
            ], [
      ac_cv_have_libuv="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_LIBUV, [test "x${ac_cv_have_libuv}" = "xyes"])
AS_IF([test "x${ac_cv_enable_plugins}" = "xyes" -a "x${ac_cv_have_libuv}" = "xyes"],
      [AC_DEFINE([HAVE_LIBUV], [1], [We have libuv])])

dnl Fail if libevent is the only networking backend accessible
AS_IF([test "x$ac_cv_enable_plugins" = "xyes" -a \
       "x${ac_cv_have_winsock2}" != "xyes" -a \
       "x${ac_cv_have_libuv}" != "xyes" -a \
       "x${ac_cv_have_libevent}" != "xyes" -a \
       "x${ac_cv_have_libevent2}" != "xyes" -a \
       "x${ac_cv_have_libev3}" != "xyes" -a \
       "x${ac_cv_have_libev4}" != "xyes"],
      [AC_MSG_ERROR(Failed to locate usable event library. You must install either libev or libevent dev package or use --disable-plugins option)])

dnl Check if we've got libyajl2
AC_CACHE_CHECK([for libyajl], [ac_cv_have_libyajl2],
  [ saved_libs="$LIBS"
    LIBS=-lyajl
    AC_TRY_LINK([
      #include <yajl/yajl_parse.h>
      #include <yajl/yajl_tree.h>
            ],[
      yajl_handle parser = yajl_alloc(0, 0, 0);
      yajl_val json = yajl_tree_parse(0, 0, 0);
            ],[
      ac_cv_have_libyajl2="yes"
            ], [
      ac_cv_have_libyajl2="no"
      ])
    LIBS="$saved_libs"
  ])
AM_CONDITIONAL(HAVE_LIBYAJL2, [test "x${ac_cv_have_libyajl2}" = "xyes"])
AS_IF([test "x${ac_cv_have_libyajl2}" = "xyes"],
      [AC_DEFINE([HAVE_LIBYAJL2], [1], [We have libyajl2])])

AC_CACHE_CHECK([for htonll], [ac_cv_have_htonll],
    [AC_TRY_LINK([
#include <sys/types.h>
#include <netinet/in.h>
#include <inttypes.h>
                 ], [
return htonll(0);
                 ],
                 [ ac_cv_have_htonll=yes ],
                 [ ac_cv_have_htonll=no ])
])
AS_IF([test "x$ac_cv_have_htonll" = "xyes"],[
       AC_DEFINE([HAVE_HTONLL], [1], [Have ntohll])])

AC_ARG_ENABLE([couchbasemock],
    [AS_HELP_STRING([--disable-couchbasemock],
            [Build tests that use couchbasemock. @<:@default=on@:>@])],
    [ac_cv_enable_couchbasemock="$enableval"],
    [ac_cv_enable_couchbasemock="yes"])

AS_IF([test "x${ac_cv_enable_couchbasemock}" = "xyes"],
      [AS_IF([test "x${DOWNLOAD}" = "xno"],
             [AC_MSG_ERROR([You need wget or curl in path to download the mock server. Use --disable-couchbasemock to avoid downloading of the mock server])])
       AS_IF([test "x$JAVA" = "xno"],
             [AC_MSG_ERROR([You need java in path to run the mock server.
Try add --disable-couchbasemock
])])])

dnl It doesn't make sense to use CouchbaseMock.jar without plugins
AM_CONDITIONAL(HAVE_COUCHBASEMOCK, [test "x${ac_cv_enable_couchbasemock}" = "xyes"])
AS_IF([test "x${ac_cv_enable_couchbasemock}" = "xyes"],
      [AC_DEFINE([HAVE_COUCHBASEMOCK], [1], [We have CouchbaseMock.jar])])

AC_ARG_ENABLE([tools],
    [AS_HELP_STRING([--disable-tools],
            [Build tools. @<:@default=on@:>@])],
    [ac_cv_enable_tools="$enableval"],
    [ac_cv_enable_tools="yes"])

AC_ARG_ENABLE([cxx],
    [AS_HELP_STRING([--disable-cxx],
            [Build stuff written in C++. @<:@default=on@:>@])],
    [ac_cv_enable_cxx="$enableval"],
    [ac_cv_enable_cxx="yes"])

AM_CONDITIONAL(HAVE_CXX, [test "x${ac_cv_prog_cxx_works}" = "xyes" -a "x${ac_cv_enable_cxx}" = "xyes"])
AS_IF([test "x${ac_cv_enable_tools}" = "xyes"],
      [AS_IF([test "x${ac_cv_prog_cxx_works}" != "xyes" -o "x${ac_cv_enable_cxx}" != "xyes"],
             [AC_MSG_ERROR([You need C++ compiler to build tools. Try add --disable-tools])])])
AM_CONDITIONAL(BUILD_TOOLS, [test "x${ac_cv_enable_tools}" = "xyes"])

AC_ARG_ENABLE([examples],
    [AS_HELP_STRING([--disable-examples],
            [Build examples. @<:@default=on@:>@])],
    [ac_cv_enable_examples="$enableval"],
    [ac_cv_enable_examples="yes"])
AM_CONDITIONAL(BUILD_EXAMPLES, [test "x${ac_cv_enable_examples}" = "xyes"])

AC_CHECK_FUNCS_ONCE([gethrtime clock_gettime gettimeofday
                     QueryPerformanceCounter alarm setitimer])
AM_CONDITIONAL(HAVE_GETHRTIME, [test "x${ac_cv_func_gethrtime}" = "xyes"])

AC_ARG_ENABLE([trace],
    [AS_HELP_STRING([--enable-trace],
                    [enable trace routines, mainly useful for libcouchbase development
                    @<:@default=off@:>@])],
    [ac_cv_enable_trace="$enableval"])

AM_CONDITIONAL(LIBCOUCHBASE_ENABLE_TRACE,
               [test "x${ac_cv_enable_trace}" = "xyes"])


AC_ARG_ENABLE([tests],
    [AS_HELP_STRING([--disable-tests],
            [Build without tests. BE CAREFUL. @<:@default=on@:>@])],
    [ac_cv_enable_tests="$enableval"],
    [ac_cv_enable_tests="yes"])
dnl Tests require google test framework, which might be not the case
dnl for some targets. If you disable test you won't be able easily
dnl prove that libcouchbase working.
AM_CONDITIONAL(BUILD_TESTS, [test "x${ac_cv_enable_tests}" = "xyes"])

AS_IF([test "x$GTEST_ROOT" != "x"], [
  AC_CACHE_CHECK([for gtest source], [ac_cv_have_gtest_src], [
    AS_IF([test -f "$GTEST_ROOT/src/gtest-all.cc"],
          [ac_cv_have_gtest_src=yes],
          [ac_cv_have_gtest_src=no]) ])
], [
  ac_cv_have_gtest_src=no
  GTEST_ROOT=.
])

AC_SUBST(GTEST_ROOT)
AS_IF([test "x$ac_cv_have_gtest_src" = "xno"], [
  AC_CACHE_CHECK([for gtest], [ac_cv_have_gtest], [
   AC_LANG_PUSH([C++])
   SAVED_LIBS="$LIBS"
   LIBS="-lgtest"
   AC_LINK_IFELSE(
     [AC_LANG_PROGRAM(
       [
#include "gtest/gtest.h"
       ],
       [
return 0;
       ])],
     [ac_cv_have_gtest=yes],
     [ac_cv_have_gtest=no])
   AC_LANG_POP([C++])
   LIBS="$SAVED_LIBS"
 ])
])

AS_IF([test "x$ac_cv_enable_tests" = "xyes" -a "$ac_cv_have_gtest" = "no" -a "$ac_cv_have_gtest_src" = "no" -a "x$DOWNLOAD" != "x" -a "x$UNZIP" != "xno"], [
      ac_cv_download_gtest=yes
      GTEST_ROOT=gtest-1.7.0
      ac_cv_have_gtest_src=yes
])

AM_CONDITIONAL(DOWNLOAD_GTEST, [test "x$ac_cv_download_gtest" = "xyes"])
AM_CONDITIONAL(HAVE_GOOGLETEST_SRC, [test "$ac_cv_have_gtest_src" = "yes"])
AM_CONDITIONAL(HAVE_GOOGLETEST, [test "$ac_cv_have_gtest" = "yes" -o \
                                 "$ac_cv_have_gtest_src" = "yes"])

# On HP-UX we need to link libxnet(3lib)
AC_CHECK_DECL([__hpux])
AS_IF([test "x$ac_cv_have_decl___hpux" = "xyes"],
      [AC_CHECK_LIB(xnet, t_error, ,
                    AC_MSG_ERROR([*** -lxnet needed on HP-UX ***]))])

#
# SystemTap and DTrace support
#
AC_CHECK_PROGS([DTRACE], [dtrace])

# On Solaris we need to instrument all of the object files, but this isn't
# true with DTrace on MacOSX or SystemTap. Instead of doing the hard
# work of trying to check if we have to do this, just do it if __sun is
# defined...
AC_CHECK_DECL([__sun])
AC_CHECK_DECL([__APPLE__])
AS_IF([test "x$ac_cv_have_decl___APPLE__" != "xyes"],
      [DTRACE_DASH_G="-G"])
AC_SUBST(DTRACE_DASH_G)
AC_CACHE_CHECK([for SystemTap/DTrace requirements], [ac_cv_enable_dtrace], [
   AS_IF([test "x$ac_cv_prog_DTRACE" != "xno" -a "x$ac_cv_header_sys_sdt_h" = "xyes"], [
         AS_IF([test "x$ac_cv_have_decl___APPLE__" = "xyes"],
               [ ac_cv_enable_dtrace=no ],
               [ ac_cv_enable_dtrace=yes ])
      ], [
         ac_cv_enable_dtrace=no
      ])
])
AC_CACHE_CHECK([if dtrace works], [ac_cv_dtrace_works],
               [
                 cat > conftest.d <<EOF
provider ConfTest {
    probe ac_test(int);
};
EOF
                 $DTRACE -h -o conftest.h -s conftest.d 2>/dev/zero
                 AS_IF([test $? -eq 0],
                       [ac_cv_dtrace_works=yes],
                       [ac_cv_dtrace_works=no])
                 rm -f conftest.h conftest.d
               ])
AS_IF([test "x$ac_cv_enable_dtrace" = "xyes" -a "x$ac_cv_dtrace_works" = "xyes"],
      [AC_DEFINE([HAVE_DTRACE], [1], [Enables SystemTap / DTrace Support])])

AM_CONDITIONAL([ENABLE_DTRACE], [test "x$ac_cv_enable_dtrace" = "xyes" -a "x$ac_cv_dtrace_works" = "xyes" ])
AM_CONDITIONAL([DTRACE_INSTRUMENT_OBJECT],
               [test "x$ac_cv_have_decl___sun" = "xyes"])
AM_CONDITIONAL([APPLE_DTRACE], [test "x$ac_cv_have_decl__APPLE__" = "xyes"])

AM_CONDITIONAL(MANPAGE_BSD_LAYOUT, [test "x$ac_cv_have_decl___sun" != "xyes"])

AC_CACHE_CHECK([if EWOULDBLOCK != EAGAIN],[ac_cv_eagain_neq_ewouldblock],
               [AC_COMPILE_IFELSE([AC_LANG_SOURCE([
                    #include <errno.h>
                    int error = EAGAIN;
                    int main()
                    {
                        switch(error)
                        {
                        case EWOULDBLOCK:
                        case EAGAIN:
                            error = 1;
                            break;
                        default:
                            error = 0;
                        }
                        return 0;
                    }
                ])],
                [ ac_cv_eagain_neq_ewouldblock=yes ],
                [ ac_cv_eagain_neq_ewouldblock=no])])

AS_IF([test "x$ac_cv_eagain_neq_ewouldblock" = "xyes"],[
       AC_DEFINE([USE_EAGAIN], [1], [Defined for systems where EAGAIN != EWOULDBLOCK])])


AS_IF([test "x${ac_cv_enable_maintainer_mode}" = "xyes"],
      [
       echo ""
       echo "MAINT:"
       echo "MAINT: Libcouchbase Maintainer Mode"
       echo "MAINT: Will check for prequisites"

       echo "MAINT: Checking that --disable-plugins was not passed"
       AS_IF([test "x${ac_cv_enable_plugins}" != "xyes"],
             [AC_MSG_ERROR([Maintainer mode requires all plugins enabled])])

       echo "MAINT: Ensuring libuv has been found"
       AS_IF([test "x${ac_cv_have_libuv}" != "xyes"],
             [AC_MSG_ERROR([libuv not found])])

       echo "MAINT: Ensuring libevent1.x or libevent2.x"
       AS_IF([test "x${ac_cv_have_libevent}" != "xyes" && test "x${ac_cv_have_libevent2}" != "xyes"],
             [AC_MSG_ERROR([libevent not found])])

       echo "MAINT: Ensuring libev3 or libev4"
       AS_IF([test "x${ac_cv_have_libev3}" != "xyes" && test "x${ac_cv_have_libev4}" != "xyes"],
             [AC_MSG_ERROR([libev not found])])

       echo "MAINT: Ensuring couchbasemock"
       AS_IF([test "x${ac_cv_enable_couchbasemock}" != "xyes"],
             [AC_MSG_ERROR([Mock must be enabled])])

       echo "MAINT: Ensuring examples are enabled"
       AS_IF([test "x${ac_cv_enable_examples}" != "xyes"],
             [AC_MSG_ERROR([Examples must be enabled])])

       echo "MAINT: Ensuring CXX is enabled"
       AS_IF([test "x${ac_cv_enable_cxx}" != "xyes"],
             [AC_MSG_ERROR([cxx must be enabled])])

       echo "MAINT: Ensuring tools are enabled"
       AS_IF([test "x${ac_cv_enable_tools}" != "xyes"],
             [AC_MSG_ERROR([Tools must be enabled])])

       AS_IF([test "x${ac_cv_enable_tests}" != "xyes"],
             [AC_MSG_ERROR([Tests must be enabled])])
      ])


AH_TOP([
#if defined(_WIN32) && !defined(HAVE_CONFIG_H)
  /* skip config.h contents on a non-autotools win32 build */
  #include "win32/config.h"
  #define CONFIG_H
#endif

#ifndef CONFIG_H
#define CONFIG_H
/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010, 2011 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

/*
 * This file is generated by running configure. Any changes you make to this
 * file will be overwritten the next time you run configure. If you want to
 * make permanent changes to the file you should edit configure.ac instead.
 * All platform-specific includes should be placed inside config_static.h
 * to keep the config.h as small as possible. That allows us for easily
 * use another build systems with a poor support for automake (like Windows)
 *
 * @author Trond Norbye
 */
])

AH_BOTTOM([
#include "config_static.h"
#endif
])

dnl restore CFLAGS, CPPFLAGS, CXXFLAGS and LDFLAGS
CFLAGS="$SAVE_CFLAGS"
CXXFLAGS="$SAVE_CXXFLAGS"
CPPFLAGS="$SAVE_CPPFLAGS"
LDFLAGS="$SAVE_LDFLAGS"

dnl ----------------------------------------------------------------------------
AC_CONFIG_FILES([Makefile include/libcouchbase/configuration.h VERSION])
AC_OUTPUT
AS_IF([test "$ac_cv_have_gtest" = "no" -a "$ac_cv_have_gtest_src" = "no"],
      [AS_IF([test "x$DOWNLOAD" = "x" -o "x$UNZIP" = "xno"],
             [echo "*****"
              echo "*"
              echo "*  WARNING: You need to install unzip command and either"
              echo "*           curl or wget in order to download googletest"
              echo "*           library automatically."
              echo "*"
              echo "*****"
             ],
             [echo "*****"
              echo "*"
              echo "*  WARNING: I couldn't find the googletest testsuite framework."
              echo "*           This means you cannot run the test suite to verify"
              echo "*           that the library works as expected."
              echo "*           You should consider installing it from:"
              echo "*           http://code.google.com/p/googletest/"
              echo "*"
              echo "*****"
              ])])


