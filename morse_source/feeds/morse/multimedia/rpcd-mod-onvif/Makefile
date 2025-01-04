#
# Copyright (C) 2016-2017 Jo-Philipp Wich <jo@mein.io>
#
# Licensed under the Apache License, Version 2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=rpcd-mod-onvif
PKG_RELEASE:=1

PKG_SOURCE_VERSION:=1.0.2
PKG_VERSION=$(PKG_SOURCE_VERSION)
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=4094d06bda9bd1e477fce6ec81bc1342c08eadc7d906c383d4f58339c900d46a


PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define Package/rpcd-mod-onvif
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=rpcd module for ONVIF devices
  DEPENDS:=+rpcd +libubox +libubus +libopenssl +zlib
endef

define Package/rpcd-mod-onvif/description
  Communication with with ONVIF devices via ubus.
endef

define Package/rpcd-mod-onvif/install
	$(INSTALL_DIR) $(1)/usr/lib/rpcd
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/onvif.so $(1)/usr/lib/rpcd/
endef

define Package/rpcd-mod-onvif/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || /etc/init.d/rpcd reload
endef

$(eval $(call BuildPackage,rpcd-mod-onvif))
