package match

type CandidateFinder interface {
	FindCandidates(request MatchRequest, radiusMeters int) ([]Candidate, error)
}
