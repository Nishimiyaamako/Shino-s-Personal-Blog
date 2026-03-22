---
title: "Arch & Endeavouros 安装配置"
slug: arch-endeavouros-setup
date: 2026-03-08
theme: 安装配置
tags:
  - linux
  - archlinux
  - dual-boot
  - grub
  - system-setup
summary: "记录 Arch/Endeavouros 双系统分区、GRUB 与驱动软件的安装配置流程。"
status: published
---

# 1 双系统自定义分区
> 系统根目录格式btrfs，boot目录格式FAT32，swap分区至少内存容量的一半，home分区同理使用btrfs如果使用ntfs格式会出现用户权限授权问题
 
# 2 配置grub
 1. 检查os-prober是否运行
 2. 在 ``` /etc/default/grub ```里取消在最后一栏里``` GRUB_DISABLE_OS_PROBER=false``` 的注释启用os-prober
 3. mount挂载win的boot分区到根目录``` sudo mount / *win分区* /mnt ```
 4. 然后运行``` sudo grub-mkconfig -o /boot/grub/grub.cfg ```自动检测修改grub引导
 5. 检查是否挂载winboot成功
# 3 基本驱动&软件
```
sudo pacman -S nvidia-dkms nvidia-settings yazi hyprland sddm obsidian ark
```

```
yay -S clash-verge-rev-bin pot-translation-bin librewolf-bin visual-studio-code-bin linuxqq-bin piliplus-bin kazumi-bin onlyoffice-bin
```
# 4 SWAP休眠配置

## 4.1 配置空间和格式化

```
 sudo mkswap /dev/nvmeX 
 sudo swapon /dev/nvmeX
```

## 4.2 挂载
>获取UUID 
>`sudo blkid /dev/nvmeX
> 添加到fstab
>`echo 'UUID=你的UUID none swap defaults 0 0' | sudo tee -a /etc/fstab
## 4.3 grub启动项配置
>`sudo nano /etc/default/grub
>修改以下内容
>`GRUB_CMDLINE_LINUX_DEFAULT="quiet splash resume=UUID=你的swap分区UUID"
> 重新生成GRUB配置 
>`sudo grub-mkconfig -o /boot/grub/grub.cfg`

## 4.4 mkinitcpio配置

- 安装 mkinitcpio
```
sudo pacman -S mkinitcpio
```
- 编辑 mkinitcpio.conf，加入 resume HOOK
```
sudo nano /etc/mkinitcpio.conf
```
- 寫入
```
 HOOKS=(base udev autodetect microcode modconf kms keyboard keymap consolefont block filesystems resume fsck)
```

- 重建 initramfs
```
sudo mkinitcpio -P
```
- 更新 GRUB
```
sudo grub-mkconfig -o /boot/grub/grub.cfg
```
- 重启
``` 
sudo reboot
``` 
- 验证并测试
``` 
cat /proc/cmdline
cat /sys/power/resume  # 应该是非 0:0
systemctl hibernate
``` 

## 4.5 dracut配置
>*使用时Endeavouros配置时默认的是dracut,本质其实和mkinitcpio一样的*只不過兩者兼容性上有區別，上面的與end 4的配置具有兼容性
>
>写入配置

``` 
bash -c 'sudo tee /etc/dracut.conf.d/resume.conf >/dev/null << "EOF"
add_dracutmodules+=" resume "
install_items+="/usr/lib/systemd/system/systemd-hibernate-resume.service "
EOF
'
``` 
> `重建 initramfs`
``` 
sudo dracut-rebuild || sudo dracut --regenerate-all --force

#然后重启
sudo reboot
``` 

# 5 雙系統文件訪問
## 5.1 linux下
> 直接在fstab裡寫入對應的UUID就可以自動掛載了


# 6 键盘F区默认功能键问题

在终端运行以下命令，将模式改为 `2`，然后立即测试 F1-F12 是否恢复正常：

bash

`echo 2 | sudo tee /sys/module/hid_apple/parameters/fnmode`

**永久生效（写入配置文件）：**  
如果临时测试有效，可以通过以下命令将其固化：

1. 创建或编辑 `modprobe` 配置文件：
    

bash

`echo "options hid_apple fnmode=2" | sudo tee /etc/modprobe.d/hid_apple.conf`

2. 为了确保在系统启动初期就生效，你需要重新生成内核初始内存盘镜像（initramfs） ：[](https://www.reddit.com/r/AsahiLinux/comments/135tzmd/options_hid_apple_fnmode2_as_a_file_in_modprobed/)​
    

bash

`sudo mkinitcpio -P`
 
