import { HealthService } from "./application/health/health.service";
import { loadEnv } from "./config/env";
import { GeoGoClient } from "./integrations/geo-go/geo-go.client";
import { SupabaseService } from "./integrations/supabase/supabase.service";
import { createHttpServer } from "./infrastructure/http/server";
import { CategoryService } from "./modules/categories/application/category.service";
import { InMemoryCategoryRepository } from "./modules/categories/infrastructure/in-memory-category.repository";
import { PostgresCategoryRepository } from "./modules/categories/infrastructure/postgres-category.repository";
import { CategoriesController } from "./modules/categories/presentation/categories.controller";
import { DynamicPricingService } from "./modules/dynamic-pricing/application/dynamic-pricing.service";
import { DynamicPricingController } from "./modules/dynamic-pricing/presentation/dynamic-pricing.controller";
import { GeocodingService } from "./modules/geocoding/application/geocoding.service";
import { PostgresGeocodingRepository } from "./modules/geocoding/infrastructure/postgres-geocoding.repository";
import { GeocodingController } from "./modules/geocoding/presentation/geocoding.controller";
import { MatchDispatchService } from "./modules/match/application/match-dispatch.service";
import { PostgresMatchRepository } from "./modules/match/infrastructure/postgres-match.repository";
import { MatchBlockService } from "./modules/match-blocks/application/match-block.service";
import { InMemoryMatchBlockRepository } from "./modules/match-blocks/infrastructure/in-memory-match-block.repository";
import { PostgresMatchBlockRepository } from "./modules/match-blocks/infrastructure/postgres-match-block.repository";
import { OutboxService } from "./modules/outbox/application/outbox.service";
import { PaymentService } from "./modules/payments/application/payment.service";
import { PostgresPaymentRepository } from "./modules/payments/infrastructure/postgres-payment.repository";
import { PaymentsController } from "./modules/payments/presentation/payments.controller";
import { PlaceService } from "./modules/places/application/place.service";
import { PostgresPlaceRepository } from "./modules/places/infrastructure/postgres-place.repository";
import { PlacesController } from "./modules/places/presentation/places.controller";
import { PricingService } from "./modules/pricing/application/pricing.service";
import { PricingController } from "./modules/pricing/presentation/pricing.controller";
import { ReputationService } from "./modules/reputation/application/reputation.service";
import { InMemoryReputationRepository } from "./modules/reputation/infrastructure/in-memory-reputation.repository";
import { PostgresReputationRepository } from "./modules/reputation/infrastructure/postgres-reputation.repository";
import { ReputationController } from "./modules/reputation/presentation/reputation.controller";
import { ReviewService } from "./modules/reviews/application/review.service";
import { InMemoryReviewRepository } from "./modules/reviews/infrastructure/in-memory-review.repository";
import { PostgresReviewRepository } from "./modules/reviews/infrastructure/postgres-review.repository";
import { ReviewsController } from "./modules/reviews/presentation/reviews.controller";
import { RideStartService } from "./modules/ride-start/application/ride-start.service";
import { PostgresRideStartRepository } from "./modules/ride-start/infrastructure/postgres-ride-start.repository";
import { RideStartController } from "./modules/ride-start/presentation/ride-start.controller";
import { RideCancellationService } from "./modules/rides/application/ride-cancellation.service";
import { RideLifecycleService } from "./modules/rides/application/ride-lifecycle.service";
import { RideRequestService } from "./modules/rides/application/ride-request.service";
import { InMemoryRideRepository } from "./modules/rides/infrastructure/in-memory-ride.repository";
import { PostgresRideRepository } from "./modules/rides/infrastructure/postgres-ride.repository";
import { RidesController } from "./modules/rides/presentation/rides.controller";
import { UserService } from "./modules/users/application/user.service";
import { PostgresUserRepository } from "./modules/users/infrastructure/postgres-user.repository";
import { UsersController } from "./modules/users/presentation/users.controller";
import { VehicleService } from "./modules/vehicles/application/vehicle.service";
import { InMemoryVehicleRepository } from "./modules/vehicles/infrastructure/in-memory-vehicle.repository";
import { PostgresVehicleRepository } from "./modules/vehicles/infrastructure/postgres-vehicle.repository";
import { VehiclesController } from "./modules/vehicles/presentation/vehicles.controller";
import { WeatherService } from "./modules/weather/application/weather.service";
import { WeatherController } from "./modules/weather/presentation/weather.controller";

