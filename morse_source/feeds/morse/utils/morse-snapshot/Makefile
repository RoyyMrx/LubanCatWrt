include $(TOPDIR)/rules.mk

PKG_NAME:=morse-snapshot
PKG_RELEASE=1

PKG_LICENSE:=
PKG_LICENSE_FILES:=

PKG_SOURCE_VERSION:=v0.18
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-v0.18.tar.xz
PKG_HASH:=b285c84e7316a3f93e6763ddc508c4e9efb5163b14ad938cd032601c22336506


PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk

define Package/morse-snapshot
  SECTION:=Utilities
  CATEGORY:=Utilities
  TITLE:=Morse Micro HaLow Chip Dump utility
  DEPENDS:= +openocd \
  			+libexpat \
			+libncursesw \
			+liblzma \
			+libstdcpp \
			+curl \
			+@BUSYBOX_CONFIG_USLEEP \
			+@BUSYBOX_CONFIG_TIMEOUT \
			+@BUSYBOX_CONFIG_WHOAMI \
			+@BUSYBOX_CONFIG_HOSTNAME \
			+@BUSYBOX_CONFIG_TELNET \
			+@BUSYBOX_CONFIG_FEATURE_DATE_NANO
endef

define Build/Compile
endef

define Package/morse-snapshot/install
    # configuration for openocd 
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_DIR) $(1)/etc/crontabs
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/config/rpi_openocd_mmevk_MMECH04_V2.cfg $(1)/etc/
	echo "*/5 * * * * /usr/sbin/morse-crash-detect.sh" >> $(1)/etc/crontabs/root
	echo "*/8 * * * * /usr/sbin/morse-snapshot-upload.sh" >> $(1)/etc/crontabs/root

	# snapshot configuration
	$(INSTALL_DATA) -m 0644 ./files/etc/morse-snapshot.conf $(1)/etc/morse-snapshot.conf

	# scripts
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/morse-snapshot.sh $(1)/usr/sbin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/morse-snapshot-upload.sh $(1)/usr/sbin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/morse-core-dump.sh $(1)/usr/sbin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/morse-crash-detect.sh $(1)/usr/sbin/
	
	$(INSTALL_DIR) $(1)/morse/snapshot/platform/openwrt/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/morse-platform.sh $(1)/morse/snapshot/platform/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/platform/openwrt/openocd-halt-all.sh $(1)/morse/snapshot/platform/openwrt/gdb-halt-all.sh
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/platform/openwrt/morse-snapshot-openwrt.sh $(1)/morse/snapshot/platform/openwrt/
	
	# mm6108 specific
	$(INSTALL_DIR) $(1)/morse/snapshot
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/scripts/mm6108_addr_table.sh $(1)/morse/snapshot/

	# gdb
	$(INSTALL_DIR) $(1)/morse/snapshot/platform/openwrt/tools/gdb/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/tools/gdb/openwrt/64bit/riscv64-unknown-elf-gdb $(1)/morse/snapshot/platform/openwrt/tools/gdb/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/config/gdbinit $(1)/morse/snapshot/platform/openwrt/tools/gdb/.gdbinit

endef


$(eval $(call BuildPackage,morse-snapshot))
