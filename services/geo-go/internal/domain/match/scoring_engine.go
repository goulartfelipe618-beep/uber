package match

type ScoringEngine interface {
	Score(request MatchRequest, candidates []Candidate, stageNumber int) ([]CandidateScore, error)
}
