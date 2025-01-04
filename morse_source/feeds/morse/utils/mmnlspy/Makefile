include $(TOPDIR)/rules.mk

PKG_NAME:=mmnlspy
PKG_RELEASE=1


PKG_LICENSE:=GPLv2

PKG_SOURCE_VERSION:=$(PKG_VERSION)
PKG_VERSION:=rel_1_8_1_2023_May_25
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=be262c83f6b3c0b5a5ec5601187fca124018b6556ed8b24c4b580c3b0435b170


PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk

define Package/mmnlspy
  SECTION:=utils
  CATEGORY:=Network
  TITLE:=Morse Micro WIFI HaLow test tools
  DEPENDS:= +kmod-morse +libnl 
  FILES:=\
	$(PKG_BUILD_DIR)/mmnlspy 
endef

MAKE_FLAGS += \
	MMNLSPY_VERSION_STRING=$(PKG_SOURCE_VERSION)

TARGET_CFLAGS += -I$(STAGING_DIR)/usr/include/libnl3  
TARGET_LDFLAGS += -lnl-3 -lnl-genl-3 -lm 

define Package/mmnlspy/install
	$(INSTALL_DIR) $(1)/sbin 
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/mmnlspy $(1)/sbin/
endef

$(eval $(call BuildPackage,mmnlspy))
