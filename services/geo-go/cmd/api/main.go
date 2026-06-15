package main

import (
	"log"

	httpdelivery "github.com/transportepro/geo-go/internal/delivery/http"
	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
	matchinfra "github.com/transportepro/geo-go/internal/infrastructure/match"
	"github.com/transportepro/geo-go/internal/platform/config"
	healthusecase "github.com/transportepro/geo-go/internal/usecase/health"
	matchusecase "github.com/transportepro/geo-go/internal/usecase/match"
)

func main() {
	cfg := config.Load()
	healthService := healthusecase.NewService("geo-go")
	var driverRepository domainmatch.DriverRepository = matchinfra.NewInMemoryDriverRepository()
	if cfg.PGDsn != "" {
		driverRepository = matchinfra.NewPostgresDriverRepository(cfg.PGDsn)
	}
	candidateFinder := matchusecase.NewCandidateFinder(driverRepository)
	scoringEngine := matchusecase.NewScoringEngine()
	matchService := matchusecase.NewService(candidateFinder, scoringEngine)
	server := httpdelivery.NewServer(":"+cfg.HTTPPort, healthService, matchService)

	log.Printf("geo-go starting on port %s in %s mode", cfg.HTTPPort, cfg.Environment)

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
