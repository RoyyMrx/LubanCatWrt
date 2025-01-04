#!/bin/sh

echo "Adding device handler type: morse"

. /lib/netifd/netifd-wireless.sh
. /lib/netifd/hostapd.sh
. /lib/netifd/morse/morse_overrides.sh
. /lib/netifd/morse/morse_utils.sh

echo "Configuring $3"
init_wireless_driver "$@"

MP_CONFIG_INT="mesh_retry_timeout mesh_confirm_timeout mesh_holding_timeout mesh_max_peer_links
		   mesh_max_retries mesh_ttl mesh_element_ttl mesh_hwmp_max_preq_retries
		   mesh_path_refresh_time mesh_min_discovery_timeout mesh_hwmp_active_path_timeout
		   mesh_hwmp_preq_min_interval mesh_hwmp_net_diameter_traversal_time mesh_hwmp_rootmode
		   mesh_hwmp_rann_interval mesh_gate_announcements mesh_sync_offset_max_neighor
		   mesh_rssi_threshold mesh_hwmp_active_path_to_root_timeout mesh_hwmp_root_interval
		   mesh_hwmp_confirmation_interval mesh_awake_window mesh_plink_timeout"
MP_CONFIG_BOOL="mesh_auto_open_plinks mesh_fwding wps_virtual_push_button"
MP_CONFIG_STRING="mesh_power_mode"


MM_MOD_INT="watchdog_interval_secs max_rates max_rate_tries spi_clock_speed max_txq_len virtual_sta_max max_aggregation_count"
MM_MOD_BOOL="enable_multi_interface enable_mac80211_connection_monitor mcs10_mode enable_rts_8mhz 
			enable_otp_check enable_survey enable_subbands enable_ps enable_trav_pilot enable_watchdog_reset 
			enable_watchdog no_hwcrypt enable_raw enable_arp_offload enable_dynamic_ps_offload"
MM_MOD_STRING="serial country test_mode debug_mask macaddr_octet mcs_mask"
MM_MOD_UNKNOWN=
MOD_PARAMS=

check_cac(){
	json_select config
	json_get_vars cac
	if [ "${cac:-0}" -gt 0 ]; then
		enable_cac=1
	fi
	json_select ..
}

build_morse_mod_params(){
	json_select config

	for var in $MM_MOD_BOOL $MM_MOD_INT $MM_MOD_STRING; do
		json_get_var mm_mod_val "$var"
		[ -n "$mm_mod_val" ] && MOD_PARAMS="$MOD_PARAMS $var=$mm_mod_val"
	done

	local _sgi_rc=1
	if json_is_a s1g_capab array
	then
		json_select s1g_capab
		idx=1
		while json_is_a ${idx} string 
		do
			json_get_var capab $idx
			[ "${capab}" = "[SHORT-GI-NONE]" ] && _sgi_rc=0
			idx=$(( idx + 1 ))
		done
		json_select ..
	fi

	if [ $_sgi_rc -ne 1 ]; then	
		MOD_PARAMS="$MOD_PARAMS enable_sgi_rc=0"
	else
		MOD_PARAMS="$MOD_PARAMS enable_sgi_rc=1"
	fi
	json_select ..
	enable_cac=
	for_each_interface "ap" check_cac
	[ -n "$enable_cac" ] && MOD_PARAMS="$MOD_PARAMS enable_cac=$enable_cac"

	# Get the last three octets of the eth0 MAC address
	# to use as the default HaLow MAC address
	local ETH0_MAC_SUFFIX=`cat /sys/class/net/eth0/address | cut -d: -f4-`

	MOD_PARAMS="$MOD_PARAMS bcf=bcf_default.bin macaddr_suffix=$ETH0_MAC_SUFFIX"
	MOD_PARAMS="$MOD_PARAMS enable_multi_interface=Y"

	MOD_PARAMS=`echo $MOD_PARAMS | xargs`
}

