# Sử dụng image chính thức của Bun
FROM oven/bun:alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy các file quản lý package vào trước để tận dụng cache của Docker
COPY package.json bun.lockb ./

# Cài đặt dependencies bằng bun
RUN bun install --frozen-lockfile

# Copy toàn bộ mã nguồn dự án vào
COPY . .

# Tiến hành build ứng dụng (kết quả sẽ nằm trong thư mục /dist)
RUN bun run build

# Mở port 3000 cho container
EXPOSE 3000

# Dùng bunx để chạy thư viện 'serve', serve thư mục 'dist' dưới dạng Single Page App (-s) ở port 3000
CMD ["bunx", "serve", "-s", "dist", "-l", "3000"]