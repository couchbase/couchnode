all: binding src/ deps/
	@node-gyp build

binding: binding.gyp
	@node-gyp configure

clean:
	@node-gyp clean

install:
	@npm install

node_modules:
	@npm install

checkdeps:
	npm run check-deps

checkaudit:
	npm audit

test: node_modules
	npm run test
fasttest: node_modules
	npm run test-fast

lint: node_modules
	npm run lint

cover: node_modules
	npm run cover
fastcover: node_modules
	npm run cover-fast

check: checkdeps checkaudit docs lint test cover

docs: node_modules
	npm run build-docs

prebuilds:
	npm run prebuild

.PHONY: all test clean docs browser prebuilds
