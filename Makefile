all: .lock-wscript src/couchbase.cc src/couchbase.h
	@node-waf build

.lock-wscript: wscript
	@node-waf configure

clean:
	@node-waf clean

install:
	@node-waf install

dist:
	@node-waf dist
