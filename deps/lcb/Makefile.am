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

if BUILD_LIBCOUCHBASE_DEBUG
lib_LTLIBRARIES += libcouchbase_debug.la
endif
noinst_LTLIBRARIES = libcbsasl.la libcrc32.la libhttpparser.la libketama.la libvbucket.la
noinst_PROGRAMS = debug/sizes
bin_PROGRAMS =
check_PROGRAMS =

man1_MANS =
man3_MANS =
man3couchbase_MANS =
man3lib_MANS =
man4_MANS =
man5_MANS =

man_MANS =
BUILT_SOURCES =
CLEANFILES = tests/CouchbaseMock.jar \
             check-all-libev-smoke-test.log \
             check-all-libev-unit-tests.log \
             check-all-libevent-smoke-test.log \
             check-all-libevent-unit-tests.log \
             check-all-libuv-smoke-test.log \
             check-all-libuv-unit-tests.log \
             check-all-select-smoke-test.log \
             check-all-select-unit-tests.log

include Makefile.manpage.inc

if BUILD_TOOLS
if HAVE_CXX
bin_PROGRAMS += tools/cbc tools/cbc-pillowfight
check_PROGRAMS += tests/homebrew-acceptance-test
endif
endif

pkginclude_HEADERS = \
                     include/libcouchbase/arguments.h \
                     include/libcouchbase/assert.h \
                     include/libcouchbase/behavior.h \
                     include/libcouchbase/callbacks.h \
                     include/libcouchbase/cntl.h \
                     include/libcouchbase/compat.h \
                     include/libcouchbase/configuration.h \
                     include/libcouchbase/couchbase.h \
                     include/libcouchbase/durability.h \
                     include/libcouchbase/error.h \
                     include/libcouchbase/http.h \
                     include/libcouchbase/sanitycheck.h \
                     include/libcouchbase/timings.h \
                     include/libcouchbase/types.h \
                     include/libcouchbase/visibility.h \
                     plugins/io/iocp/iocp_iops.h \
                     plugins/io/select/select_io_opts.h

if BUILD_LIBCOUCHBASE_DEBUG
pkginclude_HEADERS += include/libcouchbase/debug.h
endif

pkginclude_HEADERS += \
                     plugins/io/libev/libev_io_opts.h \
                     plugins/io/libevent/libevent_io_opts.h \
                     plugins/io/libuv/libuv_io_opts.h

nobase_pkginclude_HEADERS = \
                             plugins/io/libuv/plugin-internal.h \
                             plugins/io/libuv/plugin-libuv.c

libhttpparser_la_SOURCES = \
                        contrib/http_parser/http_parser.c \
                        contrib/http_parser/http_parser.h
libhttpparser_la_CFLAGS =  $(AM_NOWARN_CFLAGS)
libhttpparser_la_CPPFLAGS =  $(AM_NOWARN_CPPFLAGS)

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

libvbucket_la_SOURCES = \
                        include/libvbucket/vbucket.h \
                        include/libvbucket/visibility.h \
                        contrib/libvbucket/hash.h \
                        contrib/libvbucket/cJSON.c \
                        contrib/libvbucket/cJSON.h \
                        contrib/libvbucket/vbucket.c
libvbucket_la_LIBADD = libketama.la libcrc32.la
libvbucket_la_DEPENDENCIES = libketama.la libcrc32.la
libvbucket_la_CFLAGS =  $(AM_NOWARN_CFLAGS)
libvbucket_la_CPPFLAGS =  $(AM_NOWARN_CPPFLAGS)

libketama_la_SOURCES = contrib/libvbucket/ketama.c
libketama_la_CFLAGS =  $(AM_NOWARN_CFLAGS)
libketama_la_CPPFLAGS =  $(AM_NOWARN_CPPFLAGS)


libcrc32_la_SOURCES = contrib/libvbucket/crc32.c
libcrc32_la_CFLAGS = $(AM_NOWARN_CFLAGS)
libcrc32_la_CPPFLAGS = $(AM_NOWARN_CPPFLAGS)

libcouchbase_debug_la_LDFLAGS = $(AM_LDFLAGS) \
       -version-info 1:0:0 \
       -no-undefined $(AM_PROFILE_SOLDFLAGS)
libcouchbase_debug_la_CPPFLAGS = $(AM_CPPFLAGS) $(CPPFLAGS) \
       -DLIBCOUCHBASE_INTERNAL=1

libcouchbase_debug_la_DEPENDENCIES = libcouchbase.la
libcouchbase_debug_la_LIBADD = libcouchbase.la

libcouchbase_debug_la_SOURCES = \
   debug/debug.cc

