/**
 * Mock Location Service Client for local development
 * Provides realistic Swiss location data for testing
 */

interface PlaceResult {
  Place: {
    Label: string;
    Geometry: {
      Point: [number, number]; // [longitude, latitude]
    };
    AddressNumber?: string;
    Street?: string;
    Municipality?: string;
    SubRegion?: string;
    Region?: string;
    Country: string;
    PostalCode?: string;
  };
  Distance?: number;
  PlaceId: string;
}

interface SearchResult {
  Results: PlaceResult[];
  Summary: {
    Text: string;
    BiasPosition?: [number, number];
    FilterBBox?: [number, number, number, number];
    FilterCountries?: string[];
    MaxResults: number;
    ResultBBox?: [number, number, number, number];
    DataSource: string;
  };
}

interface CalculateRouteResult {
  Legs: Array<{
    StartPosition: [number, number];
    EndPosition: [number, number];
    Distance: number;
    DurationSeconds: number;
    Steps: Array<{
      StartPosition: [number, number];
      EndPosition: [number, number];
      Distance: number;
      DurationSeconds: number;
    }>;
  }>;
  Summary: {
    RouteBBox: [number, number, number, number];
    DataSource: string;
    Distance: number;
    DurationSeconds: number;
    DistanceUnit: string;
  };
}

export class MockLocationClient {
  private swissLocations = new Map<string, Omit<PlaceResult, 'PlaceId'>>([
    ['zurich', {
      Place: {
        Label: 'Zurich, Switzerland',
        Geometry: { Point: [8.5417, 47.3769] },
        Municipality: 'Zurich',
        Region: 'Zurich',
        Country: 'Switzerland',
        PostalCode: '8001'
      }
    }],
    ['bern', {
      Place: {
        Label: 'Bern, Switzerland',
        Geometry: { Point: [7.4474, 46.9480] },
        Municipality: 'Bern',
        Region: 'Bern',
        Country: 'Switzerland',
        PostalCode: '3001'
      }
    }],
    ['geneva', {
      Place: {
        Label: 'Geneva, Switzerland',
        Geometry: { Point: [6.1432, 46.2044] },
        Municipality: 'Geneva',
        Region: 'Geneva',
        Country: 'Switzerland',
        PostalCode: '1201'
      }
    }],
    ['basel', {
      Place: {
        Label: 'Basel, Switzerland',
        Geometry: { Point: [7.5886, 47.5596] },
        Municipality: 'Basel',
        Region: 'Basel-Stadt',
        Country: 'Switzerland',
        PostalCode: '4001'
      }
    }],
    ['lausanne', {
      Place: {
        Label: 'Lausanne, Switzerland',
        Geometry: { Point: [6.6323, 46.5197] },
        Municipality: 'Lausanne',
        Region: 'Vaud',
        Country: 'Switzerland',
        PostalCode: '1001'
      }
    }],
    ['lucerne', {
      Place: {
        Label: 'Lucerne, Switzerland',
        Geometry: { Point: [8.3093, 47.0502] },
        Municipality: 'Lucerne',
        Region: 'Lucerne',
        Country: 'Switzerland',
        PostalCode: '6001'
      }
    }],
    ['winterthur', {
      Place: {
        Label: 'Winterthur, Switzerland',
        Geometry: { Point: [8.7233, 47.5034] },
        Municipality: 'Winterthur',
        Region: 'Zurich',
        Country: 'Switzerland',
        PostalCode: '8400'
      }
    }],
    ['st. gallen', {
      Place: {
        Label: 'St. Gallen, Switzerland',
        Geometry: { Point: [9.3767, 47.4245] },
        Municipality: 'St. Gallen',
        Region: 'St. Gallen',
        Country: 'Switzerland',
        PostalCode: '9001'
      }
    }]
  ]);