drv_morse_cleanup() {
	hostapd_common_cleanup
}

drv_morse_init_device_config() {
	hostapd_common_add_device_config

	config_add_string path phy 'macaddr:macaddr'
	config_add_string tx_burst
	config_add_int frag rts
	config_add_int beacon_int op_class
	config_add_int txpower
	config_add_int s1g_prim_chwidth 
	config_add_string s1g_prim_1mhz_chan_index
	config_add_int bss_color
	config_add_boolean ampdu
	config_add_int forced_listen_interval
	config_add_boolean noscan
	config_add_array s1g_capab
	config_add_array channels
	config_add_boolean vendor_keep_alive_offload

	#module parameters
	config_add_int $MM_MOD_INT
	config_add_boolean $MM_MOD_BOOL
	config_add_string $MM_MOD_STRING $MM_MOD_UNKNOWN
}


drv_morse_init_iface_config() {
	hostapd_common_add_bss_config
	config_add_string 'macaddr:macaddr' ifname
	config_add_boolean wds powersave enable
	config_add_array sae_group
	config_add_array owe_group
	config_add_int maxassoc
	config_add_int max_listen_int
	config_add_int dtim_period
	config_add_int start_disabled
	config_add_int sae_pwe

	#twt
	config_add_boolean twt
	config_add_string wake_interval
	config_add_int min_wake_duration setup_command

	#cac
	config_add_boolean cac

	#raw
	config_add_array raws

	# mesh
	config_add_string mesh_id
	config_add_int $MP_CONFIG_INT
	config_add_boolean $MP_CONFIG_BOOL
	config_add_string $MP_CONFIG_STRING

}

drv_morse_setup() {
	morse_band_override
	json_select config
	json_get_vars \
		phy macaddr path \
		country \
		txpower \
		frag rts beacon_int:100 htmode \
		ampdu \
		op_class \
		bss_color forced_listen_interval
	json_get_values basic_rate_list basic_rate
	json_select ..

	MOD_PARAMS=
	if_idx=
	build_morse_mod_params

	if [ -n "$country" ]; then
		echo "Resetting Morse Module"
		sed -e "s/morse.*/morse $MOD_PARAMS/g" -i /etc/modules.d/morse.conf
		rmmod morse
		sleep 1
		/sbin/kmodloader

		sleep 2 #just wait for phy to register
		#don't do iw reg set as in mac80211
	fi

	find_phy || {
		echo "Could not find PHY for device '$1'" >&2
		wireless_set_retry 0
		return 1
	}

	# add Morse chip id to the status page
	set_chipid

	# Everytime that the driver is inserted, it gets a new phy number,
	# but the same nice wlan number (wlan0 for ekh01 and wlan1 for EKH03). since openwrt
	# creates the ifname based on phy number, it would be cleaner to just use the wlan number
	# that was assigned to the interface by default. 
	oldifname=$(morse_get_old_ifname "$phy")
	echo "oldifname:$oldifname "

	json_add_object data
	json_add_string phy "$phy"
	json_close_object

	[ -n "$oldifname" ] && iw dev $oldifname del
	
	
	local hostapd_conf_file="/var/run/hostapd-$phy.conf"	
	rm -f "$hostapd_conf_file"

	wireless_set_data phy="$phy"

	[ -z "$(uci -q -P /var/state show wireless._${phy})" ] && uci -q -P /var/state set wireless._${phy}=phy

	morse_interface_cleanup ${phy}

	set_default rts 1000
	iw phy "$phy" set rts "${rts%%.*}"

	[ -n "$frag" ] && iw phy "$phy" set frag "${frag%%.*}"

	already_have_wpa_supplicant_running=
	already_have_hostapd_running=
	already_have_ap_iface=
	already_have_sta_iface=
	has_ap=
	has_sta=
	has_adhoc=

	#bring the interfaces up 
	for_each_interface "ap sta adhoc none" morse_iface_bringup
	
	# if we have ap, setup the 11ah specific regulatory translation
	# and setup the general hostapd configs (not bss configs)
	[ -n "$has_ap" ] && {
		morse_set_ap_regulatory
		morse_hostapd_conf_setup "$phy"
	}
	for_each_interface "ap" morse_setup_ap

	[ -n "$has_sta" ] && {
		json_select config
		json_get_vars vendor_keep_alive_offload
		json_select ..
	}
	for_each_interface "sta" morse_setup_sta

	[ -n "$has_adhoc" ] && {
		morse_set_ap_regulatory
		json_select config
		json_get_vars op_class channel country s1g_prim_chwidth s1g_prim_1mhz_chan_index beacon_int
		json_select ..
		set_default beacon_int 100
	}
	for_each_interface "adhoc" morse_setup_adhoc

	# Ideally, this would also be in the hostapd/wpa_supplicant config,
	# but for now they don't have support so we use morsectrl.
	set_default ampdu 1

	morsectrl -i $ifname ampdu $ampdu
	[ -n "$bss_color" ] && morsectrl -i $ifname bsscolor $bss_color
	if [ -n "$forced_listen_interval" ]
	then
		# 802.11ah supports listen intervals beyond 65535 by
		# using the first two bits as a scale factor.
		# We calculate this transformation here to keep the UI/config simple.
		local max_val=16383
		local scale_factor
		local unscaled_interval
		if [ "$forced_listen_interval" -gt $((1000 * $max_val)) ]; then
			scale_factor=3
			unscaled_interval=$(("$forced_listen_interval" / 10000))
		elif [ "$forced_listen_interval" -gt $((10 * $max_val)) ]; then
			scale_factor=2
			unscaled_interval=$(("$forced_listen_interval" / 1000))
		elif [ "$forced_listen_interval" -gt $max_val ]; then
			scale_factor=1
			unscaled_interval=$(("$forced_listen_interval" / 1000))
		else
			scale_factor=0
			unscaled_interval="$forced_listen_interval"
		fi

		morsectrl -i $ifname li $unscaled_interval $scale_factor
	fi

	wireless_set_up
}

