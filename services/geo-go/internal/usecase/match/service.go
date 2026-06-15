package match

import domainmatch "github.com/transportepro/geo-go/internal/domain/match"

type Service struct {
	candidateFinder domainmatch.CandidateFinder
	scoringEngine   domainmatch.ScoringEngine
}

func NewService(
	candidateFinder domainmatch.CandidateFinder,
	scoringEngine domainmatch.ScoringEngine,
) *Service {
	return &Service{
		candidateFinder: candidateFinder,
		scoringEngine:   scoringEngine,
	}
}

func (s *Service) Match(request domainmatch.MatchRequest) (domainmatch.MatchResult, error) {
	stages := request.RadiusStages
	if len(stages) == 0 {
		stages = []int{800, 1500, 2500, 4000, 6500, 10000}
	}

	for index, radiusMeters := range stages {
		stageNumber := index + 1

		candidates, err := s.candidateFinder.FindCandidates(request, radiusMeters)
		if err != nil {
			return domainmatch.MatchResult{}, err
		}

		if len(candidates) == 0 {
			continue
		}

		scoredCandidates, err := s.scoringEngine.Score(request, candidates, stageNumber)
		if err != nil {
			return domainmatch.MatchResult{}, err
		}

		if len(scoredCandidates) == 0 {
			continue
		}

		return domainmatch.MatchResult{
			MatchedDriverID:    scoredCandidates[0].Candidate.Driver.DriverID,
			StageNumber:        stageNumber,
			SearchRadiusMeters: radiusMeters,
			RankedCandidates:   scoredCandidates,
		}, nil
	}

	return domainmatch.MatchResult{}, domainmatch.ErrNoMatchFound
}