libcouchbase_la_SOURCES = \
                        include/ep-engine/command_ids.h \
                        include/memcached/protocol_binary.h \
                        include/memcached/vbucket.h \
                        plugins/io/select/plugin-select.c \
                        plugins/io/select/select_io_opts.h \
                        src/arithmetic.c \
                        src/base64.c \
                        src/bconf_io.c \
                        src/bconf_parse.c \
                        src/bconf_provider.c \
                        src/cntl.c \
                        src/compat.c \
                        src/config_cache.c \
                        src/config_static.h \
                        src/connect.c \
                        src/cookie.c \
                        src/durability.c \
                        src/durability_internal.h \
                        src/error.c \
                        src/flush.c \
                        src/genhash.c \
                        src/genhash.h \
                        src/get.c \
                        src/gethrtime.c \
                        src/handler.c \
                        src/handler.h \
                        src/hashset.c \
                        src/hashset.h \
                        src/hashtable.c \
                        src/http.c \
                        src/http_io.c \
                        src/http_parse.c \
                        src/instance.c \
                        src/internal.h \
                        src/lcbio.h \
                        src/list.c \
                        src/list.h \
                        src/observe.c \
                        src/packet.c \
                        src/readwrite.c \
                        src/remove.c \
                        src/ringbuffer.c \
                        src/ringbuffer.h \
                        src/sanitycheck.c \
                        src/server.c \
                        src/server_connect.c \
                        src/server_io.c \
                        src/server_parse.c \
                        src/stats.c \
                        src/store.c \
                        src/strerror.c \
                        src/synchandler.c \
                        src/timer.c \
                        src/timings.c \
                        src/touch.c \
                        src/trace.h \
                        src/url_encoding.c \
                        src/url_encoding.h \
                        src/utilities.c \
                        src/verbosity.c \
                        src/wait.c

libcouchbase_la_LDFLAGS= $(AM_LDFLAGS) -version-info $(API_CURRENT):$(API_REVISION):$(API_AGE) -no-undefined $(AM_PROFILE_SOLDFLAGS)
libcouchbase_la_CPPFLAGS=$(AM_CPPFLAGS) $(CPPFLAGS) -DLIBCOUCHBASE_INTERNAL=1 -DLCB_LIBDIR="\"${libdir}\""
libcouchbase_la_DEPENDENCIES=libcbsasl.la libhttpparser.la libvbucket.la
libcouchbase_la_LIBADD=libcbsasl.la libhttpparser.la libvbucket.la

if LIBCOUCHBASE_ENABLE_TRACE
libcouchbase_la_SOURCES += \
                        src/debug.c \
                        src/debug.h

libcouchbase_la_CPPFLAGS += -DLCB_DEBUG_NOCTX
endif

if ENABLE_DTRACE
BUILT_SOURCES += src/probes.h
CLEANFILES += src/probes.h

src/probes.h: src/probes.d
	$(DTRACE) -C -h -s $< -o $@

probes.o: src/probes.d
	$(DTRACE) -C $(DTRACE_DASH_G) -s $< -o $@

probes.lo: probes.o
	$(AM_V_GEN)printf %s\\n \
	  '# $@ - a libtool object file' \
	  '# Generated by libtool (GNU libtool) 2.4' \
	  '# Actually generated by Makefile.am, in order to shut up libtool' \
	  "pic_object='$<'" \
	  "non_pic_object='$<'" \
	> $@

if DTRACE_INSTRUMENT_OBJECT

# We need to change the name from src/libcouchbase_la-fname.lo to
# src/.libs/libcouchbase_la-fname.o ;)
LIBCOUCHBASE_OBJS=$(libcouchbase_la_OBJECTS:%lo=%o)
LIBCOUCHBASE_OBJECTS=$(LIBCOUCHBASE_OBJS:src%=src/.libs%)
src/libcouchbase_la-probes.lo: $(libcouchbase_la_OBJECTS) src/probes.h
	$(DTRACE) $(DTRACEFLAGS) -C -G \
                  -o src/.libs/libcouchbase_la-probes.o \
                  -s ${srcdir}/src/probes.d \
                  $(LIBCOUCHBASE_OBJECTS)
	@$(DTRACE) $(DTRACEFLAGS) -C -G \
                  -o src/libcouchbase_la-probes.o \
                  -s ${srcdir}/src/probes.d \
                  $(LIBCOUCHBASE_OBJS) 2>/dev/null || /bin/true
	sed -e s,instance,probes,g src/libcouchbase_la-instance.lo > src/libcouchbase_la-probes.lo

libcouchbase_la_DEPENDENCIES += src/libcouchbase_la-probes.lo
libcouchbase_la_LIBADD += src/libcouchbase_la-probes.lo
else
if !APPLE_DTRACE
libcouchbase_la_DEPENDENCIES += probes.lo
libcouchbase_la_LIBADD += probes.lo
endif

endif

endif

