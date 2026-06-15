package config

import "os"

type Config struct {
	Environment string
	HTTPPort    string
	PGDsn       string
}

func Load() Config {
	return Config{
		Environment: getEnv("APP_ENV", "development"),
		HTTPPort:    getEnv("HTTP_PORT", "8080"),
		PGDsn:       getEnv("PG_DSN", ""),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}
