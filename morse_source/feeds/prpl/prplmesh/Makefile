include $(TOPDIR)/rules.mk

PKG_NAME:=prplmesh
PKG_RELEASE:=1
PKG_REV:=$(PKG_VERSION)

PKG_SOURCE_VERSION:=rel_1_8_0_2023_May_05
PKG_VERSION:=1.8.1
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=a64bedb0bcc011742159bc6c5ba939e624180eee614c8531102a5943418ed297


PKG_BUILD_DEPENDS+=wpa_supplicant_s1g python-yaml/host python3/host

# PKG_BUILD_PARALLEL:=1
# PKG_CONFIG_DEPENDS:= \
# 	CONFIG_WIRELESS_STA \
# 	CONFIG_PACKAGE_libamxb

CMAKE_BINARY_SUBDIR:=build

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

define Package/prplmesh
	SECTION:=net
	CATEGORY:=Network
	TITLE:=prplmesh
	URL:=https://gitlab.com/prpl-foundation/prplmesh/prplMesh/README.md
	MAINTAINER:=prplfoundation
	DEPENDS:= \
		+libstdcpp \
		+libpthread \
		+librt \
		+libjson-c \
		+libreadline \
		+libopenssl \
		+libnl \
		+uci \
		+ubus \
		+ubox \
		+ebtables \
		+wpa_supplicant_s1g \
		+hostapd_s1g \
		+@MORSE_HOSTAPD_S1G_EAP \
		+@MORSE_HOSTAPD_S1G_ACS \
		+@BUSYBOX_CONFIG_GETOPT \
		+@BUSYBOX_CONFIG_FEATURE_GETOPT_LONG \
		+libwpa_client \
		+@MORSE_WPA_SUPPLICANT_S1G_MESH_NETWORKING \
		+@MORSE_WPA_SUPPLICANT_S1G_EAP 

		# prplmesh has more dependency on hostapd_s1g and wpa_supplicant_s1g configs,
		# but since we already had them enabled by default in the make file and we don't 
		# have a config for them, I don't add them to DEPENDS. these configs include:
		# MORSE_WPA_SUPPLICANT_S1G_WPS  MORSE_WPA_SUPPLICANT_S1G_CLI 
		# MORSE_WPA_SUPPLICANT_S1G_AP_SUPPORT MORSE_HOSTAPD_S1G_WPS 

#	The ambiorix library is optional, select it if libamxb is selected:
	DEPENDS+= \
		+libamxb \
		+libamxc \
		+libamxd \
		+libamxo \
		+libamxp \
		+mod-amxb-ubus
endef

define Package/prplmesh/config
	source "$(SOURCE)/Config.in"
endef

CMAKE_OPTIONS += \
	-DCMAKE_INSTALL_PREFIX=/opt/prplmesh \
	-DPLATFORM_BUILD_DIR=$(BUILD_DIR) \
	-DPLATFORM_STAGING_DIR=$(STAGING_DIR) \
	-DPLATFORM_INCLUDE_DIR=$(STAGING_DIR)/usr/include \
	-DTARGET_PLATFORM="MorseMicro" \
	-DTARGET_PLATFORM_TYPE="EHK01" \
	-DBEEROCKS_BRIDGE_IFACE="br-prpl" \
	-DBWL_TYPE="NL80211"


ifeq ($(wildcard $(PKG_BUILD_DIR)/.source_dir),)
	CMAKE_OPTIONS += -DPRPLMESH_REVISION=$(PKG_REV)
endif
ifeq ($(CONFIG_PRPLMESH_NBAPI),y)
	CMAKE_OPTIONS += -DENABLE_NBAPI=ON
	PKG_BUILD_DEPENDS += libamxc libamxp libamxd libamxb libamxo
endif

ifeq ($(CONFIG_PRPLMESH_UNIT_TESTS),y)
	CMAKE_OPTIONS += -DBUILD_TESTS=ON
endif

ifeq ($(CONFIG_PRPLMESH_STATIC_LIBRARIES),y)
	CMAKE_OPTIONS += -DBUILD_SHARED_LIBS=OFF
endif

ifeq ($(CONFIG_PRPLMESH_DEBUG),y)
	CMAKE_OPTIONS += -DCMAKE_BUILD_TYPE=Debug -DCMAKE_VERBOSE_MAKEFILE:BOOL=ON
endif

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_DIR) $(1)/usr/include
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/lib/libbml* $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/include/beerocks/bml $(1)/usr/include/
endef

define Package/prplmesh/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DIR) $(1)/opt/prplmesh
	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) ./files/etc/init.d/* $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/uci-defaults/* $(1)/etc/uci-defaults/
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/bin $(1)/opt/prplmesh/
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/scripts $(1)/opt/prplmesh/
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/lib/*.so* $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/share $(1)/opt/prplmesh/
	$(CP) $(PKG_INSTALL_DIR)/opt/prplmesh/config $(1)/opt/prplmesh/
	$(INSTALL_BIN) ./files/opt/prplmesh/scripts/* $(1)/opt/prplmesh/scripts/
endef

$(eval $(call BuildPackage,prplmesh))
