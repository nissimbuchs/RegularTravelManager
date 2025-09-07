import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MaterialModule } from './material.module';
import { configureAmplify } from './core/config/amplify.config';
import { ConfigService } from './core/services/config.service';

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

  async ngOnInit(): Promise<void> {
    // Wait for configuration to be loaded by APP_INITIALIZER
    await this.configService.waitForConfig();
    
    // Configure Amplify with runtime configuration
    configureAmplify(this.configService);
  }
}
