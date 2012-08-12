all: .lock-wscript src/couchbase.cc src/couchbase.h src/args.cc src/notify.cc
	@node-waf build

.lock-wscript: wscript
	@node-waf configure

clean:
	@node-waf clean

install:
	@node-waf install

dist:
	@node-waf dist

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
