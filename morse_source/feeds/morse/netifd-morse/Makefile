include $(TOPDIR)/rules.mk

PKG_NAME:=netifd-morse
PKG_RELEASE=1

PKG_LICENSE:=GPLv2
PKG_LICENSE_FILES:=

PKG_MAINTAINER:=Morse Micro

include $(INCLUDE_DIR)/package.mk

define Package/netifd-morse
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Morse Micro HaLow support for netifd
  DEPENDS:= +kmod-morse +kmod-cfg80211 +netifd +@BUSYBOX_CONFIG_USLEEP +morse-regdb
endef

define Build/Compile
endef

define Package/netifd-morse/install
	$(INSTALL_DIR) $(1)/lib/
	$(CP) ./lib/* $(1)/lib/
endef

$(eval $(call BuildPackage,netifd-morse))