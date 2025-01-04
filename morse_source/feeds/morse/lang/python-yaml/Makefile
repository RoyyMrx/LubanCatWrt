#feeds/packages/lang/python/python-yaml/Makefile
# Copyright (C) 2008-2015 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=python-yaml
PKG_VERSION:=6.0
PKG_RELEASE:=$(AUTORELEASE)

PYPI_NAME:=PyYAML
PKG_HASH:=68fb519c14306fec9720a2a5b45bc9f0c8d1b9c72adf45c37baedfcd949c35a2

PKG_MAINTAINER:=Josef Schlehofer <josef.schlehofer@nic.cz>
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_CPE_ID:=cpe:/a:pyyaml_project:pyyaml

HOST_PYTHON3_PACKAGE_BUILD_DEPENDS:=Cython

HOST_BUILD_DEPENDS:=python3/host

include $(TOPDIR)/feeds/packages/lang/python/pypi.mk
include $(INCLUDE_DIR)/host-build.mk
include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/python/python3-package.mk

define Package/python3-yaml
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=Python
  TITLE:=YAML parser and emitter for Python
  URL:=https://github.com/yaml/pyyaml
  DEPENDS:=+libyaml +python3-light
endef

define Package/python3-yaml/description
  PyYAML is a YAML parser and emitter for the Python programming language.
endef

define Host/Compile
	$(call HostPython3/ModSetup,,install --prefix="" --root="$(STAGING_DIR_HOSTPKG)")
endef

Host/Install:=

PYTHON3_PKG_SETUP_GLOBAL_ARGS:=--with-libyaml
PYTHON3_PKG_SETUP_ARGS:=

$(eval $(call HostBuild))
$(eval $(call Py3Package,python3-yaml))
$(eval $(call BuildPackage,python3-yaml))
$(eval $(call BuildPackage,python3-yaml-src))
