package match

import (
	"math"
	"sort"

	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
)

type ScoringEngine struct{}

func NewScoringEngine() *ScoringEngine {
	return &ScoringEngine{}
}

func (e *ScoringEngine) Score(
	request domainmatch.MatchRequest,
	candidates []domainmatch.Candidate,
	stageNumber int,
) ([]domainmatch.CandidateScore, error) {
	if len(candidates) == 0 {
		return []domainmatch.CandidateScore{}, nil
	}

	maxETASeconds := float64(request.MaxETASeconds)
	if maxETASeconds <= 0 {
		maxETASeconds = 900
	}

	distanceWeight := adjustedDistanceWeight(stageNumber)
	scores := make([]domainmatch.CandidateScore, 0, len(candidates))

	for _, candidate := range candidates {
		distanceScore := clamp(1-float64(candidate.Driver.ETASeconds)/maxETASeconds, 0, 1)
		reputationScore := clamp((candidate.Driver.Rating-4.0)/1.0, 0, 1)
		acceptanceScore := clamp((candidate.Driver.AcceptanceRate-0.35)/0.65, 0, 1)
		cancellationScore := clamp(1-candidate.Driver.CancellationRate/0.20, 0, 1)
		onlineScore := clamp(float64(candidate.Driver.OnlineMinutesToday)/480.0, 0, 1)
		experienceScore := clamp(math.Log10(float64(candidate.Driver.CompletedRides)+1)/4.0, 0, 1)
		compatibilityScore := candidate.CompatibilityScore

		if request.NeedsWheelchairAccessible && compatibilityScore < 0.95 {
			compatibilityScore = 0.95
		}

		bonus := 0.0
		if request.PassengerReputationTier == domainmatch.ReputationTierElite && candidate.Driver.IsPremiumEligible {
			bonus += 0.06
		}

		if resolveDriverTier(candidate.Driver.Rating) == domainmatch.ReputationTierElite {
			bonus += 0.05
		}

		if request.IsCorporate && candidate.Driver.AllowsCorporate {
			bonus += 0.04
		}

		penalty := 0.0
		if request.IsShared {
			penalty = clamp(float64(candidate.Driver.ExtraETASeconds)/(12.0*60.0), 0, 0.20)
		}

		finalScore := distanceWeight*distanceScore +
			0.18*reputationScore +
			0.12*acceptanceScore +
			0.10*cancellationScore +
			0.08*onlineScore +
			0.08*experienceScore +
			0.12*compatibilityScore +
			bonus -
			penalty

		scores = append(scores, domainmatch.CandidateScore{
			Candidate:  candidate,
			FinalScore: finalScore,
			Breakdown: domainmatch.ScoreBreakdown{
				Distance:      distanceScore,
				Reputation:    reputationScore,
				Acceptance:    acceptanceScore,
				Cancellation:  cancellationScore,
				OnlineTime:    onlineScore,
				Experience:    experienceScore,
				Compatibility: compatibilityScore,
				Bonus:         bonus,
				Penalty:       penalty,
			},
		})
	}

	sort.Slice(scores, func(i, j int) bool {
		if scores[i].FinalScore == scores[j].FinalScore {
			if scores[i].Candidate.Driver.ETASeconds == scores[j].Candidate.Driver.ETASeconds {
				if scores[i].Candidate.Driver.DistanceMeters == scores[j].Candidate.Driver.DistanceMeters {
					return scores[i].Candidate.Driver.DriverID < scores[j].Candidate.Driver.DriverID
				}

				return scores[i].Candidate.Driver.DistanceMeters < scores[j].Candidate.Driver.DistanceMeters
			}

			return scores[i].Candidate.Driver.ETASeconds < scores[j].Candidate.Driver.ETASeconds
		}

		return scores[i].FinalScore > scores[j].FinalScore
	})

	return scores, nil
}

func adjustedDistanceWeight(stageNumber int) float64 {
	if stageNumber <= 2 {
		return 0.32
	}

	reductionFactor := 1 - 0.05*float64(stageNumber-2)
	return 0.32 * clamp(reductionFactor, 0.70, 1)
}

func resolveDriverTier(rating float64) domainmatch.ReputationTier {
	switch {
	case rating >= 4.90:
		return domainmatch.ReputationTierElite
	case rating >= 4.80:
		return domainmatch.ReputationTierPremium
	case rating >= 4.60:
		return domainmatch.ReputationTierReliable
	case rating >= 4.30:
		return domainmatch.ReputationTierObserved
	default:
		return domainmatch.ReputationTierRestricted
	}
}

func clamp(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}

	if value > maxValue {
		return maxValue
	}

	return value
}