drv_morse_teardown() {
	if json_is_a data object
	then
		json_select data
		json_get_vars phy
		json_select ..
	fi

	# make sure to kill udhcpc with SIGTERM before tearing down the
	# network, so it unicasts the release to the dhcp server
	killall udhcpc 2>/dev/null

	if [ -z "$phy" ]; then
		json_select config
		json_get_vars path
		json_select ..
		if [ -z "$path" ]; then
			echo "Could not find phy from data, nor could find device path from device configuration." >&2
			return 1;
		fi
		phy=$(iwinfo nl80211 phyname "path=$path")
		if [ -z "$phy" ]; then
			echo "Could not find phy from device path." >&2
			return 1;
		fi
	fi

	#remove hostapd conffile before tearing down.
	local hostapd_conf_file="/var/run/hostapd-$phy.conf"
	rm "$hostapd_conf_file" -f

	morse_interface_cleanup "$phy"
	uci -q -P /var/state revert wireless._${phy}

	rmmod morse
	rmmod dot11ah

}

morse_iface_bringup() {
	json_select config
	json_get_vars ifname mode ssid wds powersave macaddr enable wpa_psk_file vlan_file

	# guard against more than one AP interface
	if [ -n "$already_have_ap_iface" -a "$mode" = "ap" ]; then
		echo "Can't have more than one AP interface."
		json_select ..
		return
	fi
	# guard against more than one STA interface
	if [ -n "$already_have_sta_iface" -a "$mode" = "sta" ]; then
		echo "Can't have more than one STA interface."
		json_select ..
		return
	fi

	set_default wds 0
	set_default powersave 0

	if [ -z "$ifname" ]; then
		if [[ "$oldifname" == "wlan"* ]]; then
			ifname="$oldifname${if_idx:+-$if_idx}"
		else
			ifname="wlan${phy#phy}${if_idx:+-$if_idx}"
		fi
	fi
	if_idx=$((${if_idx:-0} + 1))
	
	json_add_string ifname "$ifname"
	json_add_string phy "$phy"


	[ -n "$macaddr" ] || {
		macaddr="$(morse_generate_mac $phy)"
		macidx="$(($macidx + 1))"
	}

	json_add_string macaddr "$macaddr"
	json_select ..

	case "$mode" in
		ap)
			has_ap=1
			morse_iw_interface_add "$phy" "$ifname" __ap
			if [ $? -ne 0 ]; then
				echo "morse_iface_bringup: error adding interface $ifname to $phy" >&2
				exit 1
			fi
			ifconfig "$ifname" hw ether $macaddr
			ip link set $ifname up
			# mark that we already brought up an AP iface
			already_have_ap_iface=1
		;;

		sta)
			has_sta=1
			[ "$wds" -gt 0 ] && wdsflag="4addr on"
			morse_iw_interface_add "$phy" "$ifname" managed "$wdsflag" || return
			if [ "$wds" -gt 0 ]; then
				iw dev "$ifname" set 4addr on
			else
				iw dev "$ifname" set 4addr off
			fi
			[ "$powersave" -gt 0 ] && powersave="on" || powersave="off"
			iw dev "$ifname" set power_save "$powersave" 
			ifconfig "$ifname" hw ether $macaddr
			ip link set $ifname up
			# mark that we already brought up a STA iface
			already_have_sta_iface=1
		;;

		adhoc)
			has_adhoc=1
			morse_iw_interface_add "$phy" "$ifname" adhoc
		;;

		*)
			morse_iw_interface_add "$phy" "$ifname" managed || return
			ip link set $ifname up
		;;
	esac

}

