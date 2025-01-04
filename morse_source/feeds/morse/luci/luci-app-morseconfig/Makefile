include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Morse Configuration
LUCI_DEPENDS:=+luci-base +libiwinfo +libiwinfo-lua +luci-lib-morseui +luci-lib-morseconfig +morse-bundle +morse-regdb

PKG_BUILD_DEPENDS:=iwinfo
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk


# call BuildPackage - OpenWrt buildroot signature