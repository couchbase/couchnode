# vim: set expandtab:
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

#
# Automake file used to build libcouchbase. Please avoid using propritary
# make constructs, but keep the syntax portable. To reduce the posibility
# for merge conflicts all list of files should be sorted aphabetically
# (If everyone always add their files to the end of the list that line will
# always result in a conflict..)
#
# @author Trond Norbye
#

ACLOCAL_AMFLAGS = -I m4 --force

lib_LTLIBRARIES = libcouchbase.la
noinst_LTLIBRARIES = libcbsasl.la
bin_PROGRAMS =
check_PROGRAMS =
noinst_PROGRAMS =

man1_MANS =
man3_MANS =
man3couchbase_MANS =
man3lib_MANS =
man4_MANS =
man5_MANS =
man_MANS =
BUILT_SOURCES =

CLEANFILES = \
             check-all-libev-unit-tests.log \
             check-all-libevent-unit-tests.log \
             check-all-libuv-unit-tests.log \
             check-all-select-unit-tests.log

libcouchbase_la_CPPFLAGS =
libcouchbase_la_DEPENDENCIES =
libcouchbase_la_LIBADD =
libcouchbase_la_SOURCES =
include Makefile.manpage.inc
include filelist.mk

if BUILD_TOOLS
if HAVE_CXX
bin_PROGRAMS += tools/cbc tools/cbc-pillowfight
check_PROGRAMS += tests/homebrew-acceptance-test
endif
endif

nobase_pkginclude_HEADERS = \
                             plugins/io/libuv/plugin-internal.h \
                             plugins/io/libuv/libuv_compat.h \
                             plugins/io/libuv/plugin-libuv.c

libcbsasl_la_SOURCES = \
                       contrib/cbsasl/include/cbsasl/cbsasl.h \
                       contrib/cbsasl/include/cbsasl/visibility.h \
                       contrib/cbsasl/src/client.c \
                       contrib/cbsasl/src/common.c \
                       contrib/cbsasl/src/config.h \
                       contrib/cbsasl/src/cram-md5/hmac.c \
                       contrib/cbsasl/src/cram-md5/hmac.h \
                       contrib/cbsasl/src/cram-md5/md5.c \
                       contrib/cbsasl/src/cram-md5/md5.h \
                       contrib/cbsasl/src/util.h

libcbsasl_la_CFLAGS =  $(AM_NOWARN_CFLAGS)
libcbsasl_la_CPPFLAGS =  $(AM_NOWARN_CPPFLAGS) -DBUILDING_CBSASL=1 -I${top_srcdir}/contrib/cbsasl/src

libcouchbase_la_LDFLAGS= $(AM_LDFLAGS) -version-info $(API_CURRENT):$(API_REVISION):$(API_AGE) -no-undefined $(AM_PROFILE_SOLDFLAGS)
libcouchbase_la_CPPFLAGS += $(AM_CPPFLAGS) $(CPPFLAGS) -DLIBCOUCHBASE_INTERNAL=1 -DLCB_LIBDIR="\"${libdir}\""
libcouchbase_la_LIBADD += libcbsasl.la liblcbht.la
libcouchbase_la_DEPENDENCIES += libcbsasl.la liblcbht.la

if ENABLE_SSL
libcouchbase_la_LDFLAGS+=$(OPENSSL_LDFLAGS)
libcouchbase_la_CPPFLAGS+=$(OPENSSL_INCLUDES)
libcouchbase_la_LIBADD+=liblcbssl.la $(OPENSSL_LIBS)
libcouchbase_la_DEPENDENCIES+=liblcbssl.la
endif

if !ENABLE_SSL
libcouchbase_la_CPPFLAGS+=-DLCB_NO_SSL
endif

if ENABLE_SNAPPY
if BUILD_STATIC_SNAPPY
libcouchbase_la_SOURCES += config/dummy-cxx.cc
else
libcouchbase_la_CPPFLAGS += $(SNAPPY_INCLUDES)
libcouchbase_la_LDFLAGS += $(SNAPPY_LDFLAGS)
libcouchbase_la_LIBADD += -lsnappy

if HAVE_CXX
if HAVE_GOOGLETEST_SRC
tests_mc_tests_LDADD += -lsnappy
tests_mc_tests_LDFLAGS += $(SNAPPY_LDFLAGS)
endif
endif