morse_get_old_ifname()
{
	local _phy=$1
	local _oldifname="$(basename "/sys/class/ieee80211/${_phy}/device/net"/* 2>/dev/null)"

	if [[ "$_oldifname" == "wlan"* ]]; then
		echo "$_oldifname"
	else
		echo ""
	fi
}

morse_setup_ap() {
	local iface_index=$1
	json_select config
	json_get_vars ifname phy mode ssid wds powersave macaddr enable wpa_psk_file vlan_file multi_ap
	json_select ..

	# guard against more than one hostapd_s1g instance
	if [ -n "$already_have_hostapd_running" ]; then
		echo "Can't have more than one hostapd_s1g running."
		return
	fi

	local hostapd_ctrl="${hostapd_ctrl:-/var/run/hostapd/$ifname}"
	local type=interface

	morse_hostapd_add_bss "$phy" "$ifname" "$macaddr" "$type"

	json_get_vars mode
	json_get_var vif_txpower

	uci -q -P /var/state set wireless._${phy}.aplist="${ifname}"

	/sbin/hostapd_s1g -t -B -s ${hostapd_conf_file}
	# prplmesh is looking for /var/morse/hostapd_s1g_multiap.conf as hostapd conf file. 
	# So, we add a symlink from the actual conf file for prplmesh.
	if [ "$multi_ap" -gt 0 ]; then
		mkdir -p /var/morse
		rm /var/morse/hostapd_s1g_multiap.conf
		ln -s ${hostapd_conf_file} /var/morse/hostapd_s1g_multiap.conf
	fi

	#mark that we have already started the hostapd_s1g
	already_have_hostapd_running=1

	[ -z "$vif_txpower" ] || iw dev "$ifname" set txpower fixed "${vif_txpower%%.*}00"

	wireless_add_vif "$iface_index" "$ifname"
}

