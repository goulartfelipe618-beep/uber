package http

import (
	"encoding/json"
	"errors"
	"net/http"

	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
)

type matchResolveRequest struct {
	RideID                    string   `json:"ride_id"`
	PassengerID               string   `json:"passenger_id"`
	PickupLat                 float64  `json:"pickup_lat"`
	PickupLng                 float64  `json:"pickup_lng"`
	RequestedCategory         string   `json:"requested_category"`
	AllowedFallbackCategories []string `json:"allowed_fallback_categories"`
	PassengerReputationTier   string   `json:"passenger_reputation_tier"`
	RadiusStages              []int    `json:"radius_stages"`
	MaxETASeconds             int      `json:"max_eta_seconds"`
	IsAirport                 bool     `json:"is_airport"`
	IsCorporate               bool     `json:"is_corporate"`
	IsShared                  bool     `json:"is_shared"`
	NeedsWheelchairAccessible bool     `json:"needs_wheelchair_accessible"`
}

type matchResolveResponse struct {
	MatchedDriverID    string                            `json:"matched_driver_id"`
	StageNumber        int                               `json:"stage_number"`
	SearchRadiusMeters int                               `json:"search_radius_meters"`
	RankedCandidates   []matchResolveCandidateResponse   `json:"ranked_candidates"`
}

type matchResolveCandidateResponse struct {
	DriverID         string                         `json:"driver_id"`
	FinalScore       float64                        `json:"final_score"`
	DistanceMeters   int                            `json:"distance_meters"`
	ETASeconds       int                            `json:"eta_seconds"`
	Compatibility    float64                        `json:"compatibility_score"`
	Breakdown        domainmatch.ScoreBreakdown     `json:"breakdown"`
}

func buildMatchResolveHandler(matchService domainmatch.MatchService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{
				"error": "method_not_allowed",
			})
			return
		}

		var payload matchResolveRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})
			return
		}

		if payload.RideID == "" || payload.PassengerID == "" || payload.RequestedCategory == "" {
			respondJSON(w, http.StatusBadRequest, map[string]string{
				"error": "missing_required_fields",
			})
			return
		}

		result, err := matchService.Match(domainmatch.MatchRequest{
			RideID:                    payload.RideID,
			PassengerID:               payload.PassengerID,
			PickupLat:                 payload.PickupLat,
			PickupLng:                 payload.PickupLng,
			RequestedCategory:         payload.RequestedCategory,
			AllowedFallbackCategories: payload.AllowedFallbackCategories,
			PassengerReputationTier:   domainmatch.ReputationTier(payload.PassengerReputationTier),
			RadiusStages:              payload.RadiusStages,
			MaxETASeconds:             payload.MaxETASeconds,
			IsAirport:                 payload.IsAirport,
			IsCorporate:               payload.IsCorporate,
			IsShared:                  payload.IsShared,
			NeedsWheelchairAccessible: payload.NeedsWheelchairAccessible,
		})
		if err != nil {
			statusCode := http.StatusInternalServerError
			errorCode := "match_failed"
			if errors.Is(err, domainmatch.ErrNoMatchFound) {
				statusCode = http.StatusNotFound
				errorCode = "no_match_found"
			}

			respondJSON(w, statusCode, map[string]string{
				"error": errorCode,
			})
			return
		}

		candidates := make([]matchResolveCandidateResponse, 0, len(result.RankedCandidates))
		for _, candidate := range result.RankedCandidates {
			candidates = append(candidates, matchResolveCandidateResponse{
				DriverID:       candidate.Candidate.Driver.DriverID,
				FinalScore:     candidate.FinalScore,
				DistanceMeters: candidate.Candidate.Driver.DistanceMeters,
				ETASeconds:     candidate.Candidate.Driver.ETASeconds,
				Compatibility:  candidate.Candidate.CompatibilityScore,
				Breakdown:      candidate.Breakdown,
			})
		}

		respondJSON(w, http.StatusOK, matchResolveResponse{
			MatchedDriverID:    result.MatchedDriverID,
			StageNumber:        result.StageNumber,
			SearchRadiusMeters: result.SearchRadiusMeters,
			RankedCandidates:   candidates,
		})
	}
}
