include $(TOPDIR)/rules.mk

PKG_NAME:=morse-bundle
PKG_RELEASE=1

PKG_MAINTAINER:=Morse Micro

include $(INCLUDE_DIR)/package.mk

define Package/morse-bundle
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Morse Micro HaLow Bundle
  DEPENDS:= +kmod-usb-serial \
            +kmod-usb-serial-cp210x \
            +kmod-usb-serial-ftdi \
            +kmod-usb-serial-pl2303 \
            +kmod-mmc \
            +kmod-tcp-bbr \
            +kmod-morse \
            +morse-fw \
            +morse-board-config \
            +morsectrl \
            +mmnlspy \
            +morse-wavemon \
            +hostapd_s1g \
            +wpa_supplicant_s1g \
            +kmod-sdhci \
            $(if $(filter $(SUBTARGET),mt7620),+kmod-sdhci-mt7620,) \
            +wpad-basic-openssl \
            +iperf3 \
            +iw-full \
            +shellinabox \
            +gpioctl-sysfs \
            +gpiod-tools \
            +uhttpd \
            +uhttpd-mod-ubus \
            +luci \
            +luci-proto-relay \
            +luci-mod-admin-full \
            +luci-theme-bootstrap \
            +luci-app-firewall \
            +luci-app-opkg \
            +luci-proto-ppp \
            +libiwinfo-lua \
            +IPV6:luci-proto-ipv6 \
            +rpcd-mod-rrdns \
            +relayd
endef

define Package/morse-bundle/description
 This package contains all morse packages
endef

define Build/Compile
endef

define Package/morse-bundle/install
	$(INSTALL_DIR) $(1)/bin
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DIR) $(1)/etc/rc.d
	$(INSTALL_DIR) $(1)/morse/scripts
	$(INSTALL_DIR) $(1)/morse/uci-defaults
	$(INSTALL_BIN) ./files/bin/* $(1)/bin/.
	$(INSTALL_BIN) ./files/etc/uci-defaults/* $(1)/etc/uci-defaults/.
	$(INSTALL_BIN) ./files/morse/scripts/* $(1)/morse/scripts/.
	$(INSTALL_BIN) ./files/etc/rc.d/* $(1)/etc/rc.d/.
	$(INSTALL_BIN) ./files/etc/uci-defaults/* $(1)/morse/uci-defaults/.
	$(if $(CONFIG_TARGET_ramips_mt76x8), \
		$(INSTALL_DATA) ./files/etc/config/network_mt76x8 $(1)/etc/config/network)
	$(if $(CONFIG_TARGET_bcm27xx_bcm2711), \
		$(INSTALL_DATA) ./files/etc/config/network_bcm2711 $(1)/etc/config/network)
	$(INSTALL_DATA) ./files/morse/build_version $(1)/morse/.
endef

$(eval $(call BuildPackage,morse-bundle))
