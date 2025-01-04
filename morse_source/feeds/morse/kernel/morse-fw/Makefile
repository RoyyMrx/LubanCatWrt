include $(TOPDIR)/rules.mk

PKG_NAME:=morse-fw
PKG_RELEASE=2


PKG_SOURCE_VERSION:=$(PKG_VERSION)
PKG_VERSION:=rel_1_8_1_2023_May_25
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=33387423d19e69f2ffc4b92aba2f4d37cdd19f5eafdb5a8b2bbd6dfcc44924a3

ARCHIVE:=FW.tar

PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

RSTRIP:=:

include ../../include/morse.mk
include $(INCLUDE_DIR)/kernel.mk
include $(INCLUDE_DIR)/package.mk

define Package/morse-fw
  SECTION:=firmware
  CATEGORY:=Firmware
  URL:=$(PKG_SOURCE_URL)
  TITLE:=Morse Micro WIFI HaLow firmware
  PROVIDES:=morse-fw
endef

define Build/Compile

endef

define Package/morse-fw/install
	$(INSTALL_DIR) $(1)/lib/firmware/morse/.
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/lib/firmware/morse/mm6108.bin $(1)/lib/firmware/morse
endef

$(eval $(call BuildPackage,morse-fw))

