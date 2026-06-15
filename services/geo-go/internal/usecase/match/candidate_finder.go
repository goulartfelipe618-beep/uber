package match

import (
	"strings"

	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
)

type CandidateFinder struct {
	driverRepository domainmatch.DriverRepository
}

func NewCandidateFinder(driverRepository domainmatch.DriverRepository) *CandidateFinder {
	return &CandidateFinder{driverRepository: driverRepository}
}

func (f *CandidateFinder) FindCandidates(
	request domainmatch.MatchRequest,
	radiusMeters int,
) ([]domainmatch.Candidate, error) {
	drivers, err := f.driverRepository.FindNearbyDrivers(request, radiusMeters)
	if err != nil {
		return nil, err
	}

	candidates := make([]domainmatch.Candidate, 0, len(drivers))

	for _, driver := range drivers {
		if !driver.IsAvailable || !driver.IsDocumentValid || !driver.IsLocationFresh || driver.HasActiveBlock {
			continue
		}

		if request.IsCorporate && !driver.AllowsCorporate {
			continue
		}

		if request.IsShared && !driver.SupportsShared {
			continue
		}

		if request.NeedsWheelchairAccessible && !driver.WheelchairAccessible {
			continue
		}

		compatibilityScore := resolveCompatibilityScore(request, driver)
		if compatibilityScore <= 0 {
			continue
		}

		candidates = append(candidates, domainmatch.Candidate{
			Driver:             driver,
			CompatibilityScore: compatibilityScore,
		})
	}

	return candidates, nil
}

func resolveCompatibilityScore(
	request domainmatch.MatchRequest,
	driver domainmatch.DriverSnapshot,
) float64 {
	if hasCategory(driver.Categories, request.RequestedCategory) {
		return 1.0
	}

	for _, category := range request.AllowedFallbackCategories {
		if hasCategory(driver.Categories, category) {
			return 0.85
		}
	}

	return 0
}

func hasCategory(categories []string, wanted string) bool {
	normalizedWanted := strings.TrimSpace(strings.ToLower(wanted))
	if normalizedWanted == "" {
		return false
	}

	for _, category := range categories {
		if strings.TrimSpace(strings.ToLower(category)) == normalizedWanted {
			return true
		}
	}

	return false
}
