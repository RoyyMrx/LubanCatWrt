include $(TOPDIR)/rules.mk

PKG_NAME:=morse-remote-client
PKG_RELEASE=1
PKG_LICENSE:=GPLv2
PKG_MAINTAINER:=Morse Micro

include $(INCLUDE_DIR)/package.mk

define Package/morse-remote-client
  SECTION:=Utilities
  CATEGORY:=Utilities
  TITLE:=Morse Micro RPC configuration utility
  PKGARCH:=all
  DEPENDS:=+rpcd +umdns
endef

define Build/Compile
endef

define Package/morse-remote-client/install
	$(INSTALL_DIR) $(1)/usr/
	$(INSTALL_DIR) $(1)/etc/
	$(CP) ./files/usr/* $(1)/usr/
	$(CP) ./files/etc/* $(1)/etc/
endef

$(eval $(call BuildPackage,morse-remote-client))