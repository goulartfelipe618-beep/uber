package http

import (
	"encoding/json"
	"net/http"
	"time"

	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
	healthusecase "github.com/transportepro/geo-go/internal/usecase/health"
)

func NewServer(
	addr string,
	healthService *healthusecase.Service,
	matchService domainmatch.MatchService,
) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, healthService.Check())
	})

	mux.HandleFunc("/api/v1/geo/health", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{
			"service": "geo-go",
			"module":  "geolocation",
			"status":  "ok",
		})
	})

	mux.HandleFunc("/api/v1/match/health", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{
			"service": "geo-go",
			"module":  "match",
			"status":  "ok",
		})
	})

	mux.HandleFunc("/api/v1/match/resolve", buildMatchResolveHandler(matchService))

	return &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func respondJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
