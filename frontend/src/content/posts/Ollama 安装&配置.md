---
title: "Ollama 安装与配置"
slug: ollama-install-config
date: 2026-03-08
tags:
  - ollama
  - linux
  - local-llm
  - setup
summary: "汇总 Ollama 在 Linux 下的安装、服务启用与卸载流程。"
status: published
---

- 下载&配置
``` 
# 仅 CPU 
sudo pacman -S ollama 
# 使用 NVIDIA GPU 
sudo pacman -S ollama-cuda 
# 使用 AMD GPU 
sudo pacman -S ollama-rocm
```

- 启用并启动 Ollama 服务
安装完成后，Ollama 会作为一个系统服务在后台运行。您需要启用该服务，使其在系统启动时自动运行，并立即启动它 
```
sudo systemctl enable --now ollama.service
```

`systemctl enable ollama.service`：将 Ollama 服务设置为开机自启动

- 命令 (以运行 `llama3` 模型为例)

```
ollama run llama3
```

- 卸载
取消 ollama 服务：

arch优先使用pacman卸载

```
sudo systemctl stop ollama
sudo systemctl disable ollama
sudo rm /etc/systemd/system/ollama.service
```

从您的 lib 目录中移除 ollama 库（或者 `/usr/local/lib`， `/usr/lib`， 或者 `/lib`）：

```
sudo rm -r $(which ollama | tr 'bin' 'lib')
```

从你的 bin 目录中删除 ollama 二进制文件（或者 `/usr/local/bin`， `/usr/bin`， 或者 `/bin`）：

```
sudo rm $(which ollama)
```

删除已下载的模型以及 Ollama 服务用户和组：

```
sudo userdel ollama
sudo groupdel ollama
sudo rm -r /usr/share/ollama
```
