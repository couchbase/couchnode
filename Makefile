SOURCE = src/buflist.h src/cas.cc src/cas.h src/commandbase.cc  \
         src/commandlist.h src/commandoptions.h src/commands.cc \
         src/commands.h src/constants.cc src/control.cc         \
         src/cookie.cc src/cookie.h src/couchbase_impl.cc       \
         src/couchbase_impl.h src/exception.cc src/exception.h  \
         src/logger.h src/namemap.cc src/namemap.h              \
         src/options.cc src/options.h src/uv-plugin-all.c       \
         src/valueformat.cc src/valueformat.h

all: binding $(SOURCE)
	@node-gyp build

binding: binding.gyp
	@node-gyp configure

clean:
	@node-gyp clean
	rm -rf jsdoc
	rm -f cbmock.js

install:
	@npm install

node_modules:
	@npm install

test: node_modules
	./node_modules/mocha/bin/mocha test/*.test.js
fasttest: node_modules
	./node_modules/mocha/bin/mocha test/*.test.js -ig "(slow)"

lint: node_modules
	./node_modules/jshint/bin/jshint lib/*.js

cover: node_modules
	node ./node_modules/istanbul/lib/cli.js cover ./node_modules/mocha/bin/_mocha -- test/*.test.js
fastcover: node_modules
	node ./node_modules/istanbul/lib/cli.js cover ./node_modules/mocha/bin/_mocha -- test/*.test.js -ig "(slow)"

check: test lint cover

docs: node_modules
	node ./node_modules/jsdoc/jsdoc.js -c .jsdoc

browser: lib/mock.js lib/viewQuery.js
	browserify -r "./lib/mock.js:cbmock" > cbmock.js

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

.PHONY: all test clean docs browser
