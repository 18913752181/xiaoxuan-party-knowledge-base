# 国内稳定访问部署方案

当前线上地址部署在 Vercel：

```text
https://xiaoxuan-party-knowledge-base.vercel.app
```

这个地址在国内网络不稳定，不是网站代码问题，而是海外托管和 `vercel.app` 域名在国内网络环境下可能被阻断、限速或解析异常。

## 推荐结论

如果目标用户主要在中国大陆，并且希望普通用户不开 VPN 也能稳定打开，推荐：

1. 购买国内云服务器，例如腾讯云、阿里云、华为云。
2. 准备一个自己的域名。
3. 完成 ICP 备案。
4. 把本项目部署到国内服务器。
5. 用 Nginx 做 HTTPS 反向代理。

## 临时方案

如果暂时没有 ICP 备案：

1. 先购买自有域名。
2. 把域名绑定到 Vercel。
3. 用自有域名访问，避免直接使用 `vercel.app`。

注意：这个方案只能改善一部分访问问题，不能保证中国大陆长期稳定访问。

## 稳定方案：国内服务器部署

项目已经开启 Next.js standalone 输出，构建后可用于 Node 服务器部署。

### 1. 本地构建

```powershell
npm install
npm run build
```

### 2. 上传到服务器

需要上传：

```text
.next/standalone
.next/static
public
content
package.json
```

### 3. 服务器环境变量

在服务器配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://nyjditrrwfrpfcotrzzj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
PORT=3000
```

### 4. 启动服务

进入 `.next/standalone` 目录后运行：

```bash
node server.js
```

正式运行建议使用 PM2：

```bash
pm2 start server.js --name xiaoxuan-site
pm2 save
```

### 5. Nginx 反向代理

示例：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

配置 HTTPS 后，把域名解析到服务器公网 IP。

## 注意事项

- `content/` 仍然是资料主数据源，必须随项目一起上传。
- Supabase 仍用于登录、收藏等用户行为数据。
- 如果继续使用 Supabase 海外服务，登录和收藏在部分国内网络下仍可能较慢。后续如需完全国产化，需要把用户系统迁移到国内数据库或国内 BaaS。
- 文件下载如果走本项目接口，部署到国内服务器后访问稳定性会明显好于 Vercel。
