include $(TOPDIR)/rules.mk

PKG_NAME:=morse-regdb
PKG_RELEASE:=1
PKG_BUILD_DEPENDS:=python3/host

PKG_VERSION:=1.2.1
PKG_SOURCE_URL:=file://$(TOPDIR)/../packages/
PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_HASH:=79aae558b6a5a79bd393bc33fa607ff6b58075efb770f765a5cc8ddfddd9b835

# This is actually the commit _after_ v1.2.1, but the only change
# is to the script which we use
# (which is currently based on the tag we branched off).
PKG_SOURCE_VERSION:=d68bfe028684671f495dbe3dc6e08937015e60a4

include $(INCLUDE_DIR)/package.mk

define Package/morse-regdb 
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Regulatory data for 802.11ah
  URL:=https://bitbucket.org/morsemicro/morse_regdb/src/master/
  PKGARCH:=all
endef

define Package/morse-regdb/description
	Regulatory data for 802.11ah in a csv.
endef

define Build/Compile
	mkdir -p $(PKG_BUILD_DIR)/artefacts
	# Mash the 5g shim channels in.
	python3 $(PKG_BUILD_DIR)/regdbconverter.py -v -f csv $(PKG_BUILD_DIR)/regdb_Sub-1_GHz.tsv \
		| python3 add_5g_shim_channels.py \
		> $(PKG_BUILD_DIR)/artefacts/channels.csv
endef

define Package/morse-regdb/install
	$(INSTALL_DIR) $(1)/usr/share/morse-regdb
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/artefacts/* $(1)/usr/share/morse-regdb
endef

$(eval $(call BuildPackage,morse-regdb))
