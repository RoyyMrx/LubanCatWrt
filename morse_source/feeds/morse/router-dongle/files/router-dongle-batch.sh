#!/bin/sh

IPKS="$@"

sleep 10 #wait for caller to exit

opkg update
for ipk in ${IPKS}; do
    opkg install /tmp/packages/${ipk}.ipk > /dev/kmsg 2>&1
    rm /tmp/packages/${ipk}.ipk
done;

/morse/scripts/netsetup.sh