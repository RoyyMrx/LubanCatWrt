#
# Copyright (C) 2022 Morse Micro
#


include $(TOPDIR)/rules.mk

PKG_NAME:=reset-button
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/reset-button
  SECTION:=utils
  CATEGORY:=Base system
  TITLE:=EKH03 Reset Button Watcher
  MAINTAINER:=Morse Micro
endef

define Package/reset-button/description
 An application to watch reset gpio pin and call scripts accordingly. 
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) -Wall \
		-o $(PKG_BUILD_DIR)/reset-button-watcher $(PKG_BUILD_DIR)/reset-button-watcher.c
endef

define Package/reset-button/install
	$(INSTALL_DIR) $(1)/sbin
	$(INSTALL_DIR) $(1)/etc/init.d 
	
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/reset-button-watcher 	$(1)/sbin/
	$(INSTALL_BIN) ./files/sbin/reset-button 				$(1)/sbin/
	$(INSTALL_BIN) ./files/etc/init.d/reset_button 			$(1)/etc/init.d/reset_button
endef

$(eval $(call BuildPackage,reset-button))