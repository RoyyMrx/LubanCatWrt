#!/bin/ash

echo "Confguring network..."
#get the list of interfaces and then find the one that is usb.
for ifacepath in "/sys/class/net"/*
do
    iface=$(basename $ifacepath)
    devicepath=$(find /sys/devices/platform -name "$iface")
    
    if [ ! -z "$devicepath" ];then
        grep=$(echo $devicepath | grep "usb")
        if [[ ! -z "$grep" ]]; then
            printf "$iface is usb to ethernet\n"
            targetinterface=$iface
            break
        fi
    fi
done

if [ -z "$targetinterface" ];then
    echo "Can't find a usb/ethernet interface."
    exit 1
fi



#now find the bridge interface. it must be an interface, the type should be bridge and proto should be static. 
#sice there could be more that one interface with this attributes, use the first one. 
# 23/03/2023,AJ: I slightly disagree that the proto *should* be static, there could very well be a separate dhcp 
#                server in the network dishing out an IP address to the AP which our dongle connects too

#get the list of the options that are interface ex: "network.guest=interface"
for iface in $(uci show network | grep =interface)
do
    iface=${iface%"=interface"}
    iface=${iface#"network."}
    
    i=0;
    while uci get network.@device[$i] > /dev/null 2>&1; ret=$?; [ $ret -eq 0 ]; do
        if [ "$(uci get network.@device[$i].type)" == "bridge" ] &&
           [ "$(uci get network.@device[$i].name)" == "$(uci get network.$iface.device)" ]; then
                targetbridge=$iface
                break;
        fi;
        i=$(( $i + 1 ))
    done
    [ $ret -eq 0 ] && { echo "Found bridge interface $targetbridge with @device[$i]."; break; }
done

if [ -z "$targetbridge" ];then
    echo "Can't find a proper bridge interface!"
    exit 1
fi
echo "Adding $targetinterface interface to $targetbridge."

uci del_list network.@device[$i].ports=$targetinterface
uci add_list network.@device[$i].ports=$targetinterface
uci commit network
reload_config