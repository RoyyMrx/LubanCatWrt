#!/bin/sh

#first remove the default gaurds so the default scripts work. 
uci delete network.lan.defaults_applied
uci delete network.privlan.defaults_applied
uci delete network.ahwlan.defaults_applied
uci commit network

uci delete dhcp.data.defaults_applied
uci commit dhcp

uci delete firewall.data.defaults_applied
uci commit firewall

uci delete system.data.defaults_applied
uci commit system

uci delete wireless.data.defaults_applied
uci commit wireless

for script in "/morse/uci-defaults/"*; 
do
    $script
done

reboot
