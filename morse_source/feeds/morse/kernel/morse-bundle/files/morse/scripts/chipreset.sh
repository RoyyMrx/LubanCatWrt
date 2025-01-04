#!/bin/sh
#
# Copyright (C) 2023 Morse Micro Pty Ltd. All rights reserved.
#

remove_driver() {
    modules="morse dot11ah"

    for module in ${modules}; do
        result=`lsmod | grep ${module} | head -1 | cut -d " " -f1`

        # module loaded?
        if [ ! -z "${result}" ]; then
            rmmod ${module}
        fi
    done
}

apply_reset_signal() {
    local reset_gpio=$1
    local duration=$2
    echo "$reset_gpio">/sys/class/gpio/export
    echo "out">/sys/class/gpio/gpio$reset_gpio/direction
    echo "0">/sys/class/gpio/gpio$reset_gpio/value
    usleep ${duration:=100000}
    echo "in">/sys/class/gpio/gpio$reset_gpio/direction
    echo "$reset_gpio">/sys/class/gpio/unexport
    usleep ${duration:=100000}
}

arm_reset() {
    echo -n "fe300000.mmc" > /sys/bus/platform/drivers/mmc-bcm2835/unbind
    apply_reset_signal 5
    echo -n "fe300000.mmc" > /sys/bus/platform/drivers/mmc-bcm2835/bind
}

mips_reset() {
    apply_reset_signal 456
}

remove_driver

case "$(uname -m)" in
    *mips*)
        mips_reset
        ;;
    *aarch64*)
        arm_reset
        ;;
esac