endif
else
libcouchbase_la_CPPFLAGS += -DLCB_NO_SNAPPY=1
endif

if HAVE_WINSOCK2
libcouchbase_la_CPPFLAGS += -Iwin32 -Iplugins/io/iocp -DWINVER=0x0600 -D_WIN32_WINNT=0x0600
endif
if HAVE_LIBEVENT
lib_LTLIBRARIES += libcouchbase_libevent.la
libcouchbase_libevent_la_SOURCES = plugins/io/libevent/plugin-libevent.c
libcouchbase_libevent_la_LDFLAGS=-avoid-version $(AM_LDFLAGS) $(AM_PROFILE_SOLDFLAGS)
libcouchbase_libevent_la_LIBADD=-levent
libcouchbase_libevent_la_CPPFLAGS=$(AM_CPPFLAGS) $(CPPFLAGS) -DLIBCOUCHBASE_INTERNAL=1
if BUILD_EXAMPLES
if HAVE_LIBEVENT2
noinst_PROGRAMS += example/libeventdirect/eventloop
endif
endif
endif

if HAVE_LIBEV
lib_LTLIBRARIES += libcouchbase_libev.la
libcouchbase_libev_la_SOURCES = plugins/io/libev/plugin-libev.c
libcouchbase_libev_la_LDFLAGS=-avoid-version $(AM_LDFLAGS) $(AM_PROFILE_SOLDFLAGS)
libcouchbase_libev_la_LIBADD=-lev
libcouchbase_libev_la_CPPFLAGS=$(AM_CPPFLAGS) $(CPPFLAGS) -DLIBCOUCHBASE_INTERNAL=1
endif

if HAVE_LIBUV
lib_LTLIBRARIES += libcouchbase_libuv.la
libcouchbase_libuv_la_SOURCES = plugins/io/libuv/plugin-libuv.c
libcouchbase_libuv_la_LDFLAGS = $(AM_PROFILE_SOLDFLAGS)
libcouchbase_libuv_la_LIBADD = -luv
libcouchbase_libuv_la_CPPFLAGS = $(AM_CPPFLAGS) $(CPPFLAGS) -DLIBCOUCHBASE_INTERNAL=1
endif

gtest-1.7.0.zip:
	@echo "+--------------------------------+"
	@echo "| Download Google test framework |"
	@echo "+--------------------------------+"
	${DOWNLOAD} gtest-1.7.0.zip http://googletest.googlecode.com/files/gtest-1.7.0-rc1.zip


if HAVE_CXX
if HAVE_GOOGLETEST_SRC
noinst_LTLIBRARIES += libgtest.la
libgtest_la_SOURCES = tests/gtest-sources.cc
libgtest_la_CPPFLAGS = $(AM_NOWARN_CPPFLAGS) -I$(GTEST_ROOT) -I$(GTEST_ROOT)/include
libgtest_la_CXXFLAGS = $(AM_NOWARN_CXXFLAGS)
endif
endif

if DOWNLOAD_GTEST
gtest-1.7.0: gtest-1.7.0.zip
	${UNZIP} -o -qq gtest-1.7.0.zip
BUILT_SOURCES += gtest-1.7.0
endif

distclean-local:
	@rm -rf gtest-1.7.0

if !HAVE_GOOGLETEST_SRC
endif

tests/CouchbaseMock.jar:
	@echo "+---------------------------------------------+"
	@echo "| Download CouchbaseMock for functional tests |"
	@echo "+---------------------------------------------+"
	${DOWNLOAD} tests/CouchbaseMock.jar http://files.couchbase.com/maven2/org/couchbase/mock/CouchbaseMock/0.8-SNAPSHOT/CouchbaseMock-0.8-20140621.030439-1.jar

example_minimal_minimal_SOURCES = example/minimal/minimal.c
example_minimal_minimal_DEPENDENCIES = libcouchbase.la
example_minimal_minimal_LDADD = libcouchbase.la

example_observe_observe_SOURCES = example/observe/observe.c
example_observe_observe_DEPENDENCIES = libcouchbase.la
example_observe_observe_LDADD = libcouchbase.la

example_db_db_SOURCES = example/db/db.c
example_db_db_DEPENDENCIES = libcouchbase.la
example_db_db_LDADD = libcouchbase.la

