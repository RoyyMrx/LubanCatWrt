#
# Copyright (C) 2023 Morse Micro
#
# This is free software, licensed under the GNU General Public License, Version 2.0 .
#

#
# This fairly surprising Makefile is a bit of a frustrating hack to deploy multiple
# packages required by the router dongle.
# The correct way to do this would be to bring up our own webserver hosting our feeds
# so they can be pointed to by a device configured feeds.conf file. Doing so would
# allow proper dependency tracing of the entire router-dongle and cleaner removal.
# Unfortunately, because we do not have this server, we bundle up the .ipks which we
# care about and stuff them into this ipk, which post installation, runs over each ipk
# and installs it.
# A concurrency issue exists, on opkg in some environments/filesystems, which causes
# `opkg install` calls from inside another opkg install, to not correctly update the
# opkg index. Because of this, the install script forks to the background and waits
# before executing subsequent install commands.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=router-dongle
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0
PKG_VERSION:=1.0.0
PKG_BUILD_DEPENDS:=morse-regdb luci-lib-morseui luci-lib-morseconfig luci-app-morsedongle

include $(INCLUDE_DIR)/package.mk

define Package/router-dongle
	SECTION:=net
	CATEGORY:=Network
	MAINTAINER:=Morse Micro <support@morsemicro.com>
	TITLE:=Halow Dongle Package
	DEPENDS:=+kmod-usb-net-cdc-ether +usb-modeswitch +kmod-usb-net-rtl8152
	PKGARCH:=all
endef

define Package/router-dongle/description
 Bundles all packages required for the Halow Dongle
endef

define Build/Compile
	$(foreach ipkg,$(PKG_BUILD_DEPENDS),
		$(FIND) $(call FeedPackageDir,$(ipkg)) -type f \
		-name '$(ipkg)_*.ipk' -exec $(CP) {} $(ipkg).ipk \;
	)
endef

define Build/Configure
endef

define Package/router-dongle/install
	$(INSTALL_DIR) $(1)/tmp/
	$(INSTALL_DIR) $(1)/tmp/packages
	$(INSTALL_DIR) $(1)/morse/scripts/
	$(foreach ipkg,$(PKG_BUILD_DEPENDS),
		$(INSTALL_BIN) ./$(ipkg).ipk $(1)/tmp/packages/$(ipkg).ipk
	)
	$(INSTALL_BIN) ./files/router-dongle-batch.sh $(1)/tmp/router-dongle-batch.sh
	$(INSTALL_BIN) ./files/netsetup.sh $(1)/morse/scripts/

endef

define Package/router-dongle/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/tmp/router-dongle-batch.sh $(PKG_BUILD_DEPENDS) &
}
endef

$(eval $(call BuildPackage,router-dongle))

# call BuildPackage - OpenWrt buildroot signature