morse_set_ap_regulatory() {
	halow_bw=
	center_freq=
	_get_regulatory "$mode" "$country" "$channel" "$op_class"
	if [ $? -ne 0 ]; then
		echo "Couldn't find reg for $mode in $country with ch=$channel op=$op_class" >&2
		return
	fi

	#add ap radio settings to the ap interface configs to be used when bringing hostapd_s1g up.
	json_select config
	json_add_int bw "$halow_bw"
	json_add_string freq "$center_freq"
	json_add_string op_class "$op_class"
	json_select ..
}

morse_setup_sta() {
	local iface_index=$1

	# guard against more than one wpa_supplicant_s1g instance
	if [ -n "$already_have_wpa_supplicant_running" ]; then
		echo "Can't have more than one wpa_supplicant_s1g running."
		return
	fi

	json_select config
	json_get_vars ifname

	morse_wpa_supplicant_add $ifname 1 || failed=1
	#mark that we have already started the wpa_supp_s1g
	already_have_wpa_supplicant_running=1
	json_select ..

	[ -n "$failed" ] || wireless_add_vif "$iface_index" "$ifname"
	uci -q -P /var/state set wireless._${phy}.splist="${ifname}"
	uci -q -P /var/state set wireless._${phy}.umlist="${ifname}"
}

morse_setup_adhoc() {
	local iface_index=$1

	wireless_vif_parse_encryption
	# guard against more than one wpa_supplicant_s1g instance
	if [ -n "$already_have_wpa_supplicant_running" ]; then
		echo "Can't have more than one wpa_supplicant_s1g running."
		return
	fi

	json_select config
	json_get_vars ifname

	morse_wpa_supplicant_add $ifname 1 || failed=1
	#mark that we have already started the wpa_supp_s1g
	already_have_wpa_supplicant_running=1
	json_select ..

	[ -n "$failed" ] || wireless_add_vif "$iface_index" "$ifname"
	uci -q -P /var/state set wireless._${phy}.splist="${ifname}"
	uci -q -P /var/state set wireless._${phy}.umlist="${ifname}"
}

morse_vap_cleanup() {
	local service="$1"
	local vaps="$2"

	for wdev in $vaps; do
		[ "$service" != "none" ] && kill_wait $service &> /dev/null
		ip link set dev "$wdev" down 2>/dev/null
		iw dev "$wdev" del
	done
}

morse_interface_cleanup() {
	local phy="$1"

	morse_vap_cleanup hostapd_s1g "$(uci -q -P /var/state get wireless._${phy}.aplist)"
	morse_vap_cleanup wpa_supplicant_s1g "$(uci -q -P /var/state get wireless._${phy}.splist)"
	morse_vap_cleanup none "$(uci -q -P /var/state get wireless._${phy}.umlist)"
}


#################################################
#
#      hostapd helpers
#
#################################################


