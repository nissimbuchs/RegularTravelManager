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
      const config = await firstValueFrom(this.http.get<AppConfig>('/assets/config/config.json'));

      this._config = config;
      this.configSubject.next(config);

      console.log('✅ Runtime configuration loaded:', {
        apiUrl: config.apiUrl,
        userPoolId: config.cognito.userPoolId,
        environment: config.environment,
      });
    } catch (error) {
      console.error('❌ Failed to load runtime configuration:', error);

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

      console.warn('⚠️ Using fallback configuration for local development');
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
