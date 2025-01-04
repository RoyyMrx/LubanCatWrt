# Based on https://github.com/aler9/mediamtx/blob/main/openwrt.mk

include $(TOPDIR)/rules.mk

PKG_NAME:=mediamtx
PKG_VERSION:=0.22.2
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/aler9/mediamtx/tar.gz/v$(PKG_VERSION)?
PKG_HASH:=441e2b2cc3bb3edcea9f64a0376802e3b260a8f186fb52cfe13ea31740f68e1c

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_USE_MIPS16:=0

GO_PKG:=github.com/aler9/mediamtx
GO_PKG_LDFLAGS_X:=$(GO_PKG)/internal/core.version=$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

# Original Makefile had this, but the Golang in our version doesn't seem to support it.
# GO_MOD_ARGS:=-buildvcs=false

define Package/mediamtx
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=MediaMTX
  URL:=https://github.com/aler9/mediamtx
  DEPENDS:=$(GO_ARCH_DEPENDS)
endef

define Package/mediamtx/install
	$(call GoPackage/Package/Install/Bin,$(1))
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) files/mediamtx.init $(1)/etc/init.d/mediamtx
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) files/mediamtx.config $(1)/etc/config/mediamtx
endef

define Package/mediamtx/description
  Ready-to-use server and proxy that allows users to publish, read and proxy live video and audio streams through various protocols.
endef

$(eval $(call GoBinPackage,mediamtx))
$(eval $(call BuildPackage,mediamtx))