morse_hostapd_conf_setup() {
	local phy=$1
	json_select config
	json_get_vars noscan 
	json_get_vars s1g_prim_chwidth s1g_prim_1mhz_chan_index op_class dtim_period
	json_get_vars bw freq
	json_get_values channel_list channels tx_burst

	if json_is_a s1g_capab array
	then
		json_select s1g_capab
		idx=1
		while json_is_a ${idx} string 
		do
			json_get_var capab $idx
			[ -z "$s1g_capab" ] && s1g_capab=$capab || s1g_capab="$s1g_capab,$capab"
			idx=$(( idx + 1 ))
		done
		json_select ..
	fi

	#auto_channel preloaded before drv_ called
	[ "$auto_channel" -gt 0 ] && json_get_vars acs_exclude_dfs
	[ -n "$acs_exclude_dfs" ] && [ "$acs_exclude_dfs" -gt 0 ] &&
		append base_cfg "acs_exclude_dfs=1" "$N"

	[ "$auto_channel" = 0 ] && [ -z "$channel_list" ] && \
		channel_list="$channel"

	set_default noscan 0

	[ "$noscan" -gt 0 ] && hostapd_noscan=1
	[ "$tx_burst" = 0 ] && tx_burst=

	if [ "$band" = "s1g" ]; then
		append base_cfg "ieee80211ah=1" "$N"

		if [ -z "$s1g_prim_chwidth" ]; then
			if [ $bw -eq 4 ] || [ $bw -eq 8 ]; then
				s1g_prim_chwidth=2
			else
				s1g_prim_chwidth=1
			fi
		fi

		set_default s1g_prim_1mhz_chan_index auto
		if [ "$s1g_prim_1mhz_chan_index" = "auto" ]; then
			if [ "$bw" -eq 8 ]; then
				s1g_prim_1mhz_chan_index=3
			elif [ "$bw" -eq 4 ]; then
				if [ "$s1g_prim_chwidth" -eq 2 ]; then
					s1g_prim_1mhz_chan_index=2
				else
					s1g_prim_1mhz_chan_index=1
				fi
			else
				s1g_prim_1mhz_chan_index=0
			fi

		fi

		s1g_prim_chwidth=$(( $s1g_prim_chwidth - 1 ))

		set_default s1g_capab "[SHORT-GI-ALL]"

	fi

	json_get_vars country_ie doth
	[ -z "$country_ie" ] && json_add_boolean country_ie '0'
	[ -z "$doth" ] && json_add_boolean doth '0'

	hostapd_prepare_device_config "$hostapd_conf_file" nl80211
	cat >> "$hostapd_conf_file" <<EOF
${channel:+channel=$channel}
${channel_list:+chanlist=$channel_list}
${op_class:+op_class=$op_class}
${s1g_capab:+s1g_capab=$s1g_capab}
${s1g_prim_chwidth:+s1g_prim_chwidth=$s1g_prim_chwidth}
${s1g_prim_1mhz_chan_index:+s1g_prim_1mhz_chan_index=$s1g_prim_1mhz_chan_index}
${hostapd_noscan:+noscan=1}
${tx_burst:+tx_queue_data2_burst=$tx_burst}
$base_cfg

EOF
	json_select ..
}


morse_hostapd_add_bss(){
	local _phy="$1"
	local _ifname="$2"
	local _macaddr="$3"
	local _type="$4"

	hostapd_cfg=
	append hostapd_cfg "# Interface $_ifname "
	append hostapd_cfg "$_type=$_ifname" "$N"

	json_select config
	morse_override_hostapd_set_bss_options hostapd_cfg "$_phy" "$vif" || return 1
	json_get_vars wds wds_bridge sae_pwe dtim_period max_listen_int start_disabled


	raw_block=
	json_for_each_item morse_hostapd_add_raw raws
	json_select ..

	set_default wds 0
	set_default start_disabled 0
	set_default sae_pwe 1

	if [ "$wds" -gt 0 ]; then
		append hostapd_cfg "wds_sta=1" "$N"
		[ -n "$wds_bridge" ] && append hostapd_cfg "wds_bridge=$wds_bridge" "$N"
	fi

	[ "$start_disabled" -eq 1 ] && append hostapd_cfg "start_disabled=1" "$N"

		cat >> /var/run/hostapd-$_phy.conf <<EOF
$hostapd_cfg
bssid=$_macaddr
${dtim_period:+dtim_period=$dtim_period}
${max_listen_int:+max_listen_interval=$max_listen_int}
${sae_pwe:+sae_pwe=$sae_pwe}
$raw_block
EOF
}

