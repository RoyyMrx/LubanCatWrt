include $(TOPDIR)/rules.mk

PKG_NAME:=morse-board-config
PKG_RELEASE=2


PKG_SOURCE_VERSION:=$(PKG_VERSION)
PKG_VERSION:=rel_1_8_1_2023_May_25
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=9de9858bd32f8e57040ff3e8a42cb243c0ed948dcd6b004caef18b8598487c3f

ARCHIVE:=MORSE_BCF.tar


PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

PKG_CONFIG_DEPENDS:=CONFIG_MORSE_BCF_DEVICE_ID

RSTRIP:=:

include ../../include/morse.mk
include $(INCLUDE_DIR)/kernel.mk
include $(INCLUDE_DIR)/package.mk

define Package/morse-board-config
  SECTION:=firmware
  CATEGORY:=Firmware
  URL:=$(PKG_SOURCE_URL)
  TITLE:=Morse Micro WIFI HaLow Board Config File
  PROVIDES:=morse-board-config
endef

define Package/morse-board-config/config
       config MORSE_BCF_DEVICE_ID
            string "morse board config device ID"
            default "default"
            depends on PACKAGE_morse-board-config
endef

define Build/Compile

endef

define Package/morse-board-config/install
	$(INSTALL_DIR) $(1)/lib/firmware/morse/.
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/lib/firmware/morse/bcf_$(CONFIG_MORSE_BCF_DEVICE_ID).bin $(1)/lib/firmware/morse/bcf_default.bin
endef

$(eval $(call BuildPackage,morse-board-config))

