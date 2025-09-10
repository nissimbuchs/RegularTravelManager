import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MaterialModule } from './material.module';
import { configureAmplify } from './core/config/amplify.config';
import { ConfigService } from './core/services/config.service';
import { AuthService } from './core/services/auth.service';

declare global {
  interface Window {
    debugAuth: any;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MaterialModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'RegularTravelManager';

  private configService = inject(ConfigService);
  private authService = inject(AuthService);

  async ngOnInit(): Promise<void> {
    console.log('🚀 App Component initializing...');
    
    // Wait for configuration to be loaded by APP_INITIALIZER
    console.log('⏳ Waiting for config to be loaded...');
    await this.configService.waitForConfig();
    console.log('✅ Config loaded in AppComponent');

    // Configure Amplify with runtime configuration
    console.log('🔧 Configuring Amplify from AppComponent...');
    configureAmplify(this.configService);

    // Add debug helper to window for manual testing
    this.setupDebugHelpers();
    console.log('🛠️ Debug helpers added to window.debugAuth');
  }

  private setupDebugHelpers(): void {
    window.debugAuth = {
      testLogin: (email: string, password: string) => {
        console.log('🧪 Debug: Testing login with', email, '[password masked]');
        return this.authService.login({ email, password }).subscribe({
          next: (result) => {
            console.log('🧪 Debug: Login successful', result);
          },
          error: (error) => {
            console.error('🧪 Debug: Login failed', error);
          }
        });
      },
      getConfig: () => {
        const config = this.configService.config;
        console.log('🧪 Debug: Current config', config);
        return config;
      },
      getCurrentUser: () => {
        let user: any = null;
        this.authService.currentUser$.subscribe(u => user = u).unsubscribe();
        console.log('🧪 Debug: Current user', user);
        return user;
      },
      testEmployee1: () => {
        return window.debugAuth.testLogin('employee1@company.ch', 'EmployeePass123!');
      },
      testManager1: () => {
        return window.debugAuth.testLogin('manager1@company.ch', 'ManagerPass123!');
      },
      testAdmin1: () => {
        return window.debugAuth.testLogin('admin1@company.ch', 'AdminPass123!Test');
      }
    };

    console.log('🛠️ Available debug commands:');
    console.log('  window.debugAuth.testEmployee1() - Test employee1@company.ch');
    console.log('  window.debugAuth.testManager1() - Test manager1@company.ch');  
    console.log('  window.debugAuth.testAdmin1() - Test admin1@company.ch');
    console.log('  window.debugAuth.testLogin(email, password) - Test custom credentials');
    console.log('  window.debugAuth.getConfig() - Show current configuration');
    console.log('  window.debugAuth.getCurrentUser() - Show current user');
  }
}