morse_hostapd_add_raw(){
	local cfgtype priority enabled start_time_us duration_us slots cross_slot max_beacon_spread nominal_stas_per_beacon
	local T="	"
	config_load wireless
	config_get cfgtype "$1" TYPE
	[ "$cfgtype" != "raw" ] && return

	config_get priority "$1" priority
	config_get enabled "$1" enabled
	config_get start_time_us "$1" start_time_us
	config_get duration_us "$1" duration_us
	config_get slots "$1" slots
	config_get cross_slot "$1" cross_slot
	config_get max_beacon_spread "$1" max_beacon_spread
	config_get nominal_stas_per_beacon "$1" nominal_stas_per_beacon

	append raw_block "raw={" "$N"
	append raw_block "priority=${priority:=0}" "$N$T"
	append raw_block "enabled=${enabled:=0}" "$N$T"
	append raw_block "${start_time_us:+start_time_us=$start_time_us}" "$N$T"
	append raw_block "${duration_us:+duration_us=$duration_us}" "$N$T"
	append raw_block "${slots:+slots=$slots}" "$N$T"
	append raw_block "cross_slot=${cross_slot:=false}" "$N$T"
	append raw_block "${max_beacon_spread:+max_beacon_spread=$max_beacon_spread}" "$N$T"
	append raw_block "${nominal_stas_per_beacon:+nominal_stas_per_beacon=$nominal_stas_per_beacon}" "$N$T"
	append raw_block "}" "$N"
}

#################################################
#
#      wpa_supplicant helpers
#
#################################################

morse_wpa_supplicant_add() {
	local _ifname=$1
	local _enable=$2

	if [ "$_enable" = 0 ]; then
		echo "interface is disabled"
		kill_wait wpa_supplicant_s1g &> /dev/null
		ip link set dev "$_ifname" down
		iw dev "$_ifname" del
		return 0
	fi

	wpa_supplicant_prepare_interface "$_ifname" nl80211 || {
		echo "wpa_supplicant_prepare_interface failed."
		iw dev "$_ifname" del
		return 1
	}
	morse_wpa_supplicant_prepare_interface "$_ifname"
	if [ "$mode" = "sta" ]; then
		morse_override_wpa_supplicant_add_network "$_ifname"
	else
		morse_override_wpa_supplicant_add_network "$_ifname" "$freq" "$htmode" "$noscan"
	fi

	_wpa_supplicant_common $_ifname
	#need to handle bridge mode??
	/sbin/wpa_supplicant_s1g -t -D nl80211 -s -i $_ifname -c $_config -B

	return 0
}


#################################################
#
#      interface helpers
#
#################################################

find_phy() {
	[ -n "$phy" -a -d /sys/class/ieee80211/$phy ] && return 0

	if [ -n "$path" ]; then
		phy="$(iwinfo nl80211 phyname "path=$path")"
		[ -n "$phy" ] && return 0
	fi

	if [ -n "$macaddr" ]; then
		for phy in $(ls /sys/class/ieee80211 2>/dev/null); do
			grep -i -q "$macaddr" "/sys/class/ieee80211/${phy}/macaddress" && return 0
		done
	fi
	return 1
}

