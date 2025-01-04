#!/bin/sh
set -e

FREQ=500
DISABLE_SPI=false

optstring="r"

while getopts ${optstring} arg; do
  case ${arg} in
    r)
       DISABLE_SPI=true
        ;;
    ?)
      echo "-r disable spi"
      exit 1
      ;;
  esac
done

if [ "$DISABLE_SPI" = "true" ]; then
    sed -i  "/cpu_freq=$FREQ/d" /boot/config.txt
    sed -i "/cpu_min_freq=$FREQ/d" /boot/config.txt

    sed -i -e 's/^dtparam=spi=on/\#dtparam=spi=on/g' /boot/config.txt
    sed -i -e 's/^dtoverlay=morse-spi/\#dtoverlay=morse-spi/g' /boot/config.txt

    sed -i -e '/powersave/d' /etc/rc.local
    sed -i -e '/1500000/d' /etc/rc.local

    echo "Reboot to finish disabling SPI"
else
    # set frequency
    echo "cpu_freq=$FREQ" >> /boot/config.txt
    echo "cpu_min_freq=$FREQ" >> /boot/config.txt

    # enable spi
    sed -i -e 's/^\#dtparam=spi=on/dtparam=spi=on/g' /boot/config.txt
    sed -i -e 's/^\#dtoverlay=morse-spi/dtoverlay=morse-spi/g' /boot/config.txt

    #set governor and minimum frequency
    sed -i -e '/nothing\./a echo \"1500000\" \> \/sys\/devices\/system/cpu/cpufreq\/policy0\/scaling_min_freq' /etc/rc.local
    sed -i -e '/nothing\./a echo powersave \> \/sys\/devices\/system\/cpu\/cpufreq\/policy0\/scaling_governor' /etc/rc.local

    rm -f /etc/uci-defaults/98-morse-wireless-defaults
    ln -s /morse/uci-defaults/98-morse-wireless-defaults /etc/uci-defaults/98-morse-wireless-defaults

    echo "Reboot to finish SPI setup"
fi