libcouchbase_la_SOURCES += src/iofactory.c
if HAVE_WINSOCK2
libcouchbase_la_SOURCES += \
                           plugins/io/iocp/iocp_iops.c \
                           plugins/io/iocp/iocp_iops.h \
                           plugins/io/iocp/iocp_loop.c \
                           plugins/io/iocp/iocp_timer.c \
                           plugins/io/iocp/iocp_util.c

libcouchbase_la_CPPFLAGS += -Iwin32 -Iplugins/io/iocp
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

tests_unit_tests_SOURCES = \
                           src/base64.c \
                           src/hashset.c \
                           src/list.c \
                           src/ringbuffer.c \
                           src/url_encoding.c \
                           tests/base64-unit-test.cc \
                           tests/behavior-unit-tests.cc \
                           tests/ccbc_103.cc \
                           tests/cluster-unit-tests.cc \
                           tests/hashset-unit-test.cc \
                           tests/hostname-unit-test.cc \
                           tests/list-unit-test.cc \
                           tests/memcached-compat-unit-test.cc \
                           tests/ringbuffer-unit-test.cc \
                           tests/strerror-unit-test.cc \
                           tests/timeout.c \
                           tests/unit_tests.cc \
                           tests/url_encoding-tests.cc

tests_unit_tests_DEPENDENCIES = libcouchbase.la
tests_unit_tests_LDADD = libcouchbase.la libvbucket.la
tests_unit_tests_CFLAGS = $(AM_NOWARN_CFLAGS)
tests_unit_tests_CPPFLAGS = $(AM_NOWARN_CPPFLAGS)
tests_unit_tests_CXXFLAGS = $(AM_NOWARN_CXXFLAGS)

gtest-1.7.0.zip:
	@echo "+--------------------------------+"
	@echo "| Download Google test framework |"
	@echo "+--------------------------------+"
	${DOWNLOAD} gtest-1.7.0.zip http://googletest.googlecode.com/files/gtest-1.7.0-rc1.zip


if HAVE_CXX
# C++ compiler needed to build google test
if HAVE_GOOGLETEST_SRC
noinst_LTLIBRARIES += libgtest.la
libgtest_la_SOURCES = tests/gtest-sources.cc
libgtest_la_CPPFLAGS = $(AM_NOWARN_CPPFLAGS) -I$(GTEST_ROOT) -I$(GTEST_ROOT)/include
libgtest_la_CXXFLAGS = $(AM_NOWARN_CXXFLAGS)

tests_unit_tests_DEPENDENCIES += libgtest.la
tests_unit_tests_LDADD += libgtest.la -lpthread
tests_unit_tests_CPPFLAGS += -I$(GTEST_ROOT) -I$(GTEST_ROOT)/include $(NO_WERROR)
endif
endif

if DOWNLOAD_GTEST
gtest-1.7.0: gtest-1.7.0.zip
	${UNZIP} -o -qq gtest-1.7.0.zip
BUILT_SOURCES += gtest-1.7.0
CLEANFILES += gtest-1.7.0.zip
endif

distclean-local:
	@rm -rf gtest-1.7.0

if !HAVE_GOOGLETEST_SRC
tests_unit_tests_LDADD += -lgtest -lpthread
endif

tests/CouchbaseMock.jar:
	@echo "+---------------------------------------------+"
	@echo "| Download CouchbaseMock for functional tests |"
	@echo "+---------------------------------------------+"
	${DOWNLOAD} tests/CouchbaseMock.jar http://files.couchbase.com/maven2/org/couchbase/mock/CouchbaseMock/0.6-SNAPSHOT/CouchbaseMock-0.6-20130903.160518-3.jar

libmockserver_la_LDFLAGS = $(AM_LDFLAGS) $(AM_PROFILE_SOLDFLAGS)
libmockserver_la_DEPENDENCIES = tests/CouchbaseMock.jar
libmockserver_la_SOURCES = \
                         tests/server.c tests/server.h \
                         tests/procutil.c tests/procutil.h


example_syncmode_syncmode_SOURCES = example/syncmode/main.c
example_syncmode_syncmode_DEPENDENCIES = libcouchbase.la
example_syncmode_syncmode_LDADD = libcouchbase.la

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
                   example/observe/observe \
                   example/syncmode/syncmode
if HAVE_LIBYAJL2
noinst_PROGRAMS += example/yajl/couchview
endif
endif

if BUILD_LIBCOUCHBASE_DEBUG
noinst_PROGRAMS += example/debug/debug
endif

example_yajl_couchview_SOURCES = example/yajl/couchview.c
example_yajl_couchview_LDADD = libcouchbase.la -lyajl

if HAVE_CXX
if HAVE_GOOGLETEST
# we can't build the test program without a C++ compiler
check_PROGRAMS += tests/unit-tests
endif
endif

