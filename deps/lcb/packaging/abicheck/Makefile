all: report

OLDVER := 2.3.2
NEWVER ?= $(shell git describe)
CURDIR := $(shell pwd)
NEWROOT ?= $(CURDIR)/../../inst
OLDROOT ?= $(CURDIR)/../../../libcouchbase-$(OLDVER)/inst

report:
	# Generate the oldone
	sed 's#@VERSION@#$(OLDVER)#g;s#@INST@#$(OLDROOT)#g' < template.xml > OLD.xml
	sed 's#@VERSION@#$(NEWVER)#g;s#@INST@#$(NEWROOT)#g' < template.xml > NEW.xml
	abi-compliance-checker -lib couchbase -old OLD.xml -new NEW.xml

clean:
	rm -f NEW.xml OLD.xml
	rm -fr logs compat_reports
