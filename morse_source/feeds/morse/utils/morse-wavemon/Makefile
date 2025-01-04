include $(TOPDIR)/rules.mk

PKG_NAME:=morse-wavemon
PKG_RELEASE=2


PKG_LICENSE:=GPL-3.0+
PKG_LICENSE_FILES:=LICENSE

PKG_SOURCE_VERSION:=$(PKG_VERSION)
PKG_VERSION:=rel_1_8_1_2023_May_25
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=d1b16e00152143c9740e5a8b9d3a4ce7c1d566a397b82d9f2c430f0db59ba05c


PKG_MAINTAINER:=Morse Micro
PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk

define Package/morse-wavemon
  SECTION:=utils
  CATEGORY:=Network
  TITLE:=Morse Micro WIFI HaLow aware wavemon
  DEPENDS:= +kmod-morse +libnl +libncurses +nload
  FILES:=\
	$(PKG_BUILD_DIR)/wavemon 
  PROVIDES:=morse-wavemon
endef

# When libcap is enabled in the build - eg via wireshark additions
# autoconf picks it up as an available library to compile against, 
# but a lack of build dependency causes a failure to link against
# the libcap shared library.
# In order maintain build compatibility across our platforms, I'm
# opting to force a build without libcap - as this is what has been
# built on our boards in the past.
# An alternative would be to enable the libcap package for all boards
# and add the libcap build dependency instead.
CONFIGURE_ARGS += \
	--without-libcap

TARGET_CFLAGS += -I$(STAGING_DIR)/usr/include/libnl3  
TARGET_LDFLAGS += -lnl-3 -lnl-genl-3 -lm 

define Package/morse-wavemon/install
	$(INSTALL_DIR) $(1)/sbin 
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/wavemon $(1)/sbin/
	$(INSTALL_BIN) ./files/sbin/pt $(1)/sbin/
endef

$(eval $(call BuildPackage,morse-wavemon))
