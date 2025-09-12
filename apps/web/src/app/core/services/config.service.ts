import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiUrl: string;
  cognito: {
    userPoolId: string;
    userPoolClientId: string;
    region: string;
    useMockAuth: boolean;
  };
  environment: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private configSubject = new BehaviorSubject<AppConfig | null>(null);
  public config$ = this.configSubject.asObservable();

  private _config: AppConfig | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Load configuration from runtime config file
   * This should be called during app initialization
   */
  async loadConfig(): Promise<void> {
    try {
      console.log('🔧 Loading runtime configuration...');

      // Try to load environment-specific config first
      console.log('🌐 Fetching config from /assets/config/config.json...');
      const config = await firstValueFrom(this.http.get<AppConfig>('/assets/config/config.json'));
      console.log('📄 Raw configuration loaded:', config);

      // Validate the loaded configuration
      if (!config.cognito) {
        throw new Error('Missing cognito configuration');
      }

      if (!config.cognito.userPoolId) {
        throw new Error('Missing userPoolId in configuration');
      }

      if (!config.cognito.userPoolClientId) {
        throw new Error('Missing userPoolClientId in configuration');
      }

      this._config = config;
      this.configSubject.next(config);

      console.log('✅ Runtime configuration loaded and validated:', {
        apiUrl: config.apiUrl,
        userPoolId: config.cognito.userPoolId,
        userPoolClientId: config.cognito.userPoolClientId,
        region: config.cognito.region,
        useMockAuth: config.cognito.useMockAuth,
        environment: config.environment,
      });
    } catch (error: any) {
      console.error('❌ Failed to load runtime configuration:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        url: error?.url,
      });

      // Fallback to default local development config
      const fallbackConfig: AppConfig = {
        apiUrl: 'http://localhost:3000',
        cognito: {
          userPoolId: 'local',
          userPoolClientId: 'local',
          region: 'eu-central-1',
          useMockAuth: true,
        },
        environment: 'local',
      };

      this._config = fallbackConfig;
      this.configSubject.next(fallbackConfig);

      console.warn('⚠️ Using fallback configuration for local development:', fallbackConfig);
    }
  }

  /**
   * Get the current configuration
   * Returns null if configuration hasn't been loaded yet
   */
  get config(): AppConfig | null {
    return this._config;
  }

  /**
   * Get configuration as observable
   */
  getConfig(): Observable<AppConfig | null> {
    return this.config$;
  }

  /**
   * Get API URL
   */
  get apiUrl(): string {
    return this._config?.apiUrl || 'http://localhost:3000';
  }

  /**
   * Get Cognito configuration
   */
  get cognitoConfig() {
    return (
      this._config?.cognito || {
        userPoolId: 'local',
        userPoolClientId: 'local',
        region: 'eu-central-1',
        useMockAuth: true,
      }
    );
  }

  /**
   * Get current environment
   */
  get environment(): string {
    return this._config?.environment || 'local';
  }

  /**
   * Check if configuration is loaded
   */
  get isLoaded(): boolean {
    return this._config !== null;
  }

  /**
   * Wait for configuration to be loaded
   */
  async waitForConfig(): Promise<AppConfig> {
    if (this._config) {
      return this._config;
    }

    return new Promise(resolve => {
      const subscription = this.config$.subscribe(config => {
        if (config) {
          subscription.unsubscribe();
          resolve(config);
        }
      });
    });
  }
}