const env = loadEnv();
const healthService = new HealthService("core-node");
const supabaseService = new SupabaseService(env.supabase);
const categoryRepository = env.pgDsn
  ? new PostgresCategoryRepository(env.pgDsn)
  : new InMemoryCategoryRepository();
const categoryService = new CategoryService(categoryRepository);
const categoriesController = new CategoriesController(categoryService);
const pricingService = new PricingService(categoryRepository);
const pricingController = new PricingController(pricingService);
const dynamicPricingService = new DynamicPricingService(env.pgDsn);
const dynamicPricingController = new DynamicPricingController(dynamicPricingService);
const reviewRepository = env.pgDsn ? new PostgresReviewRepository(env.pgDsn) : new InMemoryReviewRepository();
const reputationRepository = env.pgDsn ? new PostgresReputationRepository(env.pgDsn) : new InMemoryReputationRepository();
const reputationService = new ReputationService(reputationRepository);
const reviewService = new ReviewService(reviewRepository);
const reviewsController = new ReviewsController(reviewService, env.pgDsn ? reputationService : undefined);
const reputationController = new ReputationController(reputationService);
const rideRepository = env.pgDsn ? new PostgresRideRepository(env.pgDsn) : new InMemoryRideRepository();
const matchBlockRepository = env.pgDsn ? new PostgresMatchBlockRepository(env.pgDsn) : new InMemoryMatchBlockRepository();
const matchBlockService = new MatchBlockService(matchBlockRepository);
const rideCancellationService = new RideCancellationService(rideRepository, matchBlockService);
const outboxService = new OutboxService(env.pgDsn);
const geoGoClient = new GeoGoClient(env.geoGoUrl);
const matchDispatchService = env.pgDsn
  ? new MatchDispatchService(geoGoClient, new PostgresMatchRepository(env.pgDsn), rideRepository)
  : undefined;
const paymentService = env.pgDsn ? new PaymentService(new PostgresPaymentRepository(env.pgDsn)) : undefined;
const rideRequestService = env.pgDsn
  ? new RideRequestService(rideRepository, pricingService, outboxService, env.pgDsn, matchDispatchService)
  : undefined;
const rideLifecycleService = env.pgDsn
  ? new RideLifecycleService(rideRepository, outboxService, paymentService)
  : undefined;
const ridesController = new RidesController(rideCancellationService, rideRequestService, rideLifecycleService);
const vehicleRepository = env.pgDsn ? new PostgresVehicleRepository(env.pgDsn) : new InMemoryVehicleRepository();
const vehicleService = new VehicleService(vehicleRepository);
const vehiclesController = new VehiclesController(vehicleService);
const placesController = env.pgDsn
  ? new PlacesController(new PlaceService(new PostgresPlaceRepository(env.pgDsn)))
  : undefined;
const paymentsController = env.pgDsn && paymentService
  ? new PaymentsController(paymentService)
  : undefined;
const rideStartController = env.pgDsn
  ? new RideStartController(new RideStartService(new PostgresRideStartRepository(env.pgDsn), env.rideStartSecret))
  : undefined;
const usersController = env.pgDsn
  ? new UsersController(new UserService(new PostgresUserRepository(env.pgDsn)))
  : undefined;
const geocodingController = env.pgDsn
  ? new GeocodingController(new GeocodingService(new PostgresGeocodingRepository(env.pgDsn), env.mapboxToken))
  : undefined;
const weatherController = env.pgDsn ? new WeatherController(new WeatherService(env.pgDsn)) : undefined;

const server = createHttpServer(
  healthService,
  supabaseService,
  categoriesController,
  pricingController,
  dynamicPricingController,
  ridesController,
  reviewsController,
  reputationController,
  vehiclesController,
  placesController,
  paymentsController,
  rideStartController,
  usersController,
  geocodingController,
  weatherController,
);

server.listen(env.httpPort, () => {
  console.log(`core-node started on port ${env.httpPort} in ${env.appEnv} mode`);
  console.log(env.pgDsn ? "PostgreSQL repository mode enabled" : "In-memory repository mode enabled");
});
