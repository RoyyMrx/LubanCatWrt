#!/bin/sh
. /lib/functions.sh
. /lib/netifd/morse/morse_utils.sh


output=/dev/kmsg

find_morse_device() {
    # if morse_uci_wifi_device is already found, don't bother. 
    [[ -n "$morse_uci_wifi_device" ]] && return
    local device="$1"
    local type
    config_get type $device type
    [[ $type = "morse" ]] && morse_uci_wifi_device=$device
}

get_morse_uci_wifi_device()
{
    config_load wireless
    config_foreach find_morse_device wifi-device
}

find_morse_iface() {
    # if morse_uci_wifi_iface is already found, don't bother. 
    [[ -n "$morse_uci_wifi_iface" ]] && return
    local iface="$1"
    local device
    config_get device $iface device
    [[ $device = "$morse_uci_wifi_device" ]] && morse_uci_wifi_iface=$iface
}

get_morse_uci_wifi_iface()
{
    config_load wireless
    config_foreach find_morse_iface wifi-iface
}

get_morse_iface()
{
    if [ -d "/sys/class/morse/morse_io/device/net/" ]; then
        local morse_iface=$(basename "/sys/class/morse/morse_io/device/net/"*)
        printf $morse_iface
    fi    
}

print_mac_ip_of_interface()
{
    local iface=$1    
    ifconfig $iface | grep $iface -A 1 > $output
}

print_banner()
{
    local mode=$1
    case "$mode" in
        "ap")            
            cat /morse/banners/msgap.txt > $output
            ;;
        "MultiAP")
            cat /morse/banners/msgmultiap.txt > $output
            ;;
        "sta")
            cat /morse/banners/msgsta.txt > $output
            ;;
        "adhoc")
            cat /morse/banners/msgibss.txt > $output
            ;;
        "bridge")
            cat /morse/banners/msgbridge.txt > $output
            ;;
        "extender")
            cat /morse/banners/msgextender.txt > $output
            ;;
        "router")
            cat /morse/banners/msgrouter.txt > $output
            ;;
        *)
            ;;
    esac  
}


print_interface_info()
{
    
    local country=$(uci get wireless.$morse_uci_wifi_device.country)
    local prpl_mode=
    mode=
    morse_interface_mode=
    [[ -z "$country" ]] && return    

    local prpl_enabled=$(uci get prplmesh.config.enable)
    if [ $prpl_enabled = 1 ]; then
        mode="MultiAP"
        prpl_mode=$(uci get prplmesh.config.management_mode)        
    else
        morse_interface_mode=$(uci get wireless.$morse_uci_wifi_iface.mode)  

        if [ "$(uci get wireless.$morse_uci_wifi_iface.network 2>/dev/null)" = "lan" ];then
            mode="bridge"
        elif [ "$(uci get firewall.mmextender.enabled 2>/dev/null)" = "1" ]; then
            mode="extender"
        elif [ "$(uci get firewall.mmrouter.enabled 2>/dev/null)" = "1" ]; then
            mode="router"
        else
            mode=$morse_interface_mode            
        fi
    fi

    [[ "$mode" = "none" ]] && return

    print_banner $mode
    echo "Country: $country" > $output
    [[ "$mode" = "MultiAP" ]] && echo "MultiAP Mode: $prpl_mode" > $output

    local ssid=$(uci get wireless.$morse_uci_wifi_iface.ssid)
    local encryption=$(uci get wireless.$morse_uci_wifi_iface.encryption)
    echo "SSID: $ssid" > $output
    echo "Encryption: $encryption" > $output

    if [ "$morse_interface_mode" = "ap" ]; then
        local channel=$(uci get wireless.$morse_uci_wifi_device.channel)
        echo "channel: $channel" > $output

        _get_regulatory "$morse_interface_mode" "$country" "$channel" ""
        if [ $? -ne 0 ]; then
            echo "Couldn't find reg for $morse_interface_mode in $country with ch=$channel op=$op_class" >&2
        fi
        echo "Bandwidth: $halow_bw" > $output
    fi

}

print_ip()
{


    case "$mode" in
        "ap" | "sta" | "adhoc" | "extender" | "router")            
            print_mac_ip_of_interface br0
            local morse_iface=$(get_morse_iface)
            print_mac_ip_of_interface $morse_iface
            ;;
        "MultiAP")
            print_mac_ip_of_interface br0
            print_mac_ip_of_interface br-prpl
            
            ;;
        "none" | "bridge")
            print_mac_ip_of_interface br0
            ;;
        *)
            ;;
    esac 
}

#wait for a while for everything to sattle down (mostly dhcp client)
sleep 20

get_morse_uci_wifi_device 
get_morse_uci_wifi_iface

print_interface_info
print_ip







