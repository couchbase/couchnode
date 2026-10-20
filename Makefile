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

# The suite runs as four projects. `unit` needs no server at all,
# `integration` runs its files in parallel, `exclusive` holds the suites that
# create and drop buckets, whose files never overlap anything because cluster
# RAM quota is finite, and `periodic` holds the slow eventing function
# management suites. The targets below are the CI axes:
#
#   target        when           projects             tier     server
#   typecheck     every push     (tsc, no tests)      any      none
#   unittest      every push     unit                 fast     none
#   fasttest      pull request   unit + integration   fast     current
#   slowtest      merge          unit + int + excl    slow     current
#   nightlytest   nightly        unit + int + excl    nightly  current, mock
#   periodictest  on request     periodic             any      current
#
# `test` runs what slowtest runs, at whatever CNTIER the environment sets.
# The server is the job's CNCSTR; a 6.6 axis is slowtest pointed at a 6.6
# cluster. With CNJUNIT set to a path, e.g. `CNJUNIT=build/junit/slowtest.xml`,
# a run writes a JUnit file whose skipped tests carry their reason.
#
# `npm test` excludes the periodic project. fasttest has its own script
# because a negated `--project '!periodic'` matches every other project and so
# would also select `exclusive`; `selftest/projects.test.ts` checks each
# script's real selection. periodictest names no CNTIER: project membership is
# its gate.
#
# Vitest strips types without checking them, so typecheck is where `test/` is
# type checked; unittest depends on it so every push gets it.
test: node_modules
	npm run test
typecheck: node_modules
	npm run typecheck:test
unittest: node_modules typecheck
	npm run test:unit
fasttest: node_modules
	CNTIER=fast npm run test-fast
slowtest: node_modules
	CNTIER=slow npm run test
nightlytest: node_modules
	CNTIER=nightly npm run test
periodictest: node_modules
	npm run test:periodic

lint: node_modules
	npm run lint

# Vitest's v8 provider, over the projects `npm test` runs.
cover: node_modules
	npm run cover

check: checkdeps checkaudit docs lint test cover

docs: node_modules
	npm run build-docs

prebuilds:
	npm run prebuild

.PHONY: all test clean docs browser prebuilds lint cover typecheck unittest fasttest slowtest nightlytest periodictest
