#!/usr/bin/env bash

echo '*********application lubancat defconfig*********'
./scripts/feeds update -a 
./scripts/feeds install -a

#更新morse升级软件包列表
./scripts/feeds install -p morse -a
./scripts/feeds uninstall iwinfo openocd expat
./scripts/feeds install -f -p morse iwinfo expat openocd

echo '*********application lubancat defconfig*********'
#生成默认配置文件
cat ./config/rockchip_defconfig >.config
#生成morse所需文件依赖
awk 1 ./boards/common/*_diffconfig >> .config
awk 1 ./boards/common_extras/*_diffconfig >> .config

echo 'Make defconfig and enter make muneconfig...'
make defconfig
make menuconfig

