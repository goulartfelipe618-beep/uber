FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/geo-api ./cmd/api

FROM alpine:3.20

RUN addgroup -S app && adduser -S app -G app \
    && apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /out/geo-api /app/geo-api

USER app

EXPOSE 8080

ENTRYPOINT ["/app/geo-api"]
