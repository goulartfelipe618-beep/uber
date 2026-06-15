package match

import (
	"database/sql"
	"math"
	"strings"

	domainmatch "github.com/transportepro/geo-go/internal/domain/match"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresDriverRepository struct {
	db *sql.DB
}

func NewPostgresDriverRepository(connectionString string) *PostgresDriverRepository {
	db, err := sql.Open("pgx", connectionString)
	if err != nil {
		panic(err)
	}

	return &PostgresDriverRepository{db: db}
}

func (r *PostgresDriverRepository) FindNearbyDrivers(
	request domainmatch.MatchRequest,
	radiusMeters int,
) ([]domainmatch.DriverSnapshot, error) {
	query := `
	select
	  lm.motorista_id as driver_id,
	  st_y(lm.localizacao) as lat,
	  st_x(lm.localizacao) as lng,
	  coalesce(ds.rating_avg, 4.70) as rating,
	  coalesce(ds.acceptance_rate, 0) as acceptance_rate,
	  coalesce(ds.cancellation_rate, 0) as cancellation_rate,
	  coalesce((ds.online_time_s / 60)::int, 0) as online_minutes_today,
	  coalesce(ds.completed_rides_count, 0)::int as completed_rides,
	  coalesce(v.wheelchair_accessible, false) as wheelchair_accessible,
	  coalesce(v.pet_ready, false) as pet_ready,
	  coalesce(
	    array_agg(distinct rc.code) filter (where rc.code is not null),
	    '{}'::text[]
	  ) as categories,
	  bool_or(coalesce(rc.is_shared, false)) as supports_shared,
	  exists(
	    select 1
	    from ride_match_blocks b
	    where b.passenger_id = $3::uuid
	      and b.driver_id = lm.motorista_id
	      and b.expires_at > now()
	    limit 1
	  ) as has_active_block,
	  st_distance_sphere(
	    lm.localizacao,
	    st_setsrid(st_makepoint($1,$2), 4326)
	  )::int as distance_meters
	from localizacoes_motoristas lm
	join usuarios u on u.id = lm.motorista_id
	left join driver_statistics ds on ds.driver_id = lm.motorista_id
	left join driver_categories dc on dc.driver_id = lm.motorista_id
	left join ride_categories rc on rc.id = dc.ride_category_id and rc.deleted_at is null
	left join lateral (
	  select v2.wheelchair_accessible, v2.pet_ready
	  from vehicles v2
	  where v2.driver_id = lm.motorista_id
	    and v2.deleted_at is null
	    and v2.status = 'ACTIVE'
	  order by v2.created_at desc
	  limit 1
	) v on true
	where lm.status = 'ONLINE'
	  and u.ativo is true
	  and u.tipo = 'MOTORISTA'
	  and st_dwithin(
	    lm.localizacao::geography,
	    st_setsrid(st_makepoint($1,$2),4326)::geography,
	    $4
	  )
	group by
	  lm.motorista_id,
	  lm.localizacao,
	  ds.rating_avg,
	  ds.acceptance_rate,
	  ds.cancellation_rate,
	  ds.online_time_s,
	  ds.completed_rides_count,
	  v.wheelchair_accessible,
	  v.pet_ready
	limit 500
	`

	passengerId := request.PassengerID
	if passengerId == "" {
		passengerId = "00000000-0000-0000-0000-000000000000"
	}

	rows, err := r.db.Query(query, request.PickupLng, request.PickupLat, passengerId, radiusMeters)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	drivers := make([]domainmatch.DriverSnapshot, 0)
	for rows.Next() {
		var driver domainmatch.DriverSnapshot
		var categories []string
		var rating float64
		var acceptance float64
		var cancellation float64

		err := rows.Scan(
			&driver.DriverID,
			&driver.Lat,
			&driver.Lng,
			&rating,
			&acceptance,
			&cancellation,
			&driver.OnlineMinutesToday,
			&driver.CompletedRides,
			&driver.WheelchairAccessible,
			&driver.PetReady,
			&categories,
			&driver.SupportsShared,
			&driver.HasActiveBlock,
			&driver.DistanceMeters,
		)
		if err != nil {
			return nil, err
		}

		driver.Rating = rating
		driver.AcceptanceRate = clampFloat64(acceptance, 0, 1)
		driver.CancellationRate = clampFloat64(cancellation, 0, 1)
		driver.Categories = normalizeCategories(categories)
		driver.IsAvailable = true
		driver.IsDocumentValid = true
		driver.IsLocationFresh = true
		driver.AllowsCorporate = hasCategory(driver.Categories, "CORPORATIVO") || hasCategory(driver.Categories, "CORPORATE")
		driver.IsPremiumEligible = driver.Rating >= 4.80
		driver.ETASeconds = estimateETASeconds(float64(driver.DistanceMeters))

		drivers = append(drivers, driver)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return drivers, nil
}

func normalizeCategories(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		out = append(out, strings.ToLower(trimmed))
	}
	return out
}

func hasCategory(categories []string, wanted string) bool {
	normalizedWanted := strings.ToLower(strings.TrimSpace(wanted))
	if normalizedWanted == "" {
		return false
	}
	for _, category := range categories {
		if strings.ToLower(strings.TrimSpace(category)) == normalizedWanted {
			return true
		}
	}
	return false
}

func clampFloat64(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func estimateETASeconds(distanceMeters float64) int {
	const averageCitySpeedMetersPerSecond = 8.33
	if distanceMeters <= 0 {
		return 60
	}
	return int(math.Ceil(distanceMeters / averageCitySpeedMetersPerSecond))
}

