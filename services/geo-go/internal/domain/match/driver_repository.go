package match

type DriverRepository interface {
	FindNearbyDrivers(request MatchRequest, radiusMeters int) ([]DriverSnapshot, error)
}
