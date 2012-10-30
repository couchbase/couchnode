SOURCE = src/couchbase_impl.cc src/couchbase_impl.h src/args.cc src/notify.cc     \
         src/namemap.cc src/operations.cc src/namemap.h src/cas.cc      \
         src/cas.h
REPORTER = spec

all: .lock-wscript $(SOURCE)
	@node-waf build

.lock-wscript: wscript
	@node-waf configure

test:
	@./node_modules/.bin/mocha \
		--require should \
		--reporter $(REPORTER) \
		tests/*.js

docs: test-docs

test-docs:
	make test REPORTER=doc \
		| cat docs/head.html - docs/tail.html \
		> docs/test.html

.PHONY: test docs

clean:
	@node-waf clean

install:
	@node-waf install

dist:
	@node-waf dist

check:
	(cd tests && ./runtests.sh 0*.js)

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
