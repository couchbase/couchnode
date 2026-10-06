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

# test/v2 runs as four projects. `unit` needs no server at all, `integration`
# runs its files in parallel, `exclusive` holds the suites that create and drop
# buckets, whose files never overlap anything because cluster RAM quota is
# finite, and `periodic` holds the slow eventing function management suites.
# The targets below are the CI axes:
#
#   target      when           projects             tier     server
#   v2typecheck every push     (tsc, no tests)      any      none
#   v2unit      every push     unit                 fast     none
#   v2fast      pull request   unit + integration   fast     current
#   v2slow      merge          unit + int + excl    slow     current
#   v2nightly   nightly        unit + int + excl    nightly  current, mock
#   v2periodic  on request     periodic             any      current
#
# The server is the job's CNCSTR; a 6.6 axis is v2slow pointed at a 6.6
# cluster. With CNJUNIT set to a path, e.g. `CNJUNIT=build/junit/v2slow.xml`,
# a run writes a JUnit file whose skipped tests carry their reason.
#
# `test:v2` excludes the periodic project. v2fast has its own script because
# a negated `--project '!periodic'` matches every other project and so would
# also select `exclusive`; `selftest/projects.test.ts` checks each script's
# real selection. v2periodic names no CNTIER: project membership is its gate.
#
# Vitest strips types without checking them, so v2typecheck is where `test/v2`
# is type checked; v2unit depends on it so every push gets it.
v2typecheck: node_modules
	npm run typecheck:test
v2unit: node_modules v2typecheck
	npm run test:v2:unit
v2fast: node_modules
	CNTIER=fast npm run test:v2:fast
v2slow: node_modules
	CNTIER=slow npm run test:v2
v2nightly: node_modules
	CNTIER=nightly npm run test:v2
v2periodic: node_modules
	npm run test:v2:periodic

# `cover` and `fastcover` run nyc over the mocha suite in `test/`; `v2cover`
# runs Vitest's v8 provider over test/v2.
v2cover: node_modules
	npm run cover:v2

check: checkdeps checkaudit docs lint test cover

docs: node_modules
	npm run build-docs

prebuilds:
	npm run prebuild

.PHONY: all test clean docs browser prebuilds v2typecheck v2unit v2fast v2slow v2nightly v2periodic v2cover
