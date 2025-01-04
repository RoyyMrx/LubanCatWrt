include $(TOPDIR)/rules.mk

PKG_NAME:=rpos
# This is pretty close to 2.1.0, but has a couple of useful looking commits.
PKG_VERSION:=d60b90399c083b1ca608eee3a6bee448d83418c1
PKG_RELEASE:=4

PKG_SOURCE:=d60b90399c083b1ca608eee3a6bee448d83418c1
PKG_SOURCE_URL:=https://codeload.github.com/BreeeZe/rpos/tar.gz/
PKG_HASH:=93f65e87ec27325ce54408e164d9af864b3d7c055b730e4e2bb9e9e384d596f8
PKG_CAT:=zcat

PKG_BUILD_DEPENDS:=node/host
PKG_USE_MIPS16:=0

include $(INCLUDE_DIR)/package.mk

define Package/rpos
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=rpos - Raspberry PI ONVIF Server (ONVIF camera API)
  URL:=http://breeeze.github.io/rpos/
  DEPENDS:=+node +v4l2rtspserver
endef

define Package/rpos/description
  ONVIF server (Camera API) for use on the Raspberry PI.
endef

# We rely on rpos not having any C components and generating a single
# JS file, so we don't jump through architecture hoops here (cf node-homebridge).

define Build/Compile
	# Should be using npm ci here, but it's hanging after the typescript extract (?)
	cd $(PKG_BUILD_DIR) && npm install && npx gulp
	cd $(PKG_BUILD_DIR) && npm install -D webpack-cli webpack && npx webpack-cli -t node --mode production ./rpos.js
endef

define Package/rpos/install
	# /usr/share is the wrong place, but it's not clear to me what the right place is since we
	# don't want an /opt directory and we're not installing this as a node module.
	$(INSTALL_DIR) $(1)/usr/share/rpos
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/dist/main.js $(1)/usr/share/rpos
	$(INSTALL_DIR) $(1)/usr/share/rpos/views
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/views/* $(1)/usr/share/rpos/views
	$(INSTALL_DIR) $(1)/usr/share/rpos/wsdl
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/wsdl/* $(1)/usr/share/rpos/wsdl
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) files/rpos.init $(1)/etc/init.d/rpos
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) files/rpos.config $(1)/etc/config/rpos
	$(INSTALL_DIR) $(1)/etc/rpos
	$(INSTALL_CONF) files/camerasettings.json $(1)/etc/rpos/core-camerasettings.json
endef

$(eval $(call BuildPackage,rpos))
