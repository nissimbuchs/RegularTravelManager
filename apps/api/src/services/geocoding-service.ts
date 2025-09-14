import { LocationClient, SearchPlaceIndexForTextCommand } from '@aws-sdk/client-location';
import { logger } from '../middleware/logger.js';
import { getLocationClient } from './aws-factory.js';
import { getEnvironmentConfig } from '../config/environment.js';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  formattedAddress?: string;
}

export interface GeocodeRequest {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export class GeocodingService {
  private client: LocationClient;
  private placeIndexName: string;

  constructor() {
    // Use LocalStack-aware factory (includes MockLocationClient for dev)
    this.client = getLocationClient();
    const config = getEnvironmentConfig();
    this.placeIndexName = config.LOCATION_PLACE_INDEX;
  }

  async geocodeAddress(request: GeocodeRequest): Promise<GeocodeResult> {
    const fullAddress = this.formatAddress(request);
    const config = getEnvironmentConfig();
    const rtmEnvironment = config.RTM_ENVIRONMENT;
    const useAWSGeocoding = rtmEnvironment === 'staging' || rtmEnvironment === 'production';

    logger.info('Geocoding address', {
      address: fullAddress,
      placeIndex: this.placeIndexName,
      rtmEnvironment,
      useAWSGeocoding,
    });

    try {
      // Use AWS Location Service for staging and production
      if (useAWSGeocoding) {
        logger.info('Using AWS Location Service for geocoding', {
          address: fullAddress,
          environment: rtmEnvironment,
        });
        return await this.geocodeWithAWS(fullAddress, request);
      }

      // Use mock geocoding for local and dev environments
      logger.info('Using mock geocoding service', {
        address: fullAddress,
        environment: rtmEnvironment,
      });
      return await this.geocodeWithMock(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Geocoding failed, falling back to mock', {
        error: errorMessage,
        address: fullAddress,
        environment: rtmEnvironment,
        useAWSGeocoding,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fallback to mock coordinates for Swiss locations
      return await this.geocodeWithMock(request);
    }
  }

  private async geocodeWithAWS(
    fullAddress: string,
    request: GeocodeRequest
  ): Promise<GeocodeResult> {
    logger.info('Attempting AWS Location Service geocoding', {
      address: fullAddress,
      placeIndex: this.placeIndexName,
      country: request.country,
    });

    try {
      const command = new SearchPlaceIndexForTextCommand({
        IndexName: this.placeIndexName,
        Text: fullAddress,
        MaxResults: 1,
        FilterCountries: [request.country === 'Switzerland' ? 'CHE' : request.country],
      });

      logger.info('Sending SearchPlaceIndexForTextCommand', {
        indexName: this.placeIndexName,
        text: fullAddress,
        filterCountries: [request.country === 'Switzerland' ? 'CHE' : request.country],
      });

      const response = await this.client.send(command);

      logger.info('AWS Location Service response received', {
        resultsCount: response.Results?.length || 0,
        hasResults: !!(response.Results && response.Results.length > 0),
      });

      if (!response.Results || response.Results.length === 0) {
        logger.warn('No geocoding results found from AWS Location Service', {
          address: fullAddress,
          response: response,
        });
        throw new Error(`No geocoding results found for address: ${fullAddress}`);
      }

      const result = response.Results[0];
      const geometry = result.Place?.Geometry?.Point;

      if (!geometry || geometry.length !== 2) {
        logger.error('Invalid geocoding result format from AWS Location Service', {
          address: fullAddress,
          geometry: geometry,
          place: result.Place,
        });
        throw new Error('Invalid geocoding result format - missing or invalid coordinates');
      }

      logger.info('AWS geocoding successful', {
        address: fullAddress,
        coordinates: geometry,
        relevance: result.Relevance,
        formattedAddress: this.formatPlaceResult(result.Place),
      });

      return {
        longitude: geometry[0],
        latitude: geometry[1],
        accuracy: result.Relevance || 0.5,
        formattedAddress: this.formatPlaceResult(result.Place),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown AWS Location Service error';
      logger.error('AWS Location Service geocoding failed', {
        error: errorMessage,
        address: fullAddress,
        placeIndex: this.placeIndexName,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw to allow fallback to mock
    }
  }

  private async geocodeWithMock(request: GeocodeRequest): Promise<GeocodeResult> {
    logger.info('Using mock geocoding service', { city: request.city });

    // Mock coordinates for major Swiss cities
    const swissCities: Record<string, GeocodeResult> = {
      zürich: { latitude: 47.376887, longitude: 8.540192 },
      zurich: { latitude: 47.376887, longitude: 8.540192 },
      bern: { latitude: 46.947974, longitude: 7.447447 },
      basel: { latitude: 47.559599, longitude: 7.588576 },
      geneva: { latitude: 46.204391, longitude: 6.143158 },
      genève: { latitude: 46.204391, longitude: 6.143158 },
      lausanne: { latitude: 46.519962, longitude: 6.633597 },
      winterthur: { latitude: 47.499409, longitude: 8.72407 },
      lucerne: { latitude: 47.047166, longitude: 8.306036 },
      luzern: { latitude: 47.047166, longitude: 8.306036 },
      'st. gallen': { latitude: 47.423829, longitude: 9.376716 },
      biel: { latitude: 47.139489, longitude: 7.24681 },
      thun: { latitude: 46.758406, longitude: 7.628202 },
      köniz: { latitude: 46.924569, longitude: 7.414685 },
    };

    const cityKey = request.city.toLowerCase();
    const coordinates = swissCities[cityKey];

    if (coordinates) {
      logger.info('Mock geocoding match found', { city: request.city, coordinates });
      return {
        ...coordinates,
        accuracy: 0.9,
        formattedAddress: this.formatAddress(request),
      };
    }

    // Default to Bern coordinates for unknown Swiss locations
    logger.info('Using default Swiss coordinates (Bern)', { city: request.city });
    return {
      latitude: 46.947974,
      longitude: 7.447447,
      accuracy: 0.5,
      formattedAddress: this.formatAddress(request),
    };
  }

  private formatAddress(request: GeocodeRequest): string {
    return `${request.street}, ${request.postalCode} ${request.city}, ${request.country}`;
  }

  private formatPlaceResult(place: any): string {
    if (!place) {
      return '';
    }

    const parts = [
      place.AddressNumber,
      place.Street,
      place.PostalCode,
      place.Municipality,
      place.Country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  // Method to validate coordinates are within reasonable Swiss bounds
  static isValidSwissCoordinate(lat: number, lng: number): boolean {
    // Switzerland approximate bounds
    const bounds = {
      north: 47.8,
      south: 45.8,
      east: 10.5,
      west: 5.9,
    };

    return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
  }

  // Method to calculate accuracy based on address completeness
  static calculateAccuracy(request: GeocodeRequest): number {
    let score = 0.5; // Base score

    if (request.street && request.street.length > 5) {
      score += 0.2;
    }
    if (request.postalCode && /^\d{4}$/.test(request.postalCode)) {
      score += 0.2;
    }
    if (request.city && request.city.length > 2) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }
}
