package match

import (
	"math"

	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
)

const earthRadiusMeters = 6371000.0

type InMemoryDriverRepository struct {
	drivers []domainmatch.DriverSnapshot
}

func NewInMemoryDriverRepository() *InMemoryDriverRepository {
	return &InMemoryDriverRepository{
		drivers: []domainmatch.DriverSnapshot{
			{
				DriverID:           "driver-economico-001",
				Lat:                -23.55052,
				Lng:                -46.63331,
				Rating:             4.91,
				AcceptanceRate:     0.83,
				CancellationRate:   0.03,
				OnlineMinutesToday: 420,
				CompletedRides:     1840,
				Categories:         []string{"economico", "comfort", "corporativo", "aeroporto"},
				IsAvailable:        true,
				IsDocumentValid:    true,
				IsLocationFresh:    true,
				IsPremiumEligible:  true,
				AllowsCorporate:    true,
			},
			{
				DriverID:             "driver-suv-001",
				Lat:                  -23.54890,
				Lng:                  -46.63880,
				Rating:               4.86,
				AcceptanceRate:       0.74,
				CancellationRate:     0.05,
				OnlineMinutesToday:   360,
				CompletedRides:       1120,
				Categories:           []string{"suv", "comfort", "pet", "aeroporto"},
				IsAvailable:          true,
				IsDocumentValid:      true,
				IsLocationFresh:      true,
				IsPremiumEligible:    true,
				WheelchairAccessible: true,
			},
			{
				DriverID:           "driver-shared-001",
				Lat:                -23.55580,
				Lng:                -46.63590,
				Rating:             4.72,
				AcceptanceRate:     0.69,
				CancellationRate:   0.07,
				OnlineMinutesToday: 250,
				CompletedRides:     760,
				Categories:         []string{"economico", "compartilhado", "pet"},
				IsAvailable:        true,
				IsDocumentValid:    true,
				IsLocationFresh:    true,
				SupportsShared:     true,
				ExtraETASeconds:    180,
			},
			{
				DriverID:             "driver-pcd-001",
				Lat:                  -23.55280,
				Lng:                  -46.62900,
				Rating:               4.95,
				AcceptanceRate:       0.88,
				CancellationRate:     0.02,
				OnlineMinutesToday:   510,
				CompletedRides:       2210,
				Categories:           []string{"pcd", "comfort", "executivo"},
				IsAvailable:          true,
				IsDocumentValid:      true,
				IsLocationFresh:      true,
				IsPremiumEligible:    true,
				WheelchairAccessible: true,
			},
		},
	}
}

func (r *InMemoryDriverRepository) FindNearbyDrivers(
	request domainmatch.MatchRequest,
	radiusMeters int,
) ([]domainmatch.DriverSnapshot, error) {
	drivers := make([]domainmatch.DriverSnapshot, 0, len(r.drivers))

	for _, driver := range r.drivers {
		distanceMeters := haversineMeters(request.PickupLat, request.PickupLng, driver.Lat, driver.Lng)
		if distanceMeters > float64(radiusMeters) {
			continue
		}

		enrichedDriver := driver
		enrichedDriver.DistanceMeters = int(math.Round(distanceMeters))
		enrichedDriver.ETASeconds = estimateETASeconds(distanceMeters)

		drivers = append(drivers, enrichedDriver)
	}

	return drivers, nil
}

func estimateETASeconds(distanceMeters float64) int {
	const averageCitySpeedMetersPerSecond = 8.33

	if distanceMeters <= 0 {
		return 60
	}

	return int(math.Ceil(distanceMeters / averageCitySpeedMetersPerSecond))
}

func haversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	lat1Rad := degreesToRadians(lat1)
	lng1Rad := degreesToRadians(lng1)
	lat2Rad := degreesToRadians(lat2)
	lng2Rad := degreesToRadians(lng2)

	dLat := lat2Rad - lat1Rad
	dLng := lng2Rad - lng1Rad

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusMeters * c
}

func degreesToRadians(value float64) float64 {
	return value * math.Pi / 180
}
