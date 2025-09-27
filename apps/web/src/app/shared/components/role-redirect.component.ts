import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-role-redirect',
  standalone: true,
  template: `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
      <div>{{ translationService.translateSync('redirect.loading') }}</div>
    </div>
  `,
})
export class RoleRedirectComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.authService
      .getCurrentUser()
      .pipe(take(1))
      .subscribe(user => {
        if (user) {
          let redirectUrl = '/employee/dashboard'; // Default for employees

          if (user.role === 'admin') {
            redirectUrl = '/admin/projects';
          } else if (user.role === 'manager') {
            redirectUrl = '/manager/dashboard';
          }

          this.router.navigate([redirectUrl]);
        } else {
          this.router.navigate(['/login']);
        }
      });
  }
}
