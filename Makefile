all: binding src/ deps/
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

checkdeps:
	node ./node_modules/npm-check/lib/cli.js -s

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

check: checkdeps test lint cover

docs: node_modules
	node ./node_modules/jsdoc/jsdoc.js -c .jsdoc

prebuilds:
	node ./node_modules/prebuild/bin.js

.PHONY: all test clean docs browser prebuilds
