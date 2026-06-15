package match

type ReputationTier string

const (
	ReputationTierRestricted ReputationTier = "restricted"
	ReputationTierObserved   ReputationTier = "observed"
	ReputationTierReliable   ReputationTier = "reliable"
	ReputationTierPremium    ReputationTier = "premium"
	ReputationTierElite      ReputationTier = "elite"
)

type MatchRequest struct {
	RideID                     string
	PassengerID                string
	PickupLat                  float64
	PickupLng                  float64
	RequestedCategory          string
	AllowedFallbackCategories  []string
	PassengerReputationTier    ReputationTier
	RadiusStages               []int
	MaxETASeconds              int
	IsAirport                  bool
	IsCorporate                bool
	IsShared                   bool
	NeedsWheelchairAccessible  bool
}

type DriverSnapshot struct {
	DriverID             string
	Lat                  float64
	Lng                  float64
	ETASeconds           int
	DistanceMeters       int
	Rating               float64
	AcceptanceRate       float64
	CancellationRate     float64
	OnlineMinutesToday   int
	CompletedRides       int
	Categories           []string
	IsAvailable          bool
	IsDocumentValid      bool
	IsLocationFresh      bool
	HasActiveBlock       bool
	IsPremiumEligible    bool
	AllowsCorporate      bool
	SupportsShared       bool
	WheelchairAccessible bool
	ExtraETASeconds      int
}

type Candidate struct {
	Driver             DriverSnapshot
	CompatibilityScore float64
}

type ScoreBreakdown struct {
	Distance      float64
	Reputation    float64
	Acceptance    float64
	Cancellation  float64
	OnlineTime    float64
	Experience    float64
	Compatibility float64
	Bonus         float64
	Penalty       float64
}

type CandidateScore struct {
	Candidate  Candidate
	FinalScore float64
	Breakdown  ScoreBreakdown
}

type MatchResult struct {
	MatchedDriverID    string
	StageNumber        int
	SearchRadiusMeters int
	RankedCandidates   []CandidateScore
}
