package match

type MatchService interface {
	Match(request MatchRequest) (MatchResult, error)
}
