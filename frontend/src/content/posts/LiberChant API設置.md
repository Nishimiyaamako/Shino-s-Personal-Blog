---
title: "LibreChat API 设置（Docker）"
slug: librechat-api-setup
date: 2026-03-08
theme: 安装配置
tags:
  - linux
  - docker
  - librechat
  - proxy
  - ai-tools
summary: "整理 LibreChat 的 Docker 安装、代理配置与常见报错处理步骤。"
status: published
---

# 1 安装Docker  

```
sudo pacman -Syu docker docker-compose  
```

```
# 启动 Docker 服务并设置为开机自启
sudo systemctl enable --now docker.service  

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER  
```

# 2 Docker版配置和安裝以及解決報錯  

## 2.1 克隆官方仓库
 
```
git clone https://github.com/danny-avila/LibreChat.git   
```
## 2.2 进入目录 
```   
cd LibreChat  
   ``` 
## 2.3 配置环境变量
LibreChat 需要一个 `.env` 文件来存储配置（如 API 密钥、端口设置）
```
cp .env.example .env  
```

## 2.4 运行代理软件（如 Clash, Mihomo, v2ray 等）需要以下操作  
>代理端口建議只開一個混合端口，多開其他的可能會導致下載錯誤  

## 2.5 创建 Docker 網絡服务配置目录

  ```
    sudo mkdir -p /etc/systemd/system/docker.service.d      
```
- **创建Docker代理配置文件**  
	 编辑：
````   
sudo nano /etc/systemd/system/docker.service.d/http-proxy.conf
````

**粘贴以下内容**（假设你的代理端口是 7890，如果是其他端口请修改）：
	
```
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:7890" Environment="HTTPS_PROXY=http://127.0.0.1:7890" Environment="NO_PROXY=localhost,127.0.0.1,docker-registry.somecorporation.com"
```
    
- **重载并重启 Docker**  
    让配置生效：
```
    sudo systemctl daemon-reload 
    sudo systemctl restart docker
```
## 2.6 消除報錯
>警告信息 `WARN[0000] The "UID" variable is not set` 是因为 LibreChat 的 Docker 配置使用了当前用户的 ID 来管理文件权限，但在环境变量中没找到这两个值。
**解决方法：**

1. 打開 `.env` 文件  在文件末尾添加以下：`UID=1000 GID=1000`

_(可以通过在终端输入 `id -u` 和 `id -g` 来确认你的具体 ID，但单用户系统默认都是 1000)_
2. 在宿主机修复目录权限
```
# 把整个项目目录的所有权改成当前用户

sudo chown -R "$USER":"$USER" .

# 确保日志和上传目录存在，并给足写权限
mkdir -p logs api/logs client/public/images uploads

sudo chmod -R 777 logs
sudo chmod -R 777 api/logs
sudo chmod -R 777 client/public/images
sudo chmod -R 777 uploads

```

# 3 設置key                                                                                                                                                                                                                                                                                                                                      

- **在LibreChat根目录下**，编辑`.env`文件找到並修改添加key：`OPENROUTER_KEY=sk-or-v1-your-actual-key-here`      

-  檢查（一般直接使用默認librechat.yaml.example）配置文件 librechat.yaml      

-  检查或创建 `docker-compose.override.yml`確保有以下內容      

```
services:      
  api:      
    volumes:      
      - type: bind      
        source: ./librechat.yaml      
        target: /app/librechat.yaml           
``` 

# 4 更新librechat      

以下命令将获取最新的 LibreChat 项目更改，包括对 *docker compose* 文件的任何必要更改，以及最新的预构建镜像。    

停止正在运行的容器    

```
sudo docker compose down      
```

删除所有现有的 Docker 镜像    

```
sudo docker images -a | grep "librechat" | awk '{print $3}' | xargs docker rmi  
```

拉取最新的项目更改    

```
sudo git pull      
```

拉取最新的 LibreChat 镜像      

```
sudo docker compose pull      
```

启动 LibreChat      

```
sudo docker compose up                                                  
```

# 5 雜項                                                    

- 重啟服務（記得先進文件路徑）
```
docker compose down
docker compose up -d
```
- 端口號
```
http://localhost:3080
```
- 數據位置
``` 
LibreChat 项目目录/
├── data/                 # 主要数据目录（聊天记录、用户设置）
│   ├── mongodb/          # MongoDB 数据库（聊天历史、用户信息）
│   ├── meilisearch/      # 搜索索引数据
│   └── pgvector/         # 向量数据库（RAG、智能体记忆）
├── logs/                 # 日志文件
├── uploads/              # 用户上传的图片/文件
└── client/public/images/ # 生成图片等
``` 
