#!/bin/sh

get_morse_iface()
{
    if [ -d "/sys/class/morse/morse_io/device/net/" ]; then
        local morse_iface=$(basename "/sys/class/morse/morse_io/device/net/"*)
        printf $morse_iface
    fi    
}

get_fw_ver()
{
    local m_iface=$(get_morse_iface)
    if [ -z "$m_iface" ];then
        printf "N/A"
        return
    fi

    local output=`morsectrl -i $m_iface version | grep FW`
    if [ "$output" ];then
        printf "$output" | sed 's/.*: //g'
    else
        printf "N/A"
    fi
}

get_drv_ver()
{
    local output=`strings /lib/modules/$(uname -r)/morse.ko | grep "^0-" | head -n 1`
    if [ "$output" ];then
        printf "$output"
    else
        printf "N/A"
    fi
}

get_d11_ver()
{
    local output=`strings /lib/modules/$(uname -r)/dot11ah.ko | grep "^0-" | head -n 1`
    if [ "$output" ];then
        printf "$output"
    else
        printf "N/A"
    fi
}

get_mctrl_ver()
{
    local m_iface=$(get_morse_iface)
    if [ -z "$m_iface" ];then
        printf "N/A"
        return
    fi

    local output=`morsectrl -i $m_iface version | grep Morsectrl`
    if [ "$output" ];then
        printf "$output" | sed 's/.*: //g'
    else
        printf "N/A"
    fi
}

get_hapd_ver()
{
    local output=`hostapd_s1g -v 2>&1 | grep hostapd`
    if [ "$output" ];then
        printf "$output" | sed 's/hostapd v//g'
    else
        printf "N/A"
    fi
}

get_supl_ver()
{
    local output=`wpa_supplicant_s1g -v | grep wpa_supplicant`
    if [ "$output" ];then
        printf "$output" | sed 's/wpa_supplicant v//g'
    else
        printf "N/A"
    fi
}

get_wvmn_ver()
{
    local output=`wavemon -v | grep wavemon`
    if [ "$output" ];then
        printf "$output" | sed 's/wavemon //g'
    else
        printf "N/A"
    fi
}

get_iprf_ver()
{
    local output=`iperf3  --version | grep iperf`
    if [ "$output" ];then
        printf "$output" | sed 's/iperf //g'
    else
        printf "N/A"
    fi
}

get_iw_ver()
{
    local output=`iw --version | grep "iw version"`
    if [ "$output" ];then
        printf "$output" | sed 's/iw version //g'
    else
        printf "N/A"
    fi
}

get_snp_ver()
{
    local output=`cat /usr/sbin/morse-snapshot.sh | grep SCRIPT_VER=`
    if [ "$output" ];then
        printf "$output" | sed "s/SCRIPT_VER='v\(.*\)'/\1/"
    else
        printf "N/A"
    fi
}

get_owrt_ver()
{
    # This is actually VERSION_CODE, which is the Morse OpenWrt version
    # rather than the upstream OpenWrt version.
    local output=`cat /etc/openwrt_version`
    if [ "$output" ];then
        printf "$output"
    else
        printf "N/A"
    fi
}

echo -ne "Morse Versions:
- Firmware       = `get_fw_ver`
- Morse Driver   = `get_drv_ver`
- Dot11ah Driver = `get_d11_ver`
- Morsectrl      = `get_mctrl_ver`
- Hostapd        = `get_hapd_ver`
- WPA_Supplicant = `get_supl_ver`
- Wavemon        = `get_wvmn_ver`
- Iperf3         = `get_iprf_ver`
- IW             = `get_iw_ver`
- Snapshot       = N/A
- OpenWRT        = `get_owrt_ver`
"