  async searchPlaceIndexForText(params: {
    IndexName: string;
    Text: string;
    BiasPosition?: [number, number];
    FilterBBox?: [number, number, number, number];
    FilterCountries?: string[];
    MaxResults?: number;
  }): Promise<SearchResult> {
    const query = params.Text.toLowerCase().trim();
    const maxResults = params.MaxResults || 50;
    
    // Search for matches
    const matches: PlaceResult[] = [];
    let matchCount = 0;
    
    for (const [key, location] of this.swissLocations.entries()) {
      if (matchCount >= maxResults) break;
      
      // Simple fuzzy matching
      if (key.includes(query) || 
          location.Place.Label.toLowerCase().includes(query) ||
          location.Place.Municipality?.toLowerCase().includes(query)) {
        
        matches.push({
          ...location,
          PlaceId: `mock-${key}-${Date.now()}`,
          Distance: this.calculateDistance(
            params.BiasPosition ? params.BiasPosition[1] : 47.3769,
            params.BiasPosition ? params.BiasPosition[0] : 8.5417,
            location.Place.Geometry.Point[1],
            location.Place.Geometry.Point[0]
          )
        });
        matchCount++;
      }
    }
    
    // Sort by distance if bias position provided
    if (params.BiasPosition) {
      matches.sort((a, b) => (a.Distance || 0) - (b.Distance || 0));
    }
    
    // Add some mock international locations for broader searches
    if (matches.length < 3 && query.length > 2) {
      const internationalMatches = this.getInternationalMatches(query, maxResults - matches.length);
      matches.push(...internationalMatches);
    }
    
    return {
      Results: matches.slice(0, maxResults),
      Summary: {
        Text: params.Text,
        BiasPosition: params.BiasPosition,
        FilterBBox: params.FilterBBox,
        FilterCountries: params.FilterCountries || ['CHE'],
        MaxResults: maxResults,
        DataSource: 'MockLocationService'
      }
    };
  }

  async calculateRoute(params: {
    CalculatorName: string;
    DeparturePosition: [number, number];
    DestinationPosition: [number, number];
    TravelMode?: string;
    DepartureTime?: Date;
    CarModeOptions?: any;
  }): Promise<CalculateRouteResult> {
    const [fromLng, fromLat] = params.DeparturePosition;
    const [toLng, toLat] = params.DestinationPosition;
    
    // Calculate great-circle distance
    const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng);
    
    // Estimate travel time based on mode (default to driving)
    const travelMode = params.TravelMode || 'Car';
    let speedKmh = 50; // Default city driving
    
    switch (travelMode) {
      case 'Car':
        speedKmh = 60; // Average including highways and city
        break;
      case 'Truck':
        speedKmh = 50;
        break;
      case 'Walking':
        speedKmh = 5;
        break;
    }
    
    const durationSeconds = Math.round((distance / speedKmh) * 3600);
    
    return {
      Legs: [{
        StartPosition: params.DeparturePosition,
        EndPosition: params.DestinationPosition,
        Distance: distance * 1000, // Convert to meters
        DurationSeconds: durationSeconds,
        Steps: [{
          StartPosition: params.DeparturePosition,
          EndPosition: params.DestinationPosition,
          Distance: distance * 1000,
          DurationSeconds: durationSeconds
        }]
      }],
      Summary: {
        RouteBBox: [
          Math.min(fromLng, toLng) - 0.01,
          Math.min(fromLat, toLat) - 0.01,
          Math.max(fromLng, toLng) + 0.01,
          Math.max(fromLat, toLat) + 0.01
        ],
        DataSource: 'MockLocationService',
        Distance: distance * 1000,
        DurationSeconds: durationSeconds,
        DistanceUnit: 'Kilometers'
      }
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getInternationalMatches(query: string, maxResults: number): PlaceResult[] {
    const international = new Map([
      ['paris', {
        Place: {
          Label: 'Paris, France',
          Geometry: { Point: [2.3522, 48.8566] },
          Municipality: 'Paris',
          Region: 'Île-de-France',
          Country: 'France'
        }
      }],
      ['berlin', {
        Place: {
          Label: 'Berlin, Germany',
          Geometry: { Point: [13.4050, 52.5200] },
          Municipality: 'Berlin',
          Country: 'Germany'
        }
      }],
      ['vienna', {
        Place: {
          Label: 'Vienna, Austria',
          Geometry: { Point: [16.3738, 48.2082] },
          Municipality: 'Vienna',
          Country: 'Austria'
        }
      }],
      ['milan', {
        Place: {
          Label: 'Milan, Italy',
          Geometry: { Point: [9.1900, 45.4642] },
          Municipality: 'Milan',
          Region: 'Lombardy',
          Country: 'Italy'
        }
      }]
    ]);

    const matches: PlaceResult[] = [];
    let count = 0;

    for (const [key, location] of international.entries()) {
      if (count >= maxResults) break;
      if (key.includes(query) || location.Place.Label.toLowerCase().includes(query)) {
        matches.push({
          ...location,
          PlaceId: `mock-intl-${key}-${Date.now()}`
        });
        count++;
      }
    }

    return matches;
  }
}