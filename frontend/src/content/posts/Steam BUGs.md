---
title: "Steam BUGs 记录（Linux）"
slug: steam-bugs-linux
date: 2026-03-08
tags:
  - steam
  - linux-gaming
  - proton
  - troubleshooting
summary: "记录 Linux 下 Steam/Proton 兼容问题与挂载权限相关的解决思路。"
status: published
---

自动安装社区优化版Proton 环境
```
yay -S protonup-qt
```

Linux的双系统在NTFS里的分区配置需要兼容GE-Proton 10-29的需求，强制声明用户权限，否则会启动不了游戏。
``` 
UUID=硬盘UUID  /挂载点  ntfs-3g  defaults,uid=1000,gid=1000,rw,user,exec,umask=000 00
``` 


P社系列打mod的话对Linux非常不友好

鸣潮使用GE Porton可以流畅游玩
