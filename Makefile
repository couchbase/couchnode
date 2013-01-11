SOURCE = src/couchbase_impl.cc src/couchbase_impl.h src/args.cc src/notify.cc     \
         src/namemap.cc src/operations.cc src/namemap.h src/cas.cc      \
         src/cas.h

all: binding $(SOURCE)
	@node-gyp build

binding: binding.gyp
	@node-gyp configure

clean:
	@node-gyp clean

install:
	@npm install

node_modules:
	@npm install

check: node_modules
	(cd tests && ./runtests.sh *-*.js)

reformat:
	@astyle --mode=c \
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
               io/*.c io/*.h io/util/hexdump.c \
               src/*.cc \
               src/*.h
