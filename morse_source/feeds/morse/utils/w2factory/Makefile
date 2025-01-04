#
#  Copyright (C) 2021-2022 Morse Micro Pty Ltd. All rights reserved
#

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=w2factory
PKG_VERSION:=1
PKG_RELEASE:=1



include $(INCLUDE_DIR)/package.mk

define KernelPackage/w2factory
	SUBMENU:=Other modules
	TITLE:=Write-enabler for MTD factory partition
	FILES:=$(PKG_BUILD_DIR)/w2factory.ko
endef

define KernelPackage/w2factory/description
	A kernel module that temporarily makes MTD factory partition writeable.
endef

MAKE_OPTS:= \
	ARCH="$(LINUX_KARCH)" \
	CROSS_COMPILE="$(TARGET_CROSS)" \
	M="$(PKG_BUILD_DIR)"


define Build/Compile
	$(MAKE) -C "$(LINUX_DIR)" \
			$(MAKE_OPTS) \
			CONFIG_W2FACTORY=m \
			modules
endef

$(eval $(call KernelPackage,w2factory))
