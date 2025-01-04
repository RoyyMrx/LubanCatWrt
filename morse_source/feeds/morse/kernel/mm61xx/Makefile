include $(TOPDIR)/rules.mk

PKG_NAME:=morse_driver
PKG_RELEASE=3


PKG_LICENSE:=GPLv2
PKG_LICENSE_FILES:=

PKG_SOURCE_VERSION:=$(PKG_VERSION)
PKG_VERSION:=rel_1_8_1_2023_May_25
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=3dbc15e84586abddc653d630cce714b3160fe5d468e373b299dd33dbd77f7913

ARCHIVE:=morsemicro_driver_$(PKG_VERSION).zip

PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

include ../../include/morse.mk
include $(INCLUDE_DIR)/kernel.mk
include $(INCLUDE_DIR)/package.mk

DTC=$(wildcard $(LINUX_DIR)/scripts/dtc/dtc)

define KernelPackage/morse
  SUBMENU:=Wireless Drivers
  TITLE:=Morse Micro WIFI HaLow driver
  DEPENDS:= +kmod-mmc +kmod-mac80211 +kmod-trelay +kmod-lib-crc7
  FILES:=\
    $(PKG_BUILD_DIR)/morse.ko \
    $(PKG_BUILD_DIR)/dot11ah/dot11ah.ko
  AUTOLOAD:=$(call AutoProbe,morse)
  MODPARAMS.morse:=bcf=bcf_default.bin
  PROVIDES:=kmod-morse
endef

define KernelPackage/morse/config

       config MORSE_SDIO
            bool "SDIO support "
            default y
            depends on PACKAGE_kmod-morse

       config MORSE_SPI
            bool "SPI support "
            default n
            depends on PACKAGE_kmod-morse

       config MORSE_USER_ACCESS
            bool "User space access support "
            default y
            depends on PACKAGE_kmod-morse

       config MORSE_VENDOR_COMMAND
            bool "Vendor command support "
            default y
            depends on PACKAGE_kmod-morse

       config MORSE_MONITOR
            bool "Monitor mode support "
            default n
            depends on PACKAGE_kmod-morse

       config MORSE_DEBUG
            bool "Enable debug "
            default n
            depends on PACKAGE_kmod-morse

       config MORSE_RC
            bool "Enable MMRC (Morse Micro Rate Control) "
            default y
            depends on PACKAGE_kmod-morse

endef

ifeq ($(CONFIG_MORSE_SDIO),y)
  NOSTDINC_FLAGS += -DCONFIG_MORSE_SDIO
  MORSE_MAKEDEFS += CONFIG_MORSE_SDIO=y
endif

ifeq ($(CONFIG_MORSE_SPI),y)
  MORSE_MAKEDEFS += CONFIG_MORSE_SPI=y
endif

ifeq ($(CONFIG_MORSE_USER_ACCESS),y)
  NOSTDINC_FLAGS += -DCONFIG_MORSE_USER_ACCESS
  MORSE_MAKEDEFS += CONFIG_MORSE_USER_ACCESS=y
endif

ifeq ($(CONFIG_MORSE_VENDOR_COMMAND),y)
  NOSTDINC_FLAGS += -DCONFIG_MORSE_VENDOR_COMMAND
  MORSE_MAKEDEFS += CONFIG_MORSE_VENDOR_COMMAND=y
endif

ifeq ($(CONFIG_MORSE_MONITOR),y)
  NOSTDINC_FLAGS += -DCONFIG_MORSE_MONITOR
  MORSE_MAKEDEFS += CONFIG_MORSE_MONITOR=y
endif

ifeq ($(CONFIG_MORSE_DEBUG),y)
  NOSTDINC_FLAGS += -DCONFIG_MORSE_DEBUG
  NOSTDINC_FLAGS += -DDEBUG
  MORSE_MAKEDEFS += CONFIG_MORSE_DEBUGFS=y
  MORSE_MAKEDEFS += DEBUG=y
  MORSE_MAKEDEFS += CONFIG_MORSE_ENABLE_TEST_MODES=y
else
  MORSE_MAKEDEFS += DEBUG=n
endif

ifeq ($(CONFIG_MORSE_RC),y)
  NOSTDINC_FLAGS += -DCONFIG_MORSE_RC
  MORSE_MAKEDEFS += CONFIG_MORSE_RC=y
endif

MORSE_MAKEDEFS += \
  MORSE_VERSION=0-$(PKG_VERSION) \
  KERNEL_SRC=$(LINUX_DIR) \
  CONFIG_BACKPORT_VERSION=v5.15.58-1
# This refers to the version of mac80211 backported to OpenWrt
# Occasionally patches are required to remove some parts of the driver
# as OpenWrt may sometimes pull in further patches from later kernel versions
# than that of the mac80211 backport.

NOSTDINC_FLAGS = \
	-I$(PKG_BUILD_DIR) \
	-I$(STAGING_DIR)/usr/include/mac80211-backport/uapi \
	-I$(STAGING_DIR)/usr/include/mac80211-backport \
	-I$(STAGING_DIR)/usr/include/mac80211/uapi \
	-I$(STAGING_DIR)/usr/include/mac80211 \
	-include backport/autoconf.h \
	-include backport/backport.h
  

MORSE_MAKEDEFS += CONFIG_WLAN_VENDOR_MORSE=m 
MORSE_MAKEDEFS += V=1

NOSTDINC_FLAGS += -DMORSE_TRACE_PATH=.

include $(INCLUDE_DIR)/kernel-defaults.mk

define Build/Compile
	$(MAKE) $(MORSE_MAKEDEFS) $(PKG_JOBS) -C "$(LINUX_DIR)" \
		$(KERNEL_MAKE_FLAGS) \
		M="$(PKG_BUILD_DIR)" \
		NOSTDINC_FLAGS="$(NOSTDINC_FLAGS)" \
		modules
endef

$(eval $(call KernelPackage,morse))
