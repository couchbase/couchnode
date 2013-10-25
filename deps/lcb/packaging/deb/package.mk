# The following code will transform VERSION variable to more debian like
# representation. Given we have two cases for versioning:
#
# 1. Current HEAD is pointing to tagged revision (let it be '1.7.2')
#
#       $ git describe
#       1.7.2
#
#    The perl script config/version.pl helps us to initialize VERSION
#    variable to value '1.7.2'. The 'deb' task will set its variables to
#    values below:
#
#    DEB_VERSION="1.7.2"
#    DEB_VERSION="1.7.2"
#
#    It lead to package files named '{package_name}_1.7.2_{arch}.deb'
#
# 2. Current HEAD is pointing to third commit after latest tagged version
#
#       $ git describe
#       1.7.2-3-ge62b67f
#
#   config/version.pl yields '1.7.2_3_ge62b67f' and sed script below will
#   match combination '_3_ge62b67f' and replace with '+3~ge62b67f' which
#   fits .deb versioning needs. The user is able to determine what
#   HEAD was used to build this package and use 'dpkg' utility to compare
#   versions:
#
#       $ dpkg --compare-versions 1.7.2+3~e62b67f-1 gt 1.7.2
#       $ echo $?
#       0
#       $ dpkg --compare-versions 1.7.2+3~e62b67f-1 gt 1.7.2+1~f84dad7-1
#       $ echo $?
#       0
#
# This schema is safe because it will use plain tag if sed expression
# doesn't match.
#
.PHONY: dist-deb

DEB_WORKSPACE=$(shell pwd)/build
DEB_DIR=$(DEB_WORKSPACE)/$(PACKAGE)-$(VERSION)
DEB_VERSION=$(shell echo $(VERSION) | sed "s/_\([0-9]\+\)_g\([0-9a-z]\+\)/+\1~\2/")

dist-deb: dist
	rm -rf $(DEB_WORKSPACE)
	mkdir -p $(DEB_DIR)
	cp -r packaging/deb $(DEB_DIR)/debian
	cp $(PACKAGE)-$(VERSION).tar.gz $(DEB_WORKSPACE)/$(PACKAGE)_$(DEB_VERSION).orig.tar.gz
	(cd $(DEB_WORKSPACE); tar zxvf $(PACKAGE)_$(DEB_VERSION).orig.tar.gz)
	(cd $(DEB_DIR); \
	if [ "x$${DEB_SUFFIX}" = "x" ]; then DEB_SUFFIX=1; fi; \
	dch --no-auto-nmu --newversion "$(DEB_VERSION)-$${DEB_SUFFIX}" "Released debian package for version $(DEB_VERSION)" && \
	dpkg-buildpackage -rfakeroot ${DEB_FLAGS})
	mv $(DEB_WORKSPACE)/*.{changes,deb,dsc,tar.gz} `pwd`
	rm -rf $(DEB_WORKSPACE)
