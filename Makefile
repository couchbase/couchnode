SOURCE = src/couchbase.cc src/couchbase.h src/args.cc src/notify.cc     \
         src/namemap.cc src/operations.cc src/namemap.h src/cas.cc      \
         src/cas.h

all: .lock-wscript $(SOURCE)
	@node-waf build

.lock-wscript: wscript
	@node-waf configure

clean:
	@node-waf clean

install:
	@node-waf install

dist:
	@node-waf dist

check:
	(cd tests && ./runtests.sh *t.js)

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
               src/*.cc \
               src/*.h
