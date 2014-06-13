.PHONY: dist-deb
GITPARSE=$(shell pwd)/packaging/parse-git-describe.pl
DEB_WORKSPACE=$(shell pwd)/build
DEB_DIR=$(DEB_WORKSPACE)/$(PACKAGE)-$(VERSION)
DEB_VERSION=$(shell $(GITPARSE) --deb --input $(REVDESCRIBE))
TAR_VERSION=$(shell $(GITPARSE) --tar --input $(REVDESCRIBE))

dist-deb: dist
	rm -rf $(DEB_WORKSPACE)
	mkdir -p $(DEB_DIR)
	cp -r packaging/deb $(DEB_DIR)/debian
	cp $(PACKAGE)-$(TAR_VERSION).tar.gz $(DEB_WORKSPACE)/$(PACKAGE)_$(DEB_VERSION).orig.tar.gz
	(cd $(DEB_WORKSPACE); tar zxvf $(PACKAGE)_$(DEB_VERSION).orig.tar.gz)
	(\
		cd $(DEB_DIR); \
		dch --no-auto-nmu -b \
		--newversion="$(DEB_VERSION)" \
		"Release package for $(DEB_VERSION)" && \
		dpkg-buildpackage -rfakeroot ${DEB_FLAGS}\
	)
	dpkg-buildpackage -rfakeroot ${DEB_FLAGS})
	mv $(DEB_WORKSPACE)/*.{changes,deb,dsc,tar.gz} `pwd`
	rm -rf $(DEB_WORKSPACE)