example_db_vb_SOURCES = example/db/vb.c
example_db_vb_DEPENDENCIES = libcouchbase.la
example_db_vb_LDADD = libcouchbase.la

example_libeventdirect_eventloop_SOURCES = example/libeventdirect/main.c
example_libeventdirect_eventloop_DEPENDENCIES = libcouchbase.la
example_libeventdirect_eventloop_LDADD = libcouchbase.la -levent

example_instancepool_instancepool_SOURCES = example/instancepool/pool.c \
                                            example/instancepool/pool.h \
                                            example/instancepool/main.c
example_instancepool_instancepool_DEPENDENCIES = libcouchbase.la
example_instancepool_instancepool_LDADD = libcouchbase.la

if HAVE_CXX
noinst_PROGRAMS += example/mcc/mcc
example_mcc_mcc_SOURCES = example/mcc/mcc.cc
example_mcc_mcc_DEPENDENCIES = libcouchbase.la
example_mcc_mcc_LDADD = libcouchbase.la
endif

#
# Example programs using the library
#
if BUILD_EXAMPLES
noinst_PROGRAMS += \
                   example/db/db \
                   example/db/vb \
                   example/instancepool/instancepool \
                   example/minimal/minimal \
                   example/observe/observe
if HAVE_LIBYAJL2
noinst_PROGRAMS += example/yajl/couchview
endif
endif

example_yajl_couchview_SOURCES = example/yajl/couchview.c
example_yajl_couchview_LDADD = libcouchbase.la -lyajl

if BUILD_TESTS
check_PROGRAMS += tests/check-all
endif
tests_check_all_SOURCES = tests/check-all.cc tests/mocksupport/procutil.c
tests_check_all_CPPFLAGS = $(AM_CPPFLAGS) -I"${srcdir}/tools"
tests_check_all_LDADD = libcouchbase.la libcliopts.la

tools_cbc_SOURCES =	tools/cbc.cc tools/cbc-handlers.h
tools_cbc_LDADD = libcouchbase.la liblcbtools.la libcliopts.la
tools_cbc_pillowfight_SOURCES = tools/cbc-pillowfight.cc
tools_cbc_pillowfight_LDADD = libcouchbase.la liblcbtools.la libcliopts.la liblcbutils.la -lpthread


TESTS_ENVIRONMENT = export outdir="$(top_builddir)/tests";

TESTS =
if BUILD_TESTS
TESTS += tests/check-all
endif

if BUILD_TOOLS
if HAVE_CXX
TESTS += tests/homebrew-acceptance-test
endif
endif

if BUILD_TOOLS
CBC_LINKS = \
			cbc-admin \
			cbc-cat \
			cbc-bucket-create \
			cbc-bucket-delete \
			cbc-cp \
			cbc-create \
			cbc-flush \
			cbc-hash \
			cbc-lock \
			cbc-rm \
			cbc-stats \
			cbc-unlock \
			cbc-verify \
			cbc-verbosity \
			cbc-version \
			cbc-view

install-exec-hook:
	cd $(DESTDIR)$(bindir) && \
               $(RM) $(CBC_LINKS) && \
               for f in $(CBC_LINKS); do $(LN_S) cbc$(EXEEXT) $$f$(EXEEXT); done

uninstall-local:
	cd $(DESTDIR)$(bindir) && $(RM) $(CBC_LINKS)
endif

EXTRA_DIST += CONTRIBUTING.md LICENSE Makefile.manpage.inc README.markdown \
              RELEASE_NOTES.markdown \
              include/libcouchbase/configuration.h.in \
              include/memcached/README include/memcached/COPYING \
              man/bsd \
              man/svr4 \
              tests/start_mock.sh \
              win32 \
              VERSION

if HAVE_DOXYGEN
endif


LINTFLAGS=-Iinclude -b -c -errchk=%all \
          -erroff=E_INCL_NUSD,E_CAST_INT_TO_SMALL_INT,E_PTRDIFF_OVERFLOW  \
          -errtags=yes -errhdr=%user \
          -errsecurity=extended -fd -Ncheck=%all -Nlevel=4 -n -Xc99=none
lint:
	$(LINT.c) $(libcouchbase_la_SOURCES)

regenerate-manpage:
	$(top_srcdir)/man/generate.sh

sinclude packaging/*/package.mk
