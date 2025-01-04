#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/mtd/mtd.h>
#include <linux/err.h>

/*
 *
 * Copyright (C) 2021-2022 Morse Micro Pty Ltd. All rights reserved.
 *
 *
 */

#ifndef MODULE
#error "Must be compiled as a module."
#endif

#define MOD_WARNING KERN_WARNING "w2factory : "
#define MOD_INFO KERN_INFO "w2factory : "
#define MOD_ERR KERN_ERR "w2factory : "

static bool i_take_the_risk = false;
module_param(i_take_the_risk, bool, S_IRUGO);
MODULE_PARM_DESC(i_take_the_risk, "Make factory partition writeable");

int w2factory_init(void)
{
    struct mtd_info *mtd;
    if (!i_take_the_risk)
    {
        printk(MOD_ERR "must specify i_take_the_risk=1 to continue\n");
        return -EINVAL;
    }

    mtd = get_mtd_device_nm("factory");
    printk(KERN_INFO "value before, 0x%x\n",mtd->flags);
    mtd->flags |= MTD_WRITEABLE;
    printk(KERN_INFO "value after, 0x%x\n",mtd->flags);
    
    printk(KERN_INFO "unlock factory, now it is writeable\n");
    return 0;
}

void w2factory_exit(void)
{
    struct mtd_info *mtd;
    
    mtd = get_mtd_device_nm("factory");

    printk(KERN_INFO "value before, 0x%x\n",mtd->flags);
    mtd->flags &=  ~((uint32_t)MTD_WRITEABLE);
    printk(KERN_INFO "value after, 0x%x\n",mtd->flags);
    
    printk(KERN_INFO "lock factory, now it is read-only\n");
}

module_init(w2factory_init);
module_exit(w2factory_exit);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("MorseMicro");