morse_iw_interface_add() {
	local _phy="$1"
	local _ifname="$2"
	local _type="$3"
	local _wdsflag="$4"
	local rc
	local old_ifname

	iw phy "$_phy" interface add "$_ifname" type "$_type" $_wdsflag
	rc="$?"

	echo "returned $rc"
	if [ "$rc" = 233 ]; then
		# Device might have just been deleted, give the kernel some time to finish cleaning it up
		sleep 1
		echo "retrying..."
		iw phy "$_phy" interface add "$_ifname" type "$_type" $_wdsflag >/dev/null 2>&1
		rc="$?"
	fi

	if [ "$rc" = 233 ]; then
		# Keep matching pre-existing interface
		if [ -d "/sys/class/ieee80211/${_phy}/device/net/${_ifname}" ]; then
			case "$(iw dev $_ifname info | grep "^\ttype" | cut -d' ' -f2- 2>/dev/null)" in
				"AP")
					[ "$_type" = "__ap" ] && rc=0
					;;
				"IBSS")
					[ "$_type" = "adhoc" ] && rc=0
					;;
				"managed")
					[ "$_type" = "managed" ] && rc=0
					;;
				"mesh point")
					[ "$_type" = "mp" ] && rc=0
					;;
				"monitor")
					[ "$_type" = "monitor" ] && rc=0
					;;
			esac
		fi
	fi

	if [ "$rc" = 233 ]; then
		iw dev "$_ifname" del >/dev/null 2>&1
		if [ "$?" = 0 ]; then
			sleep 1
			iw phy "$_phy" interface add "$_ifname" type "$_type" $_wdsflag >/dev/null 2>&1
			rc="$?"
		fi
	fi

	if [ "$rc" != 0 ]; then
		# Device might not support virtual interfaces, so the interface never got deleted in the first place.
		# Check if the interface already exists, and avoid failing in this case.
		[ -d "/sys/class/ieee80211/${_phy}/device/net/${_ifname}" ] && rc=0
	fi

	if [ "$rc" != 0 ]; then
		# Device doesn't support virtual interfaces and may have existing interface other than _ifname.
		old_ifname="$(basename "/sys/class/ieee80211/${_phy}/device/net"/* 2>/dev/null)"
		[ "$old_ifname" ] && ip link set "$old_ifname" name "$_ifname" 1>/dev/null 2>&1
		rc="$?"
	fi

	[ "$rc" != 0 ] && echo "Failed to create interface $_ifname"
	return $rc
}

morse_get_addr() {
	local phy="$1"
	local idx="$(($2 + 1))"

	head -n $idx /sys/class/ieee80211/${phy}/addresses | tail -n1
}

#this is exactly same as mac80211.sh
morse_generate_mac() {
	local phy="$1"
	local id="${macidx:-0}"

	local ref="$(cat /sys/class/ieee80211/${phy}/macaddress)"
	local mask="$(cat /sys/class/ieee80211/${phy}/address_mask)"

	[ "$mask" = "00:00:00:00:00:00" ] && {
		mask="ff:ff:ff:ff:ff:ff";

		[ "$(wc -l < /sys/class/ieee80211/${phy}/addresses)" -gt $id ] && {
			addr="$(morse_get_addr "$phy" "$id")"
			[ -n "$addr" ] && {
				echo "$addr"
				return
			}
		}
	}

	local oIFS="$IFS"; IFS=":"; set -- $mask; IFS="$oIFS"

	local mask1=$1
	local mask6=$6

	local oIFS="$IFS"; IFS=":"; set -- $ref; IFS="$oIFS"

	macidx=$(($id + 1))
	[ "$((0x$mask1))" -gt 0 ] && {
		b1="0x$1"
		[ "$id" -gt 0 ] && \
			b1=$(($b1 ^ ((($id - !($b1 & 2)) << 2)) | 0x2))
		printf "%02x:%s:%s:%s:%s:%s" $b1 $2 $3 $4 $5 $6
		return
	}

	[ "$((0x$mask6))" -lt 255 ] && {
		printf "%s:%s:%s:%s:%s:%02x" $1 $2 $3 $4 $5 $(( 0x$6 ^ $id ))
		return
	}

	off2=$(( (0x$6 + $id) / 0x100 ))
	printf "%s:%s:%s:%s:%02x:%02x" \
		$1 $2 $3 $4 \
		$(( (0x$5 + $off2) % 0x100 )) \
		$(( (0x$6 + $id) % 0x100 ))
}

set_chipid() {
	local chip_revision=''
	local hex_id=$(morsectrl io -r 0x10054d20 -s 32)

	if [ "$hex_id" = "0x00000206" ]; then
		chip_revision="C0"
	elif [ "$hex_id" = "0x00000306" ]; then
		chip_revision="C1"
	elif [ "$hex_id" = "0x00000406" ]; then
		chip_revision="C2"
	fi;

	uci set system.@system[0].notes="MM6108_${chip_revision}"
	uci commit system
}

add_driver morse
