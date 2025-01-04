kill_wait()
{
	local names=$*
	local count=30

	for pid in $(pidof $names)
	do
		kill $pid &> /dev/null
	done

	while pidof $names &> /dev/null;
	do
		usleep 100000
		let "count--"
		if [ $count -eq 0 ]
		then
			echo "$names failed to terminate normally, force quitting" >&2
			kill -9 $(pidof $names)
			return 1
		fi
	done
	return 0
}

_list_phy_interfaces() {
	local phy="$1"
	if [ -d "/sys/class/ieee80211/${phy}/device/net" ]; then
		ls "/sys/class/ieee80211/${phy}/device/net" 2>/dev/null;
	else
		ls "/sys/class/ieee80211/${phy}/device" 2>/dev/null | grep net: | sed -e 's,net:,,g'
	fi
}

list_phy_interfaces() {
	local phy="$1"

	for dev in $(_list_phy_interfaces "$phy"); do
		readlink "/sys/class/net/${dev}/phy80211" | grep -q "/${phy}\$" || continue
	done
}

num_test()
{
	case $1 in
		''|*[!0-9]*)
			return 1
			;;
		*)
			;;
	esac
	return 0
}

_get_regulatory() {
	local _mode=$1
	local _country=$2
	local _channel=$3
	local _op_class=$4

	local dc_min="0.01"
	local dc_max="100.00"
	local cc; local bw; local l_op; local g_op;
	local freq; local dc_ap; local dc_sta;

	oIFS=$IFS
	HEADER=1
	while IFS=, read -r cc bw ch l_op g_op freq remainder; do
		if [ $HEADER = 1 ]; then
			HEADER=0
			continue
		fi
		num_test $bw
		[ $? -eq 1 ] 		&& continue
		num_test $ch
		[ $? -eq 1 ] 		&& continue
		num_test $l_op
		[ $? -eq 1 ] 		&& continue
		num_test $g_op
		[ $? -eq 1 ] 		&& continue

		if [ "$cc" == "$_country" ] && [ "$ch" -eq "$_channel" ]; then
			if [ -z "$_op_class" ]; then
				halow_bw=$bw
				center_freq=$freq
				# If you didn't pass op_class, set it from this data.
				op_class="$g_op"
				IFS=$oIFS
				return 0;
			elif [ "$l_op" -eq "$_op_class" ] || [ "$g_op" -eq "$_op_class" ]; then
				halow_bw=$bw
				center_freq=$freq
				IFS=$oIFS
				return 0;
			fi
		fi
	done < /usr/share/morse-regdb/channels.csv

	IFS=$oIFS
	return 1;
}


morse_get_iface_name()
{
	local MO_IF=
	for file in "/sys/class/net/wlan"*;
    do
        if [ -d "$file"/device/morse ]
        then
            MO_IF=$(basename $file)
            break
        fi
    done
	printf " `timeout 5s ifconfig | grep $MO_IF || timeout 5s ifconfig | grep mon0`" | awk '{print $1}'
}

# morse_io_read_address reads 1 byte from addr and return value in hex (without 0x)
# usage: "morse_io_read_address 0x1005411C" => bf
# returns empty in case of error
morse_io_read_address()
{
	local address=$1
	local val=$(morsectrl io -r $address)
	# make sure the the result is in 0xHHHHHHHH format
	if [[ "$val" =~ ^0x[0-9A-Fa-f]{8}$ ]]; then
		printf $(echo $val | tail -c 3)
	else
		printf ""
	fi
}

# this function checks if an macaddr is burnt into the device. 
# if so, returns it, otherwise returns an empty string
morse_get_chip_macaddr()
{
	local chip_macaddr="$(morse_io_read_address 0x10054118)"
	chip_macaddr=$chip_macaddr":$(morse_io_read_address 0x10054119)"
	chip_macaddr=$chip_macaddr":$(morse_io_read_address 0x1005411a)"
	chip_macaddr=$chip_macaddr":$(morse_io_read_address 0x1005411b)"
	chip_macaddr=$chip_macaddr":$(morse_io_read_address 0x1005411c)"
	chip_macaddr=$chip_macaddr":$(morse_io_read_address 0x1005411d)"
	
	#make sure (using regex) that the we got a macaddr
	if [[ "$chip_macaddr" =~ ^\([0-9A-Fa-f]{2}[:]\){5}\([0-9A-Fa-f]{2}\)$ ]]; then
		[ "$chip_macaddr" = "00:00:00:00:00:00" ] && printf "" || printf "$chip_macaddr"
	else
		printf ""
	fi
}