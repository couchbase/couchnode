.PHONY: dist-rpm

RPM_WORKSPACE=$(shell pwd)/build_RPM
RPM_DIR=$(RPM_WORKSPACE)/rpmbuild
VERSCRIPT=./packaging/parse-git-describe.pl --input=$(REVDESCRIBE)
RPM_VER=$(shell $(VERSCRIPT) --rpm-ver)
RPM_REL=$(shell $(VERSCRIPT) --rpm-rel)
TARNAME=$(shell $(VERSCRIPT) --tar)

dist-rpm: dist
	rm -rf $(RPM_WORKSPACE)
	mkdir -p $(RPM_DIR)
	mkdir $(RPM_DIR)/SOURCES
	mkdir $(RPM_DIR)/BUILD
	mkdir $(RPM_DIR)/RPMS
	mkdir $(RPM_DIR)/SRPMS
	cp $(PACKAGE)-$(TARNAME).tar.gz $(RPM_DIR)/SOURCES
	sed \
		's/@VERSION@/$(RPM_VER)/g;s/@RELEASE@/$(RPM_REL)/g;s/@TARREDAS@/libcouchbase-$(TARNAME)/g' \
		< packaging/rpm/$(PACKAGE).spec.in > $(RPM_WORKSPACE)/$(PACKAGE).spec

	(cd $(RPM_WORKSPACE) && \
		rpmbuild ${RPM_FLAGS} -ba \
		--define "_topdir $(RPM_DIR)" \
		$(PACKAGE).spec \
	)

	mv $(RPM_DIR)/RPMS/*/*.rpm `pwd`
	mv $(RPM_DIR)/SRPMS/*.rpm `pwd`
	rm -rf $(RPM_WORKSPACE)
