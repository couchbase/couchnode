# Beginning of tunables
#
# Location of libcouchbase source tree (should already be built)
LIBCOUCHBASE_SRC := /sources/libcouchbase
#
# Directory where libcouchbase.so is found
LIBCOUCHBASE_LIBDIR := $(LIBCOUCHBASE_SRC)/.libs
#
# location of libcouchbase headers ( <libcouchbase/couchbase.h> )
LIBCOUCHBASE_INCLUDE := $(LIBCOUCHBASE_SRC)/include
#
#
# path to a CLEAN source tree of libuv
LIBUV_SRC := $(shell pwd)/uv
#
# debug/optimization/warnings
COMPILE_FLAGS := -O0 -ggdb3 -Wall
#
# libraries which libuv.so itself requires

# LIBUV_INCLUDE is needed for building the actual plugin,
# libuv libs are required for building the test programs.
# nodejs does not come with a DSO of libuv, so you'll need
# to build your own

LIBUV_LIBS = -ldl -lpthread -lrt -lm
LIBUV_INCLUDE := $(LIBUV_SRC)/include
#
# End of tunables
# Here be dragons

LIBUV_SO=libuv.so
LIBUV_A=$(LIBUV_SRC)/uv.a

INCLUDE_FLAGS += -I$(LIBUV_INCLUDE) \
				 $(LCB_LUV_FLAGS) \
				 -I$(LIBCOUCHBASE_INCLUDE) \
				 -I$(shell pwd)

CFLAGS := $(COMPILE_FLAGS) $(INCLUDE_FLAGS)

LDFLAGS := -L$(LIBCOUCHBASE_LIBDIR) -L. \
		-Wl,-rpath=$(LIBCOUCHBASE_LIBDIR) \
		-Wl,-rpath=$(shell pwd)

# Executables should link against these
LIBS_EXE = -lcouchbase -luv

UTIL_OBJ= \
		  util/hexdump.o \
		  util/lcb_luv_yolog.o

OBJECTS= \
		read.o \
		write.o \
		socket.o \
		common.o \
		plugin-libuv.o \
		timer.o \
		$(UTIL_OBJ)

all: libcouchbase_libuv.so

depend: .depend

.depend: $(wildcard *.c)
	rm -rf $@
	$(CC) $(CFLAGS) -MM $^ >> $@

include .depend

check: test-main
	LCB_LUV_DEBUG=1 ./test-main

check-lcb: libcouchbase_libuv.so
	./run_lcb_tests.sh \
		$(LIBCOUCHBASE_SRC) \
		$(LIBCOUCHBASE_LIBDIR) \
		$(LCB_TEST_NAME)

%.o: %.c
	$(CC) -c $(CFLAGS) -fpic -o $@ $<

$(LIBUV_A):
	$(MAKE) -C uv/ CFLAGS+="$(COMPILE_FLAGS) -fPIC"
	ranlib $@

$(LIBUV_SO): $(LIBUV_A)
	$(CC) -shared -o $@ -fPIC $(LDFLAGS) \
		-Wl,--start-group \
			-Wl,-E -Wl,--whole-archive $^ -Wl,--no-whole-archive \
		-Wl,--end-group \
		$(LIBUV_LIBS)

libcouchbase_libuv.so: $(OBJECTS)
	$(CC) -shared -o $@ $(OBJECTS)

test-main: test/test.c test/simple_1.c libcouchbase_libuv.so $(LIBUV_SO)
	$(CC) -o $@ $(CFLAGS) $(LDFLAGS) $^ -lcouchbase -luv

clean:
	rm -f $(OBJECTS) *.o *.so test-main .depend

clean-all: clean
	$(MAKE) -C $(LIBUV_SRC) clean
