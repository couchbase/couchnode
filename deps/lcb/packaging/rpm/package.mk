.PHONY: dist-rpm

RPM_WORKSPACE=$(shell pwd)/build
RPM_DIR=$(RPM_WORKSPACE)/rpmbuild
RPM_VER=$(shell echo $(VERSION) | awk -F_ '{ print $$1 }')
RPM_REL=$(shell echo $(VERSION) | awk -F_ '{ print $$2"_"$$3 }')

ifeq ($(RPM_REL),_)
  RPM_REL=1
  TARPREFIX=%{name}-%{version}
else
  TARPREFIX=%{name}-%{version}_%{release}
endif

dist-rpm: dist
	rm -rf $(RPM_WORKSPACE)
	mkdir -p $(RPM_DIR)
	mkdir $(RPM_DIR)/SOURCES
	mkdir $(RPM_DIR)/BUILD
	mkdir $(RPM_DIR)/RPMS
	mkdir $(RPM_DIR)/SRPMS
	cp $(PACKAGE)-$(VERSION).tar.gz $(RPM_DIR)/SOURCES
	sed 's/@VERSION@/$(RPM_VER)/g;s/@RELEASE@/$(RPM_REL)/g;s/@TARREDAS@/$(TARPREFIX)/g' < packaging/rpm/$(PACKAGE).spec.in > $(RPM_WORKSPACE)/$(PACKAGE).spec
	(cd $(RPM_WORKSPACE); rpmbuild ${RPM_FLAGS} -ba $(PACKAGE).spec)
	mv $(RPM_DIR)/RPMS/*/*.rpm `pwd`
	mv $(RPM_DIR)/SRPMS/*.rpm `pwd`
	rm -rf $(RPM_WORKSPACE)
