include $(TOPDIR)/rules.mk

PKG_NAME:=morsectrl
PKG_RELEASE=3


PKG_LICENSE:=GPLv2
PKG_LICENSE_FILES:=

REL_1_4 =rel_1_4
MTK_BOARD =ramips

PKG_SOURCE_VERSION:=$(PKG_VERSION)
PKG_VERSION:=rel_1_8_1_2023_May_25
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=914bb81509ff2c4fed9528f9dd6c3e30a65e55f9a14a753c1e6421b0b0443004

ARCHIVE:=$(PKG_NAME)_$(PKG_VERSION).zip

PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

include ../../include/morse.mk
include $(INCLUDE_DIR)/package.mk

define Package/morsectrl
  SECTION:=utils
  CATEGORY:=Network
  TITLE:=Morse Micro WIFI HaLow driver tools
  DEPENDS:= +kmod-morse +libnl 
  FILES:=\
	$(PKG_BUILD_DIR)/morsectrl \
	$(PKG_BUILD_DIR)/morse_cli
  PROVIDES:=morsectrl
endef

MAKE_FLAGS += \
    MORSECTRL_VERSION_STRING=$(PKG_VERSION) \
    CONFIG_MORSE_TRANS_NL80211=1 \

ifneq (,$(findstring $(MTK_BOARD),$(BOARD)))
  MAKE_FLAGS +=DEFAULT_INTERFACE_NAME=wlan1
endif

TARGET_CFLAGS += -I$(STAGING_DIR)/usr/include/libnl3  

ifneq (,$(findstring $(REL_1_4),$(PKG_SOURCE_VERSION)))
  TARGET_LDFLAGS += -lnl-3 -lnl-genl-3 -lm
endif

define Package/morsectrl/install
	$(INSTALL_DIR) $(1)/sbin 
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/morsectrl $(1)/sbin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/morse_cli $(1)/sbin/
endef

$(eval $(call BuildPackage,morsectrl))