if HAVE_COUCHBASEMOCK
noinst_LTLIBRARIES += libmockserver.la
tests_unit_tests_SOURCES += \
                            tests/arithmetic-unit-test.cc \
                            tests/configcache-unit-test.cc \
                            tests/durability-unit-test.cc \
                            tests/get-unit-test.cc \
                            tests/getopt-unit-tests.cc \
                            src/gethrtime.c \
                            tests/http-tests.cc \
                            tests/iops-unit-test.cc \
                            tests/lock-unit-test.cc \
                            tests/mock-environment.cc \
                            tests/mock-environment.h \
                            tests/mock-unit-test.cc \
                            tests/mock-unit-test.h \
                            tests/mutate-unit-test.cc \
                            tests/regression-unit-test.cc \
                            tests/procutil.c \
                            tests/procutil.h \
                            tests/server.c \
                            tests/server.h \
                            tests/serverops-unit-test.cc \
                            tests/serverparams.h \
                            tests/syncmode-unit-tests.cc \
                            tests/testutil.cc \
                            tests/testutil.h

tests_unit_tests_LDADD += libmockserver.la
check_PROGRAMS += tests/smoke-test
endif

tests_smoke_test_SOURCES = tests/test.h tests/smoke-test.c tests/timeout.c
tests_smoke_test_LDADD = libcouchbase.la libmockserver.la

check_PROGRAMS += tests/check-all
tests_check_all_SOURCES = tests/check-all.cc tools/commandlineparser.cc tests/procutil.c
tests_check_all_CPPFLAGS = $(AM_CPPFLAGS) -I"${srcdir}/tools"
tests_check_all_LDADD = libcouchbase.la

tools_cbc_DEPENDENCIES = libcouchbase.la libvbucket.la
tools_cbc_LDADD = $(tools_cbc_DEPENDENCIES)

if HAVE_LIBYAJL2
tools_cbc_LDADD += -lyajl
endif
tools_cbc_SOURCES =	\
					tools/cbc.cc \
					tools/cbc-util.cc \
					tools/cbc-util.h \
					tools/configuration.cc	\
					tools/commandlineparser.cc \
					tools/commandlineparser.h \
					tools/configuration.h

tools_cbc_pillowfight_SOURCES = tools/commandlineparser.cc \
                                tools/cbc-pillowfight.cc \
                                src/gethrtime.c
tools_cbc_pillowfight_LDADD = libcouchbase.la  -lpthread


TESTS_ENVIRONMENT = export outdir="$(top_builddir)/tests";

TESTS = tests/check-all

if BUILD_TOOLS
if HAVE_CXX
TESTS += tests/homebrew-acceptance-test
endif
endif

example_debug_debug_SOURCES = example/debug/debug.cc
example_debug_debug_LDADD = libcouchbase_debug.la

debug_sizes_SOURCES = debug/sizes.c

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

EXTRA_DIST = \
             CMakeLists.txt \
             CONTRIBUTING.md \
             LICENSE \
             Makefile.manpage.inc \
             NMakefile \
             README.markdown \
             RELEASE_NOTES.markdown \
             contrib/libvbucket/rfc1321 \
             include/ep-engine/README \
             include/libcouchbase/configuration.h.in \
             include/memcached/COPYING \
             include/memcached/README \
             man/bsd \
             man/svr4 \
             src/probes.d \
             tests/start_mock.sh \
             win32 \
             VERSION

if HAVE_DOXYGEN
docs:
	(cd tests; $(DOXYGEN))
else
docs:
	@echo "You need doxygen to generate test documentation"
endif


LINTFLAGS=-Iinclude -b -c -errchk=%all \
          -erroff=E_INCL_NUSD,E_CAST_INT_TO_SMALL_INT,E_PTRDIFF_OVERFLOW  \
          -errtags=yes -errhdr=%user \
          -errsecurity=extended -fd -Ncheck=%all -Nlevel=4 -n -Xc99=none
lint:
	$(LINT.c) $(libcouchbase_la_SOURCES)

reformat:
	astyle --mode=c \
               --quiet \
               --style=1tbs \
               --indent=spaces=4 \
               --indent-namespaces \
               --indent-col1-comments \
               --max-instatement-indent=78 \
               --pad-oper \
               --pad-header \
               --add-brackets \
               --unpad-paren \
               --align-pointer=name \
               --align-reference=name \
               $(top_srcdir)/debug/*.cc \
               $(top_srcdir)/example/*/*.c \
               $(top_srcdir)/include/libcouchbase/*.[ch] \
               $(top_srcdir)/plugins/io/*/*.[ch] \
               $(top_srcdir)/src/*.[ch] \
               $(top_srcdir)/tests/*.{cc,c,h} \
               $(top_srcdir)/tools/*.{cc,h} \
               $(top_srcdir)/win32/*.[ch]

regenerate-manpage:
	$(top_srcdir)/man/generate.sh

sinclude packaging/*/package.mk
