# Map Demo

Demo map tokyo dùng vite + react + ts

- Dự án dùng bun [Bun](https://bun.sh)

## Setup

```bash
bun install
```

## Environment

Tạo file `.env` ở root project (tham khảo env.example):

```env
VITE_MAPBOX_TOKEN=pk.eyJ...
VITE_API_URL=https://your-api-url.com
```

## Chạy local (development)

```bash
bun run dev
```

Mở `http://localhost:5173`.

## Build production

```bash
bun run build
```

Output ra thư mục `dist/`. Có thể test bằng:

```bash
bun run preview
```

## Docker

### Build image

```bash
docker build -t map-demo .
```

### Run container

```bash
docker run -d -p 5173:80 --name map-demo map-demo
```

Mở `http://localhost:5173`.